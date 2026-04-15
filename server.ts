import express, { Request, Response, NextFunction } from "express";
import { createServer as createViteServer } from "vite";
import http from "http";
import { WebSocketServer, WebSocket } from "ws";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import path from "path";
import fs from "fs/promises";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";

import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import RedisStore from "rate-limit-redis";
import { createClient } from "redis";

import helmet from "helmet";
import cors from "cors";

import { pool, query } from "./src/db/index";
import { validate } from "./src/middleware/validate";
import {
  registerSchema,
  loginSchema,
  placeOrderSchema,
  upstoxSaveTokenSchema,
  adminCreateUserSchema,
  whitelistSchema
} from "./src/validation/schemas";

import { logger } from "./src/utils/logger";
import { encrypt, decrypt } from "./src/utils/encryption";
import { requireKyc } from "./src/middleware/requireKyc";
import { getBrokerService, OrderRequest } from "./src/lib/brokers/index";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

interface ExtWebSocket extends WebSocket {
  isAlive: boolean;
  userId?: number; 
}

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server });

  const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret";
  const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "fallback-refresh-secret";

  const redisClient = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  });

  let redisConnected = false;
  redisClient.on('error', (err) => logger.error('[Redis] Client Error', err));
  
  try {
    await redisClient.connect();
    redisConnected = true;
    logger.info('[Redis] Connected for centralized rate limiting');
  } catch (e) {
    logger.warn('[Redis] Connection failed — using in-memory rate limiting fallback.');
  }

  wss.on("connection", (socket, req) => {
    const ws = socket as ExtWebSocket;
    ws.isAlive = true;

    const ip = req.socket.remoteAddress;
    const url = new URL(req.url || "", `http://${req.headers.host || "localhost"}`);
    const token = url.searchParams.get("token");

    if (!token) {
      logger.warn(`[WebSocket] Connection rejected: No token provided from ${ip}`);
      ws.close(4001, "Unauthorized");
      return;
    }

    jwt.verify(token, JWT_SECRET, (err: any, decoded: any) => {
      if (err) {
        logger.warn(`[WebSocket] Connection rejected: Invalid token from ${ip}`);
        ws.close(4001, "Unauthorized");
        return;
      }

      ws.userId = decoded.id;
      logger.info(`[WebSocket] Authenticated User ID: ${ws.userId} connected from ${ip}. Total clients: ${wss.clients.size}`);

      ws.on("pong", () => {
        ws.isAlive = true;
      });

      ws.send(JSON.stringify({ type: "ticker", data: stockPrices }));

      ws.on("close", () => {
        logger.info(`[WebSocket] User ID: ${ws.userId} disconnected. Remaining clients: ${wss.clients.size}`);
      });

      ws.on("error", (err) => {
        logger.error(`[WebSocket] User ID: ${ws.userId} error:`, err);
      });
    });
  });

  const pingInterval = setInterval(() => {
    wss.clients.forEach((client) => {
      const ws = client as ExtWebSocket;
      if (ws.isAlive === false) {
        logger.info("[WebSocket] Terminating unresponsive client (zombie connection).");
        return ws.terminate();
      }

      ws.isAlive = false;
      ws.ping();
    });
  }, 30000); 

  const tokenRefreshInterval = setInterval(async () => {
    try {
      const { rows: expiringTokens } = await query(
        "SELECT user_id, refresh_token FROM user_tokens WHERE broker = 'upstox' AND expires_at <= NOW() + INTERVAL '15 minutes'"
      );

      if (expiringTokens.length === 0) return;

      logger.info(`[TokenRefresh] Found ${expiringTokens.length} Upstox tokens expiring soon. Attempting refresh...`);

      const apiKey = process.env.UPTOX_API_KEY ?? "";
      const apiSecret = process.env.UPTOX_API_SECRET ?? "";
      
      if (!apiKey || !apiSecret) {
          logger.warn("[TokenRefresh] UPTOX_API_KEY or UPTOX_API_SECRET is missing. Cannot refresh tokens.");
          return;
      }

      const brokerService = getBrokerService("upstox") as any;

      for (const tokenRow of expiringTokens) {
        try {
          if (!tokenRow.refresh_token) continue;
          
          const decryptedRefreshToken = decrypt(String(tokenRow.refresh_token));
          if (!decryptedRefreshToken) continue;

          const refreshData = await brokerService.refreshAccessToken(apiKey, apiSecret, decryptedRefreshToken);
          
          if (refreshData && refreshData.access_token) {
             const newRefreshToken = refreshData.refresh_token ? encrypt(String(refreshData.refresh_token)) : tokenRow.refresh_token;
             
             await query(
               `UPDATE user_tokens 
                SET access_token = $1, refresh_token = $2, expires_at = NOW() + INTERVAL '24 hours', updated_at = NOW() 
                WHERE user_id = $3 AND broker = 'upstox'`,
               [
                 encrypt(String(refreshData.access_token)),
                 newRefreshToken,
                 tokenRow.user_id
               ]
             );
             logger.info(`[TokenRefresh] Successfully proactive refreshed token for user_id: ${tokenRow.user_id}`);
          }
        } catch (err) {
          logger.error(`[TokenRefresh] Failed to proactive refresh token for user_id ${tokenRow.user_id}:`, err);
        }
      }
    } catch (e) {
       logger.error("[TokenRefresh] Job error:", e);
    }
  }, 5 * 60 * 1000); 

  app.set("trust proxy", 1);

  app.use(
    helmet({
      contentSecurityPolicy: process.env.NODE_ENV === "production" 
        ? {
            directives: {
              ...helmet.contentSecurityPolicy.getDefaultDirectives(),
              "script-src": ["'self'", "'unsafe-inline'", "https://s3.tradingview.com", "https://www.tradingview.com"],
              "frame-src": ["'self'", "https://s3.tradingview.com", "https://www.tradingview.com"],
              "style-src": ["'self'", "'unsafe-inline'"],
            },
          }
        : false,
      crossOriginEmbedderPolicy: false,
    })
  );

  const allowedOrigins = [
    process.env.VITE_APP_URL || "https://aapacapital.com",
    "https://aapa-production.up.railway.app", 
    "http://localhost:3000",
    "http://localhost:5173", 
  ];

  app.use(
    cors({
      origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.includes(origin)) {
          return callback(null, true);
        } else {
          logger.warn(`[CORS] Blocked request from unauthorized origin: ${origin}`);
          return callback(null, false);
        }
      },
      credentials: true, 
    })
  );

  app.use(express.json());
  app.use(cookieParser());

  const makeStore = (prefix: string) => redisConnected
    ? new RedisStore({ 
        sendCommand: (...args: string[]) => {
          if (!redisClient.isReady) throw new Error('Redis not ready');
          return redisClient.sendCommand(args);
        },
        prefix: prefix 
      })
    : undefined;

  // 🚀 FIX: passOnStoreError set to true prevents app from crashing on Redis disconnects
  const authStore = makeStore("rl:auth:");
  const authLimiter = rateLimit({
    ...(authStore ? { store: authStore } : {}),
    windowMs: 5 * 60 * 1000,
    max: 20,
    passOnStoreError: true, 
    message: { error: "Too many login attempts. Please try again in 5 minutes." },
    standardHeaders: true,
    legacyHeaders: false,
  });

  const apiStore = makeStore("rl:api:");
  const apiLimiter = rateLimit({
    ...(apiStore ? { store: apiStore } : {}),
    windowMs: 60 * 1000,
    max: 300,
    passOnStoreError: true,
    message: { error: "Too many requests. Please slow down." },
    standardHeaders: true,
    legacyHeaders: false,
  });

  const aiStore = makeStore("rl:ai:");
  const aiLimiter = rateLimit({
    ...(aiStore ? { store: aiStore } : {}),
    windowMs: 60 * 1000,
    max: 10,
    passOnStoreError: true,
    keyGenerator: (req: any, res: any) => req.user?.id || ipKeyGenerator(req, res),
    message: { error: "AI signal limit reached. Please wait." },
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.use("/api/auth", authLimiter);
  app.use("/api/ai", aiLimiter);
  app.use("/api", apiLimiter);

  app.use((req, res, next) => {
    logger.info(`[HTTP] ${req.method} ${req.url}`);
    next();
  });

  const authenticateToken = (req: any, res: any, next: any) => {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];
    if (!token) return res.sendStatus(401);

    jwt.verify(String(token), JWT_SECRET, (err: any, user: any) => {
      if (err) return res.sendStatus(403);
      req.user = user;
      next();
    });
  };

  app.get("/api/health", async (req, res) => {
    try {
      await query("SELECT 1");
      res.status(200).json({ 
        status: "ok", 
        database: "connected", 
        timestamp: new Date().toISOString() 
      });
    } catch (error: any) {
      logger.error("[HealthCheck] Database ping failed:", error);
      res.status(503).json({ 
        status: "error", 
        database: "disconnected", 
        details: error.message || String(error),
        timestamp: new Date().toISOString() 
      });
    }
  });

  app.post("/api/auth/register", validate(registerSchema), async (req, res, next) => {
      try {
        let { email, mobile, password } = req.body || {};
        email = email?.toString().toLowerCase().trim();
        mobile = mobile?.toString().trim();

        logger.info(`[Auth] Registration attempt for email: ${email}`);
        const hashedPassword = await bcrypt.hash(String(password), 10);
        const { rows: countRows } = await query("SELECT COUNT(*) as count FROM users");
        const userCount = parseInt(countRows[0].count);
        const superAdminEmail = "bharvadvijay371@gmail.com";
        const role = userCount === 0 || email === superAdminEmail ? "admin" : "user";

        const { rows: inserted } = await query(
          "INSERT INTO users (email, mobile, password, role, terms_accepted_at) VALUES ($1, $2, $3, $4, NOW()) RETURNING id",
          [email, mobile, hashedPassword, role]
        );

        logger.info(`[Auth] Registration successful for user ID: ${inserted[0].id} with role: ${role}`);
        res.json({ id: inserted[0].id });
      } catch (e: any) {
        if (e.code === "23505") {
          if (e.constraint === "users_email_key") return res.status(400).json({ error: "Email already registered. Please login instead." });
          if (e.constraint === "users_mobile_key") return res.status(400).json({ error: "Mobile number already registered. Please login instead." });
        }
        next(e);
      }
    }
  );

  // 🚀 FIX: Hyper-resilient login endpoint to catch empty bodies and DB disconnections without crashing (500)
  app.post("/api/auth/login", validate(loginSchema), async (req, res, next) => {
      try {
        if (!req.body) {
           return res.status(400).json({ error: "Empty request payload" });
        }
        
        let { login, password } = req.body;
        
        if (!login || !password) {
            return res.status(400).json({ error: "Missing login credentials" });
        }

        login = login.toString().toLowerCase().trim();
        logger.info(`[Auth] Login attempt for: ${login}`);

        let rows;
        try {
          const result = await query(
            "SELECT * FROM users WHERE email = $1 OR mobile = $1",
            [login]
          );
          rows = result.rows;
        } catch (dbErr: any) {
          logger.error(`[Auth DB Error] DB query failed during login: ${dbErr.message}`);
          return res.status(500).json({ error: "Database error during login. Please try again." });
        }
        
        const user = rows[0];

        if (!user || !user.password) {
          return res.status(401).json({ error: "Invalid credentials" });
        }

        const isMatch = await bcrypt.compare(String(password), String(user.password));
        if (!isMatch) {
          return res.status(401).json({ error: "Invalid credentials" });
        }

        const superAdminEmail = "bharvadvijay371@gmail.com";
        const effectiveRole = user.email === superAdminEmail ? "admin" : user.role;

        const token = jwt.sign(
          { id: user.id, email: user.email, role: effectiveRole },
          JWT_SECRET,
          { expiresIn: "15m" }
        );
        const refreshToken = jwt.sign({ id: user.id }, JWT_REFRESH_SECRET, {
          expiresIn: "7d",
        });

        res.cookie("refreshToken", refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
          maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        logger.info(`[Auth] Login successful for ${login} (ID: ${user.id}) with role: ${effectiveRole}`);
        res.json({
          token,
          user: {
            id: user.id,
            email: user.email,
            role: effectiveRole,
            balance: parseFloat(user.balance || "0"),
          },
        });
      } catch (e: any) {
        logger.error("[Auth Error] Unexpected failure:", e);
        return res.status(500).json({ 
          error: "An unexpected error occurred during login.", 
          details: e.message || String(e) 
        });
      }
    }
  );

  app.post("/api/auth/refresh", async (req, res, next) => {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) return res.status(401).json({ error: "Refresh token required" });

    jwt.verify(String(refreshToken), JWT_REFRESH_SECRET, async (err: any, decoded: any) => {
        if (err) return res.status(403).json({ error: "Invalid or expired refresh token" });

        try {
          const { rows } = await query("SELECT id, email, role FROM users WHERE id = $1", [decoded.id]);
          const user = rows[0];
          if (!user) return res.status(403).json({ error: "User no longer exists" });

          const effectiveRole = user.email === "bharvadvijay371@gmail.com" ? "admin" : user.role;

          const newToken = jwt.sign({ id: user.id, email: user.email, role: effectiveRole }, JWT_SECRET, { expiresIn: "15m" });
          res.json({ token: newToken });
        } catch (e) {
          next(e);
        }
      }
    );
  });

  app.post("/api/auth/logout", (req, res) => {
    res.clearCookie("refreshToken", {
      httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
    });
    res.json({ success: true, message: "Logged out successfully" });
  });

  app.get("/api/admin/users", authenticateToken, async (req: any, res, next) => {
    if (req.user.role !== "admin") return res.sendStatus(403);
    try {
      const { rows: users } = await query("SELECT id, email, mobile, role, balance, created_at FROM users ORDER BY created_at DESC");
      res.json(users);
    } catch (e) { next(e); }
  });

  app.post("/api/admin/users/:id/role", authenticateToken, async (req: any, res, next) => {
      if (req.user.role !== "admin") return res.sendStatus(403);
      try {
        const { role } = req.body;
        const { id } = req.params;
        await query("UPDATE users SET role = $1 WHERE id = $2", [role, id]);
        res.json({ success: true });
      } catch (e) { next(e); }
    }
  );

  app.get("/api/admin/whitelist", authenticateToken, async (req: any, res, next) => {
      if (req.user.role !== "admin") return res.sendStatus(403);
      try {
        const { rows: list } = await query("SELECT * FROM beta_whitelist ORDER BY created_at DESC");
        res.json(list);
      } catch (e) { next(e); }
    }
  );

  app.post("/api/admin/whitelist", authenticateToken, validate(whitelistSchema), async (req: any, res, next) => {
      if (req.user.role !== "admin") return res.sendStatus(403);
      const { identifier } = req.body;
      try {
        await query("INSERT INTO beta_whitelist (identifier) VALUES ($1)", [identifier]);
        res.json({ success: true });
      } catch (e) { res.status(400).json({ error: "Already whitelisted" }); }
    }
  );

  app.delete("/api/admin/whitelist/:id", authenticateToken, async (req: any, res, next) => {
      if (req.user.role !== "admin") return res.sendStatus(403);
      try {
        await query("DELETE FROM beta_whitelist WHERE id = $1", [req.params.id]);
        res.json({ success: true });
      } catch (e) { next(e); }
    }
  );

  app.post("/api/admin/users/create", authenticateToken, validate(adminCreateUserSchema), async (req: any, res, next) => {
      if (req.user.role !== "admin") return res.sendStatus(403);
      const { email, mobile, password, role } = req.body;
      try {
        const hashedPassword = await bcrypt.hash(String(password), 10);
        const { rows } = await query(
          "INSERT INTO users (email, mobile, password, role) VALUES ($1, $2, $3, $4) RETURNING id",
          [email, mobile, hashedPassword, role]
        );
        res.json({ id: rows[0].id });
      } catch (e: any) { res.status(400).json({ error: e.message }); }
    }
  );

  app.get("/api/user/profile", authenticateToken, async (req: any, res, next) => {
    try {
      const { rows: userRows } = await query(
        "SELECT id, email, mobile, role, kyc_status, is_kyc_approved, balance FROM users WHERE id = $1",
        [req.user.id]
      );
      const user = userRows[0];
      if (!user) return res.status(404).json({ error: "User not found" });

      const { rows: tokenRows } = await query(
        "SELECT access_token, broker FROM user_tokens WHERE user_id = $1 AND broker = 'upstox'",
        [req.user.id]
      );
      const userToken = tokenRows[0];
      let balance = parseFloat(user?.balance) || 0;

      if (userToken && userToken.access_token) {
        try {
          const decryptedToken = decrypt(String(userToken.access_token));
          if (decryptedToken) {
            const brokerService = getBrokerService("upstox");
            balance = await brokerService.getFunds(decryptedToken);
          }
        } catch (e) { logger.warn("Failed to fetch Upstox funds", e); }
      }

      res.json({ ...user, balance, is_uptox_connected: !!userToken });
    } catch (e) { next(e); }
  });

  app.get("/api/auth/uptox/url", authenticateToken, (req: any, res) => {
    const apiKey = process.env.UPTOX_API_KEY ?? "";
    let redirectUri = process.env.UPTOX_REDIRECT_URI ?? "";

    const host = req.get("host") ?? "";
    const protocol = (req.get("x-forwarded-proto") as string | undefined) ?? req.protocol;
    const detectedUri = `${protocol}://${host}/auth/callback`;

    if (!redirectUri || !redirectUri.startsWith("http")) redirectUri = detectedUri;

    if (!apiKey) return res.status(500).json({ error: "UPTOX_API_KEY is missing." });

    const state = req.headers.authorization?.split(" ")[1] || "";
    const url = `https://api.upstox.com/v2/login/authorization/dialog?response_type=code&client_id=${apiKey}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}`;
    res.json({ url });
  });

  app.get("/auth/callback", async (req, res, next) => {
    const { code, state } = req.query;
    if (!code) return res.status(400).send("No code provided.");

    const apiKey = process.env.UPTOX_API_KEY ?? "";
    const apiSecret = process.env.UPTOX_API_SECRET ?? "";
    let redirectUri = process.env.UPTOX_REDIRECT_URI ?? "";

    if (!redirectUri || redirectUri.includes("ais-pre-") || redirectUri.includes("ais-dev-") || !redirectUri.startsWith("http")) {
      const host = req.get("host") ?? "";
      const protocol = (req.get("x-forwarded-proto") as string | undefined) ?? req.protocol;
      redirectUri = `${protocol}://${host}/auth/callback`;
    }

    const frontendTargetOrigin = process.env.VITE_APP_URL || "*";

    const renderHtmlResponse = (isSuccess: boolean, message: string, payload: any) => {
      return `
        <html>
          <head><title>Upstox Authentication</title></head>
          <body style="background:#000;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;">
            <div style="text-align:center;">
              <h2 style="color:${isSuccess ? '#10b981' : '#ef4444'};">${message}</h2>
              <p id="msg" style="color:#a1a1aa;font-size:14px;">Redirecting back to app...</p>
              <script>
                if (window.opener) {
                  window.opener.postMessage(${JSON.stringify(payload)}, "${frontendTargetOrigin}");
                  setTimeout(() => window.close(), 1500);
                } else { document.getElementById('msg').innerText = "Please close this tab and return to the application."; }
              </script>
            </div>
          </body>
        </html>
      `;
    };

    try {
      const params = new URLSearchParams({
        code: String(code), client_id: apiKey, client_secret: apiSecret, redirect_uri: redirectUri, grant_type: "authorization_code",
      });

      const response = await fetch("https://api.upstox.com/v2/login/authorization/token", {
        method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" }, body: params,
      });

      const data = await response.json();

      if (!data.access_token) return res.status(400).send(renderHtmlResponse(false, "Connection Failed!", { type: 'UPTOX_AUTH_ERROR', error: data }));

      const userJwt = state ? String(state) : null;
      if (userJwt) {
        try {
          const decoded: any = jwt.verify(userJwt, JWT_SECRET);
          const userId = decoded.id;

          await query(
            `INSERT INTO user_tokens (user_id, broker, access_token, refresh_token, expires_at)
             VALUES ($1, 'upstox', $2, $3, NOW() + INTERVAL '24 hours')
             ON CONFLICT (user_id, broker) DO UPDATE SET access_token = EXCLUDED.access_token, refresh_token = EXCLUDED.refresh_token, expires_at = EXCLUDED.expires_at`,
            [userId, encrypt(String(data.access_token)), encrypt(String(data.refresh_token || ""))]
          );

          await query("UPDATE users SET is_uptox_connected = true WHERE id = $1", [userId]);

          upstoxConsecutiveFailures = 0;
          upstoxBackoffUntil = 0;
          fetchRealPrices();

          return res.send(renderHtmlResponse(true, "Connection Successful! ✓", { type: 'UPTOX_AUTH_SUCCESS' }));
        } catch (jwtErr) { logger.warn("[OAuth Callback] Invalid state JWT, falling back to client-side save"); }
      }

      res.send(renderHtmlResponse(true, "Connection Successful!", { type: 'UPTOX_AUTH_SUCCESS', token: data.access_token, refresh_token: data.refresh_token || "" }));
    } catch (e) { next(e); }
  });

  app.post("/api/auth/uptox/save-token", authenticateToken, validate(upstoxSaveTokenSchema), async (req: any, res, next) => {
      try {
        const { access_token, refresh_token } = req.body;
        await query(
          `INSERT INTO user_tokens (user_id, broker, access_token, refresh_token, expires_at) 
           VALUES ($1, $2, $3, $4, NOW() + INTERVAL '24 hours') 
           ON CONFLICT (user_id, broker) DO UPDATE SET access_token = EXCLUDED.access_token, refresh_token = EXCLUDED.refresh_token, expires_at = EXCLUDED.expires_at`,
          [req.user.id, "upstox", encrypt(String(access_token)), encrypt(String(refresh_token))]
        );
        await query("UPDATE users SET is_uptox_connected = true WHERE id = $1", [req.user.id]);
        
        upstoxConsecutiveFailures = 0;
        upstoxBackoffUntil = 0;
        fetchRealPrices();
        res.json({ success: true });
      } catch (e) { next(e); }
    }
  );

  app.get("/api/portfolio", authenticateToken, async (req: any, res, next) => {
    try {
      const { rows: tokens } = await query("SELECT broker, access_token FROM user_tokens WHERE user_id = $1", [req.user.id]);
      let combinedHoldings: any[] = [];

      for (const token of tokens) {
        if (!token.access_token) continue;
        try {
          const decryptedToken = decrypt(String(token.access_token));
          if (!decryptedToken) continue;

          const brokerService = getBrokerService(String(token.broker));
          const holdings = await brokerService.getHoldings(decryptedToken);
          combinedHoldings = [...combinedHoldings, ...holdings];
        } catch (e) { logger.warn(`[Portfolio] ${token.broker} error:`, e); }
      }

      let localHoldings: any[] = [];
      try {
        const { rows } = await query("SELECT *, 'Local' as broker FROM portfolios WHERE user_id = $1", [req.user.id]);
        localHoldings = rows;
      } catch (dbErr: any) { }

      if (combinedHoldings.length > 0) return res.json(combinedHoldings);
      res.json(localHoldings);
    } catch (e: any) { res.status(500).json({ error: "Failed to load portfolio", details: e.message || String(e) }); }
  });

  app.post("/api/orders", authenticateToken, requireKyc, validate(placeOrderSchema), async (req: any, res, next) => {
      try {
        const { symbol, type, order_type, quantity, price, product, broker } = req.body;
        const userId = req.user.id;
        const { rows } = await query("SELECT access_token FROM user_tokens WHERE user_id = $1 AND broker = $2", [userId, broker]);
        const userToken = rows[0];

        if (!userToken || !userToken.access_token) return res.status(400).json({ error: `Please connect your ${broker} account.` });

        const decryptedToken = decrypt(String(userToken.access_token));
        if (!decryptedToken) return res.status(500).json({ error: "Failed to decrypt broker token." });

        try {
          const brokerService = getBrokerService(String(broker));
          const orderRequest: OrderRequest = { symbol, type, order_type, quantity, price, product };
          const orderRes = await brokerService.placeOrder(decryptedToken, orderRequest);

          if (orderRes.success) {
            await query("INSERT INTO orders (user_id, symbol, type, order_type, quantity, price, broker, broker_order_id, status, raw_broker_response) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'completed', $9)",
              [userId, symbol, type, order_type, quantity, price, broker, orderRes.order_id, JSON.stringify(orderRes.raw_response)]);
            return res.json({ success: true, order_id: orderRes.order_id });
          } else {
            const errorMsg = orderRes.error || "Order failed";
            await query("INSERT INTO orders (user_id, symbol, type, order_type, quantity, price, broker, status, failed_reason, raw_broker_response) VALUES ($1, $2, $3, $4, $5, $6, $7, 'failed', $8, $9)",
              [userId, symbol, type, order_type, quantity, price, broker, errorMsg, JSON.stringify(orderRes.raw_response)]);
            return res.status(400).json({ error: errorMsg });
          }
        } catch (e: any) {
          await query("INSERT INTO orders (user_id, symbol, type, order_type, quantity, price, broker, status, failed_reason, raw_broker_response) VALUES ($1, $2, $3, $4, $5, $6, $7, 'failed', $8, $9)",
            [userId, symbol, type, order_type, quantity, price, broker, e.message, JSON.stringify({ error: e.message })]);
          throw new Error(`${broker} API Error`);
        }
      } catch (e) { next(e); }
    }
  );

  const primaryIndices = ["NIFTY 50", "SENSEX", "BANKNIFTY", "FINNIFTY", "MIDCAP NIFTY", "SMALLCAP NIFTY"];
  const secondaryIndices = ["NIFTY IT", "NIFTY AUTO", "NIFTY PHARMA", "NIFTY METAL", "NIFTY FMCG", "NIFTY REALTY"];
  const stocks = ["RELIANCE", "TCS", "HDFCBANK", "INFY", "ICICIBANK", "BHARTIARTL", "SBIN", "LICI", "ITC", "HINDUNILVR"];
  const allSymbols = [...primaryIndices, ...secondaryIndices, ...stocks];

  const stockPrices: Record<string, number> = {
    "NIFTY 50": 22145.2, SENSEX: 72850.4, BANKNIFTY: 46800.15, FINNIFTY: 20850.6, "MIDCAP NIFTY": 10920.45, "SMALLCAP NIFTY": 16150.3,
    "NIFTY IT": 37850.2, "NIFTY AUTO": 20150.4, "NIFTY PHARMA": 18920.15, "NIFTY METAL": 7950.6, "NIFTY FMCG": 54120.3, "NIFTY REALTY": 890.45,
    RELIANCE: 2985.4, TCS: 4120.15, HDFCBANK: 1450.6, INFY: 1680.4, ICICIBANK: 1050.2, BHARTIARTL: 1120.3, SBIN: 750.45, LICI: 940.2, ITC: 410.15, HINDUNILVR: 2380.6,
  };
  
  allSymbols.forEach((s) => {
    if (!stockPrices[s]) stockPrices[s] = Math.random() * 1000 + 100;
  });

  // 🚀 FIX: Correct Upstox ISIN mapping for V2 live feeds
  const stockISINMap: Record<string, string> = {
    "RELIANCE": "NSE_EQ|INE002A01018",
    "TCS": "NSE_EQ|INE467B01029",
    "HDFCBANK": "NSE_EQ|INE040A01034",
    "INFY": "NSE_EQ|INE009A01021",
    "ICICIBANK": "NSE_EQ|INE090A01021",
    "BHARTIARTL": "NSE_EQ|INE397D01024",
    "SBIN": "NSE_EQ|INE062A01020",
    "LICI": "NSE_EQ|INE511Q01029",
    "ITC": "NSE_EQ|INE154A01025",
    "HINDUNILVR": "NSE_EQ|INE030A01027"
  };

  const indexMap: Record<string, string[]> = {
    "NIFTY 50": ["NSE_INDEX|Nifty 50", "NSE_INDEX|NIFTY 50"],
    BANKNIFTY: ["NSE_INDEX|Nifty Bank", "NSE_INDEX|NIFTY BANK"],
    FINNIFTY: ["NSE_INDEX|Nifty Fin Service", "NSE_INDEX|NIFTY FIN SERVICE"],
    "MIDCAP NIFTY": ["NSE_INDEX|Nifty Midcap 100", "NSE_INDEX|NIFTY MIDCAP 100"],
    SENSEX: ["BSE_INDEX|SENSEX", "BSE_INDEX|Sensex"],
    "SMALLCAP NIFTY": ["NSE_INDEX|Nifty Smallcap 100", "NSE_INDEX|NIFTY SMALLCAP 100"],
    "NIFTY IT": ["NSE_INDEX|Nifty IT", "NSE_INDEX|NIFTY IT"],
    "NIFTY AUTO": ["NSE_INDEX|Nifty Auto", "NSE_INDEX|NIFTY AUTO"],
    "NIFTY PHARMA": ["NSE_INDEX|Nifty Pharma", "NSE_INDEX|NIFTY PHARMA"],
    "NIFTY METAL": ["NSE_INDEX|Nifty Metal", "NSE_INDEX|NIFTY METAL"],
    "NIFTY FMCG": ["NSE_INDEX|Nifty FMCG", "NSE_INDEX|NIFTY FMCG"],
    "NIFTY REALTY": ["NSE_INDEX|Nifty Realty", "NSE_INDEX|NIFTY REALTY"],
  };

  let isFetchingUpstox = false;
  let upstoxConsecutiveFailures = 0;
  let upstoxBackoffUntil = 0;
  let lastLogTime = 0;

  const fetchRealPrices = async () => {
    if (isFetchingUpstox) return;
    if (Date.now() < upstoxBackoffUntil) return;

    isFetchingUpstox = true;
    try {
      const { rows } = await query(
        "SELECT user_id, access_token FROM user_tokens WHERE broker = 'upstox' LIMIT 1"
      );
      const userToken = rows[0];
      
      if (!userToken || !userToken.access_token) {
        const now = Date.now();
        if (now - lastLogTime > 300000) { 
          logger.warn("[MarketData] No Upstox token found. Live data fetching is paused.");
          lastLogTime = now;
        }
        return;
      }

      const decryptedToken = decrypt(String(userToken.access_token));

      const stockKeys = stocks.map((s) => stockISINMap[s] || `NSE_EQ|${s}`);
      const indexKeys = Object.values(indexMap).flat();
      const allKeysList = [...stockKeys, ...indexKeys];
      
      // 🚀 FIX: Prevent encoding commas. Encode individual items, THEN join with comma
      const encodedKeys = allKeysList.map(k => encodeURIComponent(k)).join(",");

      const response = await fetch(
        `https://api.upstox.com/v2/market-quote/quotes?instrument_key=${encodedKeys}`,
        {
          headers: {
            Authorization: `Bearer ${decryptedToken}`,
            Accept: "application/json",
          },
          signal: AbortSignal.timeout(6000),
        }
      );

      if (!response.ok) {
        if (response.status === 401) {
          logger.warn("[MarketData] Upstox token expired (401). Clearing token.");
          await query("DELETE FROM user_tokens WHERE broker = 'upstox'");
          await query("UPDATE users SET is_uptox_connected = false WHERE id = $1", [userToken.user_id]);

          const payload = JSON.stringify({ type: "broker_disconnected", broker: "upstox" });
          wss.clients.forEach((c) => { if (c.readyState === WebSocket.OPEN) c.send(payload); });

          upstoxConsecutiveFailures = 0;
          upstoxBackoffUntil = 0;
        } else {
          upstoxConsecutiveFailures++;
          const backoffTime = Math.min(upstoxConsecutiveFailures * 5000, 60000);
          upstoxBackoffUntil = Date.now() + backoffTime;
          logger.warn(`[MarketData] Upstox API error ${response.status}. Backing off for ${backoffTime}ms.`);
        }
        return;
      }

      upstoxConsecutiveFailures = 0;
      upstoxBackoffUntil = 0;

      const data = await response.json();

      // 🚀 FIX: Catch silent empty data errors from Upstox
      if (data.status === "success" && data.data) {
        const returnedKeys = Object.keys(data.data);
        
        if (returnedKeys.length === 0) {
            logger.warn(`[MarketData] Upstox returned 200 OK but NO DATA for instruments. Out of market hours or invalid keys.`);
        }

        const reverseMap: Record<string, string> = {};
        Object.entries(indexMap).forEach(([internal, upstoxKeys]) => upstoxKeys.forEach((uk) => (reverseMap[uk] = internal)));
        Object.entries(stockISINMap).forEach(([symbol, isin]) => { reverseMap[isin] = symbol; });

        Object.keys(data.data).forEach((key) => {
          const price = data.data[key].last_price;
          if (!price) return;
          if (reverseMap[key]) {
             stockPrices[reverseMap[key]] = price;
          } else {
             const parts = key.split("|");
             if (parts.length > 1 && allSymbols.includes(parts[1])) {
               stockPrices[parts[1]] = price;
             }
          }
        });
      } else {
         logger.warn(`[MarketData] Unexpected format from Upstox: ${JSON.stringify(data)}`);
      }
    } catch (e) {
      upstoxConsecutiveFailures++;
      const backoffTime = Math.min(upstoxConsecutiveFailures * 5000, 60000);
      upstoxBackoffUntil = Date.now() + backoffTime;
      logger.error(`[MarketData] Upstox Fetch Error: ${e instanceof Error ? e.message : "Unknown"}. Backing off for ${backoffTime}ms.`);
    } finally {
      isFetchingUpstox = false;
    }
  };

  app.post("/api/market/refresh", authenticateToken, async (req: any, res: any, next: NextFunction) => {
      try {
        await fetchRealPrices();
        res.json({ success: true, last_prices: stockPrices });
      } catch (e) {
        next(e);
      }
    }
  );

  fetchRealPrices();
  setInterval(fetchRealPrices, 5000);

  let cachedTokenCount = 0;
  let lastTokenCountCheck = 0;

  setInterval(async () => {
    let isSimulated = false;
    const now = Date.now();
    
    try {
      if (now - lastTokenCountCheck > 10000) {
        const { rows } = await query("SELECT COUNT(*) as count FROM user_tokens");
        cachedTokenCount = parseInt(rows[0].count);
        lastTokenCountCheck = now;
      }

      if (cachedTokenCount === 0) {
        isSimulated = true;
        allSymbols.forEach((symbol) => {
          stockPrices[symbol] += stockPrices[symbol] * (Math.random() * 0.0002 - 0.0001);
        });
      }
    } catch (e) {
      logger.error("[MarketData] Error calculating simulated token count", e);
    }

    const payload = JSON.stringify({ type: "ticker", data: stockPrices, isSimulated });
    
    wss.clients.forEach((c) => {
      if (c.readyState === WebSocket.OPEN) c.send(payload);
    });
  }, 1000);

  app.get("/api/market-status", async (req, res, next) => {
    try {
      const { rows: countRows } = await query("SELECT COUNT(*) as count FROM user_tokens");
      const { rows: tokens } = await query("SELECT user_id, updated_at FROM user_tokens");
      res.json({
        is_fetching: parseInt(countRows[0].count) > 0,
        token_count: parseInt(countRows[0].count),
        tokens,
        last_prices: stockPrices,
        api_key_set: !!process.env.UPTOX_API_KEY,
        market_hours: { open: "09:15", close: "15:30", timezone: "Asia/Kolkata" },
      });
    } catch (e) {
      next(e);
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
    app.get("*", async (req, res, next) => {
      if (req.url.startsWith("/api")) return next();
      try {
        const html = await vite.transformIndexHtml(
          req.originalUrl,
          await fs.readFile(path.join(__dirname, "index.html"), "utf-8")
        );
        res.status(200).set({ "Content-Type": "text/html" }).end(html);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    const distPath = path.join(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => res.sendFile(path.join(distPath, "index.html")));
  }

  app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
      logger.error("Unhandled error", { error: err.message, stack: err.stack, path: req.path, method: req.method, userId: (req as any).user?.id });
      res.status(500).json({ error: "An internal server error occurred.", details: err.message || String(err) });
  });

  server.listen(3000, "0.0.0.0", () => {
    logger.info(`[Server] AAPA CAPITAL server running on http://0.0.0.0:3000`);
  });

  const gracefulShutdown = async (signal: string) => {
    logger.info(`[Server] Received ${signal}. Starting graceful shutdown...`);

    clearInterval(pingInterval);
    clearInterval(tokenRefreshInterval);

    server.close(() => { logger.info("[Server] HTTP server stopped accepting new requests."); });

    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: "system_shutdown", message: "Server shutting down for update or maintenance." }));
        client.close(1000, "Server shutting down gracefully");
      }
    });

    try { await pool.end(); } catch (err) {}
    try { if (redisConnected) await redisClient.quit(); } catch (err) {}

    process.exit(0);
  };

  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
}

startServer().catch((e) => {
  logger.error("Failed to start server", e);
});