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
import protobuf from "protobufjs";

// Removed Redis completely to prevent 500 crashes on flaky connections
import rateLimit, { ipKeyGenerator } from "express-rate-limit";

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

// --- MARKET HOURS UTILITY (IST) ---
const getMarketPhase = (): 'LIVE' | 'PRE_OPEN' | 'CLOSED' => {
  const now = new Date();
  
  // Format to IST strictly
  const options: Intl.DateTimeFormatOptions = { 
    timeZone: 'Asia/Kolkata', 
    hour: 'numeric', 
    minute: 'numeric', 
    hour12: false, 
    weekday: 'short' 
  };
  const formatter = new Intl.DateTimeFormat('en-US', options);
  const parts = formatter.formatToParts(now);

  let hour = 0, minute = 0, weekday = '';
  parts.forEach(p => {
    if (p.type === 'hour') hour = parseInt(p.value, 10);
    if (p.type === 'minute') minute = parseInt(p.value, 10);
    if (p.type === 'weekday') weekday = p.value;
  });

  // Weekends are closed
  if (weekday === 'Sat' || weekday === 'Sun') return 'CLOSED';

  const timeInMinutes = hour * 60 + minute;
  const preOpenStart = 9 * 60; // 09:00 AM IST
  const marketOpen = 9 * 60 + 15; // 09:15 AM IST
  const marketClose = 15 * 60 + 30; // 03:30 PM IST

  if (timeInMinutes >= preOpenStart && timeInMinutes < marketOpen) return 'PRE_OPEN';
  if (timeInMinutes >= marketOpen && timeInMinutes < marketClose) return 'LIVE';
  
  return 'CLOSED';
};

// --- PRECISE UPSTOX TOKEN EXPIRY (3:30 AM IST) ---
const getUpstoxTokenExpiry = () => {
  const now = new Date();
  const istTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  
  let target = new Date(istTime);
  target.setHours(3, 30, 0, 0);

  if (istTime.getTime() >= target.getTime()) {
    target.setDate(target.getDate() + 1);
  }

  const y = target.getFullYear();
  const m = String(target.getMonth() + 1).padStart(2, '0');
  const d = String(target.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}T03:30:00+05:30`;
};

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server });

  // =========================================================================
  // --- SYMBOL MAPPINGS & MARKET DATA INITIALIZATION ---
  // =========================================================================
  const primaryIndices = ["NIFTY 50", "SENSEX", "BANKNIFTY", "FINNIFTY", "MIDCAP NIFTY", "SMALLCAP NIFTY"];
  const secondaryIndices = ["NIFTY IT", "NIFTY AUTO", "NIFTY PHARMA", "NIFTY METAL", "NIFTY FMCG", "NIFTY REALTY"];
  const stocks = ["RELIANCE", "TCS", "HDFCBANK", "INFY", "ICICIBANK", "BHARTIARTL", "SBIN", "LICI", "ITC", "HINDUNILVR"];
  const allSymbols = [...primaryIndices, ...secondaryIndices, ...stocks];

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

  const resolveInstrumentKey = (key: string): string => {
    if (!key) return "";
    if (key.includes("|")) return key; 

    const upperKey = key.toUpperCase();
    for (const [internalName, brokerKeys] of Object.entries(indexMap)) {
      if (internalName.toUpperCase() === upperKey && brokerKeys.length > 0) {
        return brokerKeys[0]; 
      }
    }
    if (stockISINMap[upperKey]) return stockISINMap[upperKey];
    return key; 
  };

  const marketData: Record<string, any> = {};
  allSymbols.forEach((s) => {
    const ltp = Math.random() * 1000 + 100;
    const prevClose = ltp * (1 - (Math.random() * 0.04 - 0.02));
    marketData[s] = {
      symbol: s, ltp: ltp, prevClose: prevClose, open: ltp, high: ltp * 1.01, low: ltp * 0.99,
      day_change: ltp - prevClose,
      day_change_pct: prevClose ? ((ltp - prevClose) / prevClose) * 100 : 0
    };
  });

  const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret";
  const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "fallback-refresh-secret";

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

      ws.send(JSON.stringify({ 
        type: "ticker", 
        data: marketData,
        marketPhase: getMarketPhase() 
      }));

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

      const apiKey = process.env.UPTOX_API_KEY?.trim() ?? "";
      const apiSecret = process.env.UPTOX_API_SECRET?.trim() ?? "";
      
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
             
             const newExpiry = getUpstoxTokenExpiry();
             
             await query(
               `UPDATE user_tokens 
                SET access_token = $1, refresh_token = $2, expires_at = $3, updated_at = NOW() 
                WHERE user_id = $4 AND broker = 'upstox'`,
               [
                 encrypt(String(refreshData.access_token)),
                 newRefreshToken,
                 newExpiry,
                 tokenRow.user_id
               ]
             );
             logger.info(`[TokenRefresh] Refreshed token for user_id: ${tokenRow.user_id}. New expiry: ${newExpiry}`);
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
    process.env.VITE_APP_URL?.trim() || "https://aapacapital.com",
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

  const authLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 20,
    message: { error: "Too many login attempts. Please try again in 5 minutes." },
    standardHeaders: true,
    legacyHeaders: false,
  });

  const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 300,
    message: { error: "Too many requests. Please slow down." },
    standardHeaders: true,
    legacyHeaders: false,
  });

  const aiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
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
      // FIX: Sends 401 instead of 403, allowing the frontend apiClient to auto-refresh
      if (err) return res.sendStatus(401); 
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
        let { email, mobile, password, has_upstox } = req.body || {};
        email = email?.toString().toLowerCase().trim();
        mobile = mobile?.toString().trim();
        const hasUpstoxAccount = has_upstox === true;

        logger.info(`[Auth] Registration attempt for email: ${email}`);
        const hashedPassword = await bcrypt.hash(String(password), 10);
        
        let userCount = 0;
        try {
          const { rows: countRows } = await query("SELECT COUNT(*) as count FROM users");
          userCount = parseInt(countRows[0].count);
        } catch (dbErr: any) {
          logger.error(`[Auth DB Error] DB query failed during register: ${dbErr.message}`);
          return res.status(503).json({ error: "Database connection failed. If you are using a Supabase free tier, your database might be paused. Please wake it up." });
        }

        const superAdminEmail = "bharvadvijay371@gmail.com";
        const role = userCount === 0 || email === superAdminEmail 
          ? "admin" 
          : hasUpstoxAccount ? "user" : "pre-onboarding";

        const { rows: inserted } = await query(
          "INSERT INTO users (email, mobile, password, role, has_upstox_account, terms_accepted_at) VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING id",
          [email, mobile, hashedPassword, role, hasUpstoxAccount]
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

  app.post(
    "/api/auth/login", 
    (req, res, next) => {
      if (req.body && !req.body.login) {
        req.body.login = req.body.email || req.body.mobile;
      }
      next();
    },
    validate(loginSchema), 
    async (req: any, res: any, next: any) => {
      try {
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
          return res.status(503).json({ error: "Database connection failed. If you are using a Supabase free tier, your database might be paused. Please log into Supabase to wake it up." });
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
      // Expanded to include onboarding fields
      const { rows: userRows } = await query(
        "SELECT id, email, mobile, role, kyc_status, is_kyc_approved, balance, has_upstox_account, onboarding_step, first_login_completed_at FROM users WHERE id = $1",
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

      // Add derived property
      user.is_onboarding_complete = (user.onboarding_step ?? 0) >= 4;

      res.json({ ...user, balance, is_uptox_connected: !!userToken });
    } catch (e) { next(e); }
  });

  // PATCH /api/user/onboarding — Save onboarding step progress
  app.patch('/api/user/onboarding', authenticateToken, async (req: any, res: any) => {
    try {
      const userId = req.user.id;
      const { onboarding_step, first_login_completed_at } = req.body;
      const updates: string[] = [];
      const values: any[] = [];
      let paramCount = 1;

      if (onboarding_step !== undefined) {
        updates.push(`onboarding_step = $${paramCount++}`);
        values.push(onboarding_step);
      }

      if (first_login_completed_at !== undefined) {
        updates.push(`first_login_completed_at = $${paramCount++}`);
        values.push(first_login_completed_at);
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }

      updates.push(`updated_at = NOW()`);
      values.push(userId);

      await query(
        `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramCount}`,
        values
      );

      // Return updated profile (same shape as GET /api/user/profile)
      const result = await query(
        `SELECT id, email, mobile, role, balance, is_kyc_approved, kyc_status, has_upstox_account,
                onboarding_step, first_login_completed_at, created_at 
         FROM users WHERE id = $1`,
        [userId]
      );

      const updatedUser = result.rows[0];
      // Derive is_onboarding_complete flag
      updatedUser.is_onboarding_complete = (updatedUser.onboarding_step ?? 0) >= 4;

      return res.json(updatedUser);
    } catch (err) {
      logger.error('Error updating onboarding step:', err);
      return res.status(500).json({ error: 'Failed to update onboarding step' });
    }
  });

  app.get("/api/auth/uptox/url", authenticateToken, (req: any, res) => {
    const apiKey = process.env.UPTOX_API_KEY?.trim() ?? "";
    const redirectUri = process.env.UPTOX_REDIRECT_URI?.trim() ?? "";

    if (!apiKey || !redirectUri) return res.status(500).json({ error: "Upstox API Key or Redirect URI is missing in .env." });

    const state = req.headers.authorization?.split(" ")[1] || "";
    const url = `https://api.upstox.com/v2/login/authorization/dialog?response_type=code&client_id=${apiKey}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}`;
    res.json({ url });
  });

  app.get("/auth/callback", async (req, res, next) => {
    const { code, state } = req.query;
    if (!code) return res.status(400).send("No code provided.");

    const apiKey = process.env.UPTOX_API_KEY?.trim() ?? "";
    const apiSecret = process.env.UPTOX_API_SECRET?.trim() ?? "";
    const redirectUri = process.env.UPTOX_REDIRECT_URI?.trim() ?? "";

    const frontendTargetOrigin = process.env.VITE_APP_URL?.trim() || "*";

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
        code: String(code), 
        client_id: apiKey, 
        client_secret: apiSecret, 
        redirect_uri: redirectUri, 
        grant_type: "authorization_code",
      });

      const response = await fetch("https://api.upstox.com/v2/login/authorization/token", {
        method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" }, body: params,
      });

      const data = await response.json();

      if (!data.access_token) {
        logger.error("============= UPSTOX AUTH FAILURE =============");
        logger.error(`[Upstox Auth] Token Exchange Failed!`);
        logger.error(`[Upstox Auth] HTTP Status: ${response.status} ${response.statusText}`);
        logger.error(`[Upstox Auth] Error Payload: ${JSON.stringify(data)}`);
        logger.error(`[Upstox Auth] Redirect URI Sent: ${redirectUri}`);
        logger.error(`[Upstox Auth] Host/Protocol Detected: ${req.protocol}://${req.get('host')}`);
        logger.error("===============================================");
        
        return res.status(400).send(renderHtmlResponse(false, "Connection Failed!", { type: 'UPTOX_AUTH_ERROR', error: data }));
      }

      const userJwt = state ? String(state) : null;
      if (userJwt) {
        try {
          const decoded: any = jwt.verify(userJwt, JWT_SECRET);
          const userId = decoded.id;

          const newExpiry = getUpstoxTokenExpiry();

          await query(
            `INSERT INTO user_tokens (user_id, broker, access_token, refresh_token, expires_at)
             VALUES ($1, 'upstox', $2, $3, $4)
             ON CONFLICT (user_id, broker) DO UPDATE SET access_token = EXCLUDED.access_token, refresh_token = EXCLUDED.refresh_token, expires_at = EXCLUDED.expires_at`,
            [userId, encrypt(String(data.access_token)), encrypt(String(data.refresh_token || "")), newExpiry]
          );

          await query("UPDATE users SET is_uptox_connected = true WHERE id = $1", [userId]);
          
          initUpstoxWebSockets();

          return res.send(renderHtmlResponse(true, "Connection Successful! ✓", { type: 'UPTOX_AUTH_SUCCESS' }));
        } catch (jwtErr) { logger.warn("[OAuth Callback] Invalid state JWT, falling back to client-side save"); }
      }

      res.send(renderHtmlResponse(true, "Connection Successful!", { type: 'UPTOX_AUTH_SUCCESS', token: data.access_token, refresh_token: data.refresh_token || "" }));
    } catch (e) { next(e); }
  });

  app.post("/api/auth/uptox/save-token", authenticateToken, validate(upstoxSaveTokenSchema), async (req: any, res, next) => {
      try {
        const { access_token, refresh_token } = req.body;
        const newExpiry = getUpstoxTokenExpiry();
        
        await query(
          `INSERT INTO user_tokens (user_id, broker, access_token, refresh_token, expires_at) 
           VALUES ($1, 'upstox', $2, $3, $4) 
           ON CONFLICT (user_id, broker) DO UPDATE SET access_token = EXCLUDED.access_token, refresh_token = EXCLUDED.refresh_token, expires_at = EXCLUDED.expires_at`,
          [req.user.id, encrypt(String(access_token)), encrypt(String(refresh_token)), newExpiry]
        );
        await query("UPDATE users SET is_uptox_connected = true WHERE id = $1", [req.user.id]);
        
        initUpstoxWebSockets();
        res.json({ success: true });
      } catch (e) { next(e); }
    }
  );

  // --- IN-MEMORY CACHE FOR RAILWAY OPTIMIZATION ---
  const expiryCache: Record<string, { dates: string[], timestamp: number }> = {};
  const CACHE_TTL = 1000 * 60 * 60; // 1 Hour

  // --- STABILIZED: Dynamic Expiry Discovery Endpoint (With Field Fix & Fallback) ---
  app.get("/api/option-expiries", authenticateToken, async (req: any, res, next) => {
    try {
      let { instrument_key } = req.query;
      if (!instrument_key) return res.status(400).json({ status: "error", error: "Missing instrument_key" });

      const resolvedKey = resolveInstrumentKey(String(instrument_key));

      if (expiryCache[resolvedKey] && (Date.now() - expiryCache[resolvedKey].timestamp < CACHE_TTL)) {
        return res.json({ status: "success", data: expiryCache[resolvedKey].dates });
      }

      const { rows } = await query("SELECT access_token FROM user_tokens WHERE user_id = $1 AND broker = 'upstox'", [req.user.id]);
      const userToken = rows[0];

      if (!userToken || !userToken.access_token) {
        return res.status(400).json({ status: "error", error: "Please connect your Upstox account to fetch live expiries." });
      }

      const decryptedToken = decrypt(String(userToken.access_token));
      
      const response = await fetch(`https://api.upstox.com/v2/option/contract?instrument_key=${encodeURIComponent(resolvedKey)}`, {
        headers: { "Authorization": `Bearer ${decryptedToken}`, "Accept": "application/json" }
      });
      
      if (!response.ok) {
        logger.error(`[Upstox API] Expiry fetch failed with HTTP ${response.status} for ${resolvedKey}`);
        return res.status(response.status).json({ status: "error", error: "Broker API unavailable. Please try again later." });
      }

      const data = await response.json();
      
      if (data.status === 'success' && Array.isArray(data.data)) {
         const expirySet = new Set<string>();
         
         data.data.forEach((item: any) => {
           // FIX: Account for Upstox using 'expiry' instead of 'expiry_date' in this response payload
           const exp = item.expiry || item.expiry_date || item.expiryDate;
           if (exp) expirySet.add(exp);
         });
         
         let expiries = Array.from(expirySet).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
         
         // SMART FALLBACK: If Upstox returns an empty array or the schema changes entirely, calculate standard weekly dates
         if (expiries.length === 0) {
           logger.warn(`[Upstox API] No expiries could be parsed for ${resolvedKey}. Triggering Smart Fallback Engine.`);
           
           const getNextDayOfWeek = (date: Date, dayOfWeek: number) => {
              const resultDate = new Date(date.getTime());
              const diff = (7 + dayOfWeek - date.getDay()) % 7;
              resultDate.setDate(date.getDate() + (diff === 0 ? 7 : diff));
              return resultDate;
           };

           const today = new Date();
           const fallbackExpiries = [];
           
           let targetDay = 4; // Default Thursday (Nifty)
           if (resolvedKey.includes("Bank")) targetDay = 3; // Wednesday (BankNifty)
           if (resolvedKey.includes("Fin")) targetDay = 2; // Tuesday (FinNifty)
           if (resolvedKey.includes("Midcap")) targetDay = 1; // Monday
           if (resolvedKey.includes("SENSEX")) targetDay = 5; // Friday

           let nextExpiry = getNextDayOfWeek(today, targetDay);
           for (let i = 0; i < 4; i++) {
               const y = nextExpiry.getFullYear();
               const m = String(nextExpiry.getMonth() + 1).padStart(2, '0');
               const d = String(nextExpiry.getDate()).padStart(2, '0');
               fallbackExpiries.push(`${y}-${m}-${d}`);
               nextExpiry.setDate(nextExpiry.getDate() + 7);
           }
           expiries = fallbackExpiries;
         }

         expiryCache[resolvedKey] = { dates: expiries, timestamp: Date.now() };
         return res.json({ status: "success", data: expiries });
      } else {
         logger.warn(`[Upstox API] Unexpected data format for expiries:`, data);
         return res.status(400).json({ status: "error", error: data.errors?.[0]?.message || "Failed to fetch expiries." });
      }
    } catch (e: any) {
      logger.error("[Option Expiries] Server Exception:", e);
      res.status(500).json({ status: "error", error: "Server error fetching expiries", details: e.message });
    }
  });

  // --- STABILIZED: Option Chain API Endpoint (Sorted & Normalized) ---
  app.get("/api/option-chain", authenticateToken, async (req: any, res, next) => {
    try {
      let { instrument_key, expiry_date } = req.query;
      if (!instrument_key || !expiry_date) return res.status(400).json({ status: "error", error: "Missing instrument_key or expiry_date" });

      const resolvedKey = resolveInstrumentKey(String(instrument_key));

      const { rows } = await query("SELECT access_token FROM user_tokens WHERE user_id = $1 AND broker = 'upstox'", [req.user.id]);
      const userToken = rows[0];

      if (!userToken || !userToken.access_token) {
        return res.status(400).json({ status: "error", error: "Please connect your Upstox account to fetch option chain." });
      }

      const decryptedToken = decrypt(String(userToken.access_token));

      const response = await fetch(`https://api.upstox.com/v2/option/chain?instrument_key=${encodeURIComponent(resolvedKey)}&expiry_date=${expiry_date}`, {
        headers: { "Authorization": `Bearer ${decryptedToken}`, "Accept": "application/json" }
      });

      if (!response.ok) {
        logger.error(`[Upstox API] Chain fetch failed: HTTP ${response.status} for ${resolvedKey} / ${expiry_date}`);
        return res.status(response.status).json({ status: "error", error: "Broker API rate limited or unavailable." });
      }

      const data = await response.json();

      if (data.status === 'success' && Array.isArray(data.data)) {
         const formatVal = (val: number | undefined, divisor: number, suffix: string) => {
            if (val === undefined || val === null || isNaN(val)) return '-';
            if (val === 0) return '0';
            return (val / divisor).toFixed(1) + suffix;
         };

         const formatGreek = (val: number | undefined, decimalPlaces: number = 4) => {
            if (val === undefined || val === null || isNaN(val)) return '-';
            return val.toFixed(decimalPlaces);
         };

         const normalizedChain = data.data.map((item: any) => {
            const ce = item.call_options?.market_data;
            const pe = item.put_options?.market_data;
            const ceGreeks = item.call_options?.option_greeks;
            const peGreeks = item.put_options?.option_greeks;

            return {
               strike: item.strike_price,
               ce: {
                  ltp: ce?.ltp ?? null,
                  perc_change: ce?.perc_change ?? null,
                  oi_formatted: formatVal(ce?.oi, 100000, 'L'),
                  vol_formatted: formatVal(ce?.volume, 1000, 'K'),
                  is_active: ce?.ltp != null && ce?.ltp > 0,
                  iv: formatGreek(ceGreeks?.iv, 2),
                  delta: formatGreek(ceGreeks?.delta),
                  theta: formatGreek(ceGreeks?.theta),
                  vega: formatGreek(ceGreeks?.vega)
               },
               pe: {
                  ltp: pe?.ltp ?? null,
                  perc_change: pe?.perc_change ?? null,
                  oi_formatted: formatVal(pe?.oi, 100000, 'L'),
                  vol_formatted: formatVal(pe?.volume, 1000, 'K'),
                  is_active: pe?.ltp != null && pe?.ltp > 0,
                  iv: formatGreek(peGreeks?.iv, 2),
                  delta: formatGreek(peGreeks?.delta),
                  theta: formatGreek(peGreeks?.theta),
                  vega: formatGreek(peGreeks?.vega)
               }
            };
         });

         // STRICT SORTING: Always guarantee strikes are sorted ascending for the UI
         normalizedChain.sort((a: any, b: any) => a.strike - b.strike);

         return res.json({ status: "success", data: normalizedChain });
      }

      logger.warn(`[Upstox API] Malformed chain data for ${resolvedKey} / ${expiry_date}`, data);
      return res.status(400).json({ status: "error", error: data.errors?.[0]?.message || "Failed to normalize option chain." });
    } catch (e: any) {
      logger.error("[Option Chain] Server Exception:", e);
      res.status(500).json({ status: "error", error: "Server error fetching option chain", details: e.message });
    }
  });

  app.get("/api/portfolio", authenticateToken, async (req: any, res, next) => {
    try {
      const { rows: tokens } = await query("SELECT broker, access_token FROM user_tokens WHERE user_id = $1", [req.user.id]);
      
      let combinedHoldings: any[] = [];
      let combinedPositions: any[] = [];
      let totalFunds: number = 0;

      for (const token of tokens) {
        if (!token.access_token) continue;
        try {
          const decryptedToken = decrypt(String(token.access_token));
          if (!decryptedToken) continue;

          const brokerService = getBrokerService(String(token.broker));
          
          const [holdings, positions, funds] = await Promise.all([
            brokerService.getHoldings(decryptedToken).catch(() => []),
            brokerService.getPositions(decryptedToken).catch(() => []),
            brokerService.getFunds(decryptedToken).catch(() => 0)
          ]);

          combinedHoldings = [...combinedHoldings, ...holdings];
          combinedPositions = [...combinedPositions, ...positions];
          totalFunds += funds;

        } catch (e) { 
          logger.warn(`[Portfolio] ${token.broker} error:`, e); 
        }
      }

      res.json({
        holdings: combinedHoldings,
        positions: combinedPositions,
        funds: totalFunds
      });

    } catch (e: any) { 
      res.status(500).json({ error: "Failed to load portfolio", details: e.message || String(e) }); 
    }
  });

  // --- NEW: Orders API Endpoint for Story A4 ---
  app.get("/api/orders", authenticateToken, async (req: any, res, next) => {
    try {
      const { rows: tokens } = await query("SELECT broker, access_token FROM user_tokens WHERE user_id = $1", [req.user.id]);
      let combinedOrders: any[] = [];

      for (const token of tokens) {
        if (!token.access_token) continue;
        try {
          const decryptedToken = decrypt(String(token.access_token));
          if (!decryptedToken) continue;

          const brokerService = getBrokerService(String(token.broker)) as any;
          if (brokerService.getOrders) {
            const orders = await brokerService.getOrders(decryptedToken);
            combinedOrders = [...combinedOrders, ...orders];
          }
        } catch (e) {
          logger.warn(`[Orders] ${token.broker} error:`, e);
        }
      }
      
      combinedOrders.sort((a, b) => new Date(b.placed_at).getTime() - new Date(a.placed_at).getTime());
      res.json(combinedOrders);

    } catch (e: any) { 
      res.status(500).json({ error: "Failed to load orders", details: e.message || String(e) }); 
    }
  });

  // --- NEW: Dedicated Positions API Endpoint ---
  app.get("/api/positions", authenticateToken, async (req: any, res, next) => {
    try {
      const { rows: tokens } = await query("SELECT broker, access_token FROM user_tokens WHERE user_id = $1", [req.user.id]);
      let combinedPositions: any[] = [];

      for (const token of tokens) {
        if (!token.access_token) continue;
        try {
          const decryptedToken = decrypt(String(token.access_token));
          if (!decryptedToken) continue;

          const brokerService = getBrokerService(String(token.broker));
          const positions = await brokerService.getPositions(decryptedToken);
          combinedPositions = [...combinedPositions, ...positions];
        } catch (e) {
          logger.warn(`[Positions] ${token.broker} error:`, e);
        }
      }
      res.json(combinedPositions);
    } catch (e: any) { 
      res.status(500).json({ error: "Failed to load positions", details: e.message || String(e) }); 
    }
  });

  // --- MODIFIED: Story B4 Server-Side Translation for Order Entry ---
  const resolveOptionInstrumentKey = (underlying: string, expiryDateStr: string, strike: number, optType: string) => {
    const indexName = underlying.replace(' 50', '').replace(' ', '').toUpperCase(); 
    
    const date = new Date(expiryDateStr);
    const year = date.getFullYear().toString().slice(-2);
    const month = date.toLocaleString('en-US', { month: 'short' }).toUpperCase();
    const day = date.getDate().toString().padStart(2, '0');

    return `NSE_FO|${indexName}${year}${month}${day}${strike}${optType.toUpperCase()}`;
  };

  app.post("/api/orders", authenticateToken, requireKyc, validate(placeOrderSchema), async (req: any, res, next) => {
      try {
        const { rows: userRows } = await query("SELECT has_upstox_account, role FROM users WHERE id = $1", [req.user.id]);
        if (!userRows[0]?.has_upstox_account && userRows[0]?.role !== 'admin') {
           return res.status(403).json({ 
             requires_upstox: true, 
             message: "You must complete Upstox account opening to place orders." 
           });
        }
        
        const { symbol, type, order_type, quantity, price, product, expiry, strike, optionType } = req.body;
        const broker = 'upstox'; 
        const userId = req.user.id;
        
        const { rows } = await query("SELECT access_token FROM user_tokens WHERE user_id = $1 AND broker = $2", [userId, broker]);
        const userToken = rows[0];

        if (!userToken || !userToken.access_token) return res.status(400).json({ success: false, code: 'NO_BROKER', message: `Please connect your ${broker} account.` });

        const decryptedToken = decrypt(String(userToken.access_token));
        if (!decryptedToken) return res.status(500).json({ success: false, code: 'DECRYPTION_FAILED', message: "Failed to decrypt broker token." });

        let brokerSymbol = symbol;
        const friendlySymbol = strike && optionType ? `${symbol.replace(' 50', '')} ${strike} ${optionType}` : symbol;
        
        if (symbol.includes("|")) {
            brokerSymbol = symbol; 
        } else if (strike && optionType && expiry) {
            brokerSymbol = resolveOptionInstrumentKey(symbol, expiry, strike, optionType);
            logger.info(`[Order Translation] Translated structured option payload to strict broker token '${brokerSymbol}'`);
        }

        try {
          const brokerService = getBrokerService(String(broker));
          const orderRequest: OrderRequest = { symbol: brokerSymbol, type, order_type, quantity, price, product };
          const orderRes = await brokerService.placeOrder(decryptedToken, orderRequest);

          if (orderRes.success) {
            await query("INSERT INTO orders (user_id, symbol, type, order_type, quantity, price, broker, broker_order_id, status, raw_broker_response) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'completed', $9)",
              [userId, friendlySymbol, type, order_type, quantity, price, broker, orderRes.order_id, JSON.stringify(orderRes.raw_response)]);
            return res.json({ success: true, order_id: orderRes.order_id });
          } else {
            // --- ENHANCED STRUCTURED ERROR HANDLING ---
            const upstoxErr = orderRes.raw_response?.errors?.[0];
            const rawErrorCode = upstoxErr?.errorCode || 'ORDER_FAILED';
            const errorMsg = upstoxErr?.message || orderRes.error || "Order failed";

            // Identify margin/fund issues based on Upstox response messages
            const isMarginError = errorMsg.toLowerCase().includes('margin') || errorMsg.toLowerCase().includes('fund');
            const finalCode = isMarginError ? 'INSUFFICIENT_MARGIN' : rawErrorCode;

            await query("INSERT INTO orders (user_id, symbol, type, order_type, quantity, price, broker, status, failed_reason, raw_broker_response) VALUES ($1, $2, $3, $4, $5, $6, $7, 'failed', $8, $9)",
              [userId, friendlySymbol, type, order_type, quantity, price, broker, errorMsg, JSON.stringify(orderRes.raw_response)]);
            
            return res.status(400).json({ 
              success: false, 
              code: finalCode, 
              message: errorMsg 
            });
          }
        } catch (e: any) {
          await query("INSERT INTO orders (user_id, symbol, type, order_type, quantity, price, broker, status, failed_reason, raw_broker_response) VALUES ($1, $2, $3, $4, $5, $6, $7, 'failed', $8, $9)",
            [userId, friendlySymbol, type, order_type, quantity, price, broker, e.message, JSON.stringify({ error: e.message })]);
          
          // Return standard JSON instead of throwing to prevent unhandled 500 crashes
          return res.status(500).json({ 
            success: false, 
            code: 'INTERNAL_BROKER_ERROR', 
            message: `Broker API Error: ${e.message}` 
          });
        }
      } catch (e) { next(e); }
    }
  );

  // =========================================================================
  // UPSTOX WEBSOCKET INTEGRATION FOR LIVE DATA (MARKET & PORTFOLIO)
  // =========================================================================

  let upstoxMarketWs: WebSocket | null = null;
  let upstoxPortfolioWs: WebSocket | null = null;

  const purgeInvalidToken = async (userId: number, reason: string) => {
    logger.warn(`[Upstox] Purging token for user ${userId}. Reason: ${reason}`);
    
    if (reason.includes('401') || reason.includes('rejected')) {
      logger.warn(`[Upstox Auth Note] Upstox access tokens rigidly expire at 3:30 AM IST. User must log in again.`);
    }

    await query("DELETE FROM user_tokens WHERE broker = 'upstox' AND user_id = $1", [userId]);
    await query("UPDATE users SET is_uptox_connected = false WHERE id = $1", [userId]);

    const payload = JSON.stringify({ type: "broker_disconnected", broker: "upstox" });
    wss.clients.forEach((c) => { if (c.readyState === WebSocket.OPEN) c.send(payload); });

    setTimeout(initUpstoxWebSockets, 3000);
  };

  const initUpstoxWebSockets = async () => {
    try {
      const { rows } = await query("SELECT user_id, access_token FROM user_tokens WHERE broker = 'upstox' ORDER BY updated_at DESC LIMIT 1");
      const userToken = rows[0];
      
      if (!userToken || !userToken.access_token) {
        logger.warn("[MarketData] No Upstox token found in DB.");
        return;
      }

      const decryptedToken = decrypt(String(userToken.access_token));
      
      if (!decryptedToken) {
        await purgeInvalidToken(userToken.user_id, "Failed to decrypt token");
        return;
      }

      await initMarketDataFeed(decryptedToken, userToken.user_id);
      await initPortfolioFeed(decryptedToken, userToken.user_id);

    } catch (e) {
      logger.error("Failed to initialize Upstox WebSockets", e);
    }
  };

  const initMarketDataFeed = async (token: string, userId: number) => {
    try {
      const stockKeys = stocks.map((s) => stockISINMap[s] || `NSE_EQ|${s}`);
      const indexKeys = Object.values(indexMap).flat();
      const allKeysList = [...stockKeys, ...indexKeys];

      // =========================================================================
      // 1. FETCH INITIAL SNAPSHOT (Gets closing prices if market is closed)
      // =========================================================================
      try {
        const encodedKeys = allKeysList.map(k => encodeURIComponent(k)).join(",");
        
        // Upgraded from /ltp to /quotes to get OHLC data
        const quoteRes = await fetch(`https://api.upstox.com/v3/market-quote/quotes?instrument_key=${encodedKeys}`, {
          headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }
        });

        if (quoteRes.ok) {
          const quoteData = await quoteRes.json();
          const reverseMap: Record<string, string> = {};
          Object.entries(indexMap).forEach(([internal, upstoxKeys]) => upstoxKeys.forEach((uk) => (reverseMap[uk] = internal)));
          Object.entries(stockISINMap).forEach(([symbol, isin]) => { reverseMap[isin] = symbol; });

          if (quoteData.data) {
            let updated = false;
            Object.keys(quoteData.data).forEach((key) => {
              const item = quoteData.data[key];
              const ltp = item.last_price || item.price;
              const prevClose = item.ohlc?.close || ltp;
              const open = item.ohlc?.open || ltp;
              const high = item.ohlc?.high || ltp;
              const low = item.ohlc?.low || ltp;
              
              if (ltp) {
                const symbol = reverseMap[key] || (key.includes('|') ? key.split('|')[1] : null);
                if (symbol && allSymbols.includes(symbol)) {
                  marketData[symbol] = {
      ...marketData[symbol],
      symbol, ltp, prevClose, open, high, low,
      day_change: ltp - prevClose,
      day_change_pct: prevClose ? ((ltp - prevClose) / prevClose) * 100 : 0
    };
                  updated = true;
                }
              }
            });
            
            if (updated) {
              const wsPayload = JSON.stringify({ 
                type: "ticker", 
                data: marketData, 
                marketPhase: getMarketPhase()
              });
              wss.clients.forEach((c) => { if (c.readyState === WebSocket.OPEN) c.send(wsPayload); });
            }
          }
        }
      } catch (snapshotErr) {
        logger.warn("[Upstox] Failed to fetch initial V3 Quotes snapshot", snapshotErr);
      }

      // =========================================================================
      // 2. CONNECT WEBSOCKET (Listens for live ticks when market is open)
      // =========================================================================
      const authRes = await fetch("https://api.upstox.com/v3/feed/market-data-feed/authorize", {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      });

      if (!authRes.ok) {
        await purgeInvalidToken(userId, `Market API rejected token (Status: ${authRes.status})`);
        return;
      }

      const authData = await authRes.json();
      
      if (!authData?.data?.authorized_redirect_uri) {
         await purgeInvalidToken(userId, "Missing redirect URI in Upstox response");
         return;
      }

      let root;
      try {
        const protoPath = path.join(process.cwd(), "MarketDataFeed.proto");
        root = await protobuf.load(protoPath);
      } catch (protoErr: any) {
        logger.error(`[Upstox WS] Protobuf file error: ${protoErr.message}. Ensure MarketDataFeed.proto is in the project root.`);
        return;
      }
      
      const FeedResponse = root.lookupType("com.upstox.marketdatafeederv3udapi.rpc.proto.FeedResponse");

      upstoxMarketWs = new WebSocket(authData.data.authorized_redirect_uri);
      upstoxMarketWs.binaryType = "nodebuffer"; 

      upstoxMarketWs.on("open", () => {
        const currentPhase = getMarketPhase();
        logger.info(`[Upstox WS] Market Data Connected. Market is currently ${currentPhase}.`);
        
        const requestPayload = {
          guid: "aapa-market-data",
          method: "sub",
          data: {
            mode: "full",
            instrumentKeys: allKeysList
          }
        };
        
        // FIX: Add 1-second delay before subscribing to prevent race-condition disconnects
        setTimeout(() => {
           if (upstoxMarketWs && upstoxMarketWs.readyState === WebSocket.OPEN) {
              upstoxMarketWs.send(Buffer.from(JSON.stringify(requestPayload)));
           }
        }, 1000);
      });

      upstoxMarketWs.on("message", (data: any) => {
        try {
          const decoded = FeedResponse.decode(data as Buffer);
          const payload = FeedResponse.toObject(decoded, { enums: String, bytes: String });
          
          const reverseMap: Record<string, string> = {};
          Object.entries(indexMap).forEach(([internal, upstoxKeys]) => upstoxKeys.forEach((uk) => (reverseMap[uk] = internal)));
          Object.entries(stockISINMap).forEach(([symbol, isin]) => { reverseMap[isin] = symbol; });

          let updated = false;
          
          if (payload.feeds) {
            Object.entries(payload.feeds).forEach(([key, feedData]: [string, any]) => {
              
              const price = 
                feedData?.fullFeed?.marketFF?.ltpc?.ltp || 
                feedData?.fullFeed?.indexFF?.ltpc?.ltp || 
                feedData?.ltpc?.ltp ||
                feedData?.firstLevelWithGreeks?.ltpc?.ltp;
              
              if (price) {
                const symbol = reverseMap[key] || (key.includes('|') ? key.split('|')[1] : null);
                if (symbol && allSymbols.includes(symbol)) {
                  const prevClose = marketData[symbol]?.prevClose || price;
                  marketData[symbol] = {
      ...marketData[symbol],
      ltp: price,
      day_change: price - prevClose,
      day_change_pct: prevClose ? ((price - prevClose) / prevClose) * 100 : 0
    };
                  updated = true;
                }
              }
            });
          }

          if (updated) {
            const wsPayload = JSON.stringify({ 
              type: "ticker", 
              data: marketData, 
              marketPhase: getMarketPhase() 
            });
            wss.clients.forEach((c) => { if (c.readyState === WebSocket.OPEN) c.send(wsPayload); });
          }

        } catch (err) {
          // Suppress verbose protobuf decode warnings
        }
      });

      upstoxMarketWs.on("close", (code, reason) => {
        logger.warn(`[Upstox WS] Market Data Closed. Code: ${code}, Reason: ${reason?.toString() || 'Unknown'}. Reconnecting in 5s...`);
        setTimeout(() => initMarketDataFeed(token, userId), 5000);
      });

      upstoxMarketWs.on("error", (err: any) => {
        logger.error(`[Upstox WS] Market WS Error: ${err.message || String(err)}`);
      });

    } catch (err) {
      logger.error("[Upstox WS] Market Feed Init Error", err);
    }
  };

  const initPortfolioFeed = async (token: string, userId: number) => {
    try {
      const authRes = await fetch("https://api.upstox.com/v2/feed/portfolio-stream-feed/authorize", {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      });
      
      if (!authRes.ok) return; 

      const authData = await authRes.json();
      
      if (!authData?.data?.authorized_redirect_uri) return;

      upstoxPortfolioWs = new WebSocket(authData.data.authorized_redirect_uri);

      upstoxPortfolioWs.on("open", () => {
        logger.info("[Upstox WS] Portfolio Stream Connected.");
      });

      upstoxPortfolioWs.on("message", (data: any) => {
        try {
          const payload = JSON.parse(data.toString());
          if (payload.update_type === 'order') {
            const wsPayload = JSON.stringify({ type: "order_update", data: payload });
            wss.clients.forEach((c) => { if (c.readyState === WebSocket.OPEN) c.send(wsPayload); });
          }
        } catch (err) {
          logger.warn("[Upstox WS] Portfolio Feed Parse Error");
        }
      });

      upstoxPortfolioWs.on("close", () => {
        setTimeout(() => initPortfolioFeed(token, userId), 5000);
      });

      upstoxPortfolioWs.on("error", (err) => {});

    } catch (err) {
      logger.error("[Upstox WS] Portfolio Feed Init Error", err);
    }
  };


  app.post("/api/market/refresh", authenticateToken, async (req: any, res: any, next: NextFunction) => {
      try {
        initUpstoxWebSockets();
        res.json({ success: true, message: "Requested WebSocket reconnection.", last_prices: marketData });
      } catch (e) {
        next(e);
      }
    }
  );

  try {
    initUpstoxWebSockets();
  } catch (err) {
    logger.error("Failed to start initial websockets", err);
  }

  let cachedTokenCount = 0;
  let lastTokenCountCheck = 0;

  setInterval(async () => {
    const now = Date.now();
    const currentPhase = getMarketPhase();
    
    try {
      if (now - lastTokenCountCheck > 10000) {
        const { rows } = await query("SELECT COUNT(*) as count FROM user_tokens WHERE broker = 'upstox'");
        cachedTokenCount = parseInt(rows[0].count);
        lastTokenCountCheck = now;
      }

      if (cachedTokenCount === 0) {
        if (currentPhase === 'LIVE') {
          allSymbols.forEach((symbol) => {
            const oldLtp = marketData[symbol].ltp;
            const newLtp = oldLtp + oldLtp * (Math.random() * 0.0002 - 0.0001);
            const prevClose = marketData[symbol].prevClose;
            
            marketData[symbol].ltp = newLtp;
            marketData[symbol].day_change = newLtp - prevClose;
    marketData[symbol].day_change_pct = prevClose ? ((newLtp - prevClose) / prevClose) * 100 : 0;
          });
        }
        
        const payload = JSON.stringify({ 
          type: "ticker", 
          data: marketData, 
          marketPhase: currentPhase 
        });
        wss.clients.forEach((c) => {
          if (c.readyState === WebSocket.OPEN) c.send(payload);
        });
      } else {
        const payload = JSON.stringify({ 
          type: "ticker", 
          data: marketData, 
          marketPhase: currentPhase 
        });
        wss.clients.forEach((c) => {
          if (c.readyState === WebSocket.OPEN) c.send(payload);
        });
      }
    } catch (e) {
      logger.error("[MarketData] Error calculating simulated token count", e);
    }
  }, 1000);

  // --- MARKET STATUS & HEALTH CHECK ENDPOINT ---
  app.get("/api/market-status", async (req, res, next) => {
    try {
      const apiKeySet = !!process.env.UPTOX_API_KEY;
      const apiSecretSet = !!process.env.UPTOX_API_SECRET;
      const redirectUriSet = !!process.env.UPTOX_REDIRECT_URI;
      const frontEndUrlSet = !!process.env.VITE_APP_URL;

      const { rows: countRows } = await query("SELECT COUNT(*) as count FROM user_tokens");
      const { rows: tokens } = await query("SELECT user_id, updated_at FROM user_tokens");
      
      res.json({
        status: "ok",
        api_key_set: apiKeySet,
        api_secret_set: apiSecretSet,
        redirect_uri_set: redirectUriSet,
        frontend_url_set: frontEndUrlSet,
        environment: process.env.NODE_ENV || "development",
        is_fetching: (upstoxMarketWs && upstoxMarketWs.readyState === WebSocket.OPEN),
        token_count: parseInt(countRows[0].count),
        tokens,
        last_prices: marketData,
        market_hours: { open: "09:15", close: "15:30", timezone: "Asia/Kolkata" },
        market_phase: getMarketPhase(), 
        timestamp: new Date().toISOString()
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

    if (upstoxMarketWs) upstoxMarketWs.close();
    if (upstoxPortfolioWs) upstoxPortfolioWs.close();

    server.close(() => { logger.info("[Server] HTTP server stopped accepting new requests."); });

    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: "system_shutdown", message: "Server shutting down for update or maintenance." }));
        client.close(1000, "Server shutting down gracefully");
      }
    });

    try { await pool.end(); } catch (err) {}

    process.exit(0);
  };

  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
}

startServer().catch((e) => {
  logger.error("Failed to start server", e);
});