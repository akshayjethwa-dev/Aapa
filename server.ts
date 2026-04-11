import express from "express";
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
import rateLimit from "express-rate-limit";

// Import PostgreSQL Database setup
import { pool, query } from "./src/db/index"; 

// Zod Validation Imports
import { validate } from "./src/middleware/validate";
import { 
  registerSchema, 
  loginSchema, 
  placeOrderSchema, 
  angelOneLoginSchema, 
  upstoxSaveTokenSchema, 
  adminCreateUserSchema, 
  whitelistSchema 
} from "./src/validation/schemas";

// Logger Import
import { logger } from "./src/utils/logger";

// --- ENCRYPTION IMPORT ---
import { encrypt, decrypt } from "./src/utils/encryption";

// --- ADDED FOR TASK-013: Import KYC Middleware ---
import { requireKyc } from "./src/middleware/requireKyc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

// Run Migration & Seed Admin
const initDbAndSeed = async () => {
  try {
    const schemaPath = path.join(__dirname, "migrations", "001_initial_schema.sql");
    const schema = await fs.readFile(schemaPath, "utf8");
    await pool.query(schema);
    logger.info("[DB] PostgreSQL Schema 001 initialized successfully.");

    // Run Audit & Compliance Migration
    try {
      const migration2Path = path.join(__dirname, "migrations", "002_add_audit_compliance_fields.sql");
      const migration2 = await fs.readFile(migration2Path, "utf8");
      await pool.query(migration2);
      logger.info("[DB] PostgreSQL Schema 002 (Audit Fields) applied successfully.");
    } catch (migErr) {
      logger.warn("[DB] Skipping Migration 002: File not found or error.", migErr);
    }

    // Run Broker Audit Logging Migration
    try {
      const migration3Path = path.join(__dirname, "migrations", "003_add_broker_audit_logs.sql");
      const migration3 = await fs.readFile(migration3Path, "utf8");
      await pool.query(migration3);
      logger.info("[DB] PostgreSQL Schema 003 (Broker Audit Logs) applied successfully.");
    } catch (migErr) {
      logger.warn("[DB] Skipping Migration 003: File not found or error.", migErr);
    }

    // --- ADDED FOR TASK-013: Run KYC Migration ---
    try {
      const migration4Path = path.join(__dirname, "migrations", "004_add_kyc_fields.sql");
      const migration4 = await fs.readFile(migration4Path, "utf8");
      await pool.query(migration4);
      logger.info("[DB] PostgreSQL Schema 004 (KYC Fields) applied successfully.");
    } catch (migErr) {
      logger.warn("[DB] Skipping Migration 004: File not found or error.", migErr);
    }
    // ----------------------------------------------

    // --- ADDED FOR TASK-014: Run Terms Accepted Migration ---
    try {
      const migration5Path = path.join(__dirname, "migrations", "005_add_terms_accepted_field.sql");
      const migration5 = await fs.readFile(migration5Path, "utf8");
      await pool.query(migration5);
      logger.info("[DB] PostgreSQL Schema 005 (Terms Accepted) applied successfully.");
    } catch (migErr) {
      logger.warn("[DB] Skipping Migration 005: File not found or error.", migErr);
    }
    // ----------------------------------------------

    const admins = [
      { email: "bharvadvijay371@gmail.com", password: "Aniket@371" },
      { email: "dwarkeshtrading7@gmail.com", password: "Aniket@371" }
    ];

    for (const admin of admins) {
      const { rows } = await query("SELECT * FROM users WHERE email = $1", [admin.email]);
      const existing = rows[0];

      if (!existing) {
        const hashedPassword = await bcrypt.hash(admin.password, 10);
        await query(
          "INSERT INTO users (email, password, role, balance) VALUES ($1, $2, $3, $4)",
          [admin.email, hashedPassword, 'admin', 100000]
        );
        logger.info(`[Seed] Admin user created: ${admin.email}`);
      } else {
        await query("UPDATE users SET role = 'admin' WHERE email = $1", [admin.email]);
      }
    }
  } catch (error) {
    logger.error("[DB] Error initializing DB or seeding admins:", error);
  }
};

await initDbAndSeed();

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws, req) => {
    const ip = req.socket.remoteAddress;
    logger.info(`[WebSocket] New client connected from ${ip}. Total clients: ${wss.clients.size}`);
    
    ws.send(JSON.stringify({ type: 'ticker', data: stockPrices }));

    ws.on('close', () => {
      logger.info(`[WebSocket] Client disconnected. Remaining clients: ${wss.clients.size}`);
    });

    ws.on('error', (err) => {
      logger.error('[WebSocket] Client error:', err);
    });
  });

  app.set('trust proxy', 1); 

  app.use(express.json());
  app.use(cookieParser()); 

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
    standardHeaders: true,
    legacyHeaders: false,
  });

  const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    message: { error: 'Too many requests. Please slow down.' },
    standardHeaders: true,
    legacyHeaders: false,
  });

  const aiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    keyGenerator: (req: any) => req.user?.id || req.ip, 
    message: { error: 'AI signal limit reached. Please wait.' },
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.use('/api/auth', authLimiter);
  app.use('/api/ai', aiLimiter);
  app.use('/api', apiLimiter); 

  app.use((req, res, next) => {
    logger.info(`[HTTP] ${req.method} ${req.url}`);
    next();
  });

  const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret";
  const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "fallback-refresh-secret";

  const authenticateToken = (req: any, res: any, next: any) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
      if (err) return res.sendStatus(403);
      req.user = user;
      next();
    });
  };

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  app.post("/api/auth/register", validate(registerSchema), async (req, res, next) => {
    let { email, mobile, password } = req.body;
    email = email?.toLowerCase().trim();
    mobile = mobile?.trim();
    
    logger.info(`[Auth] Registration attempt for email: ${email}`);
    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      const { rows: countRows } = await query("SELECT COUNT(*) as count FROM users");
      const userCount = parseInt(countRows[0].count);
      const superAdminEmail = 'bharvadvijay371@gmail.com';
      const role = (userCount === 0 || email === superAdminEmail) ? 'admin' : 'user';
      
      const { rows: inserted } = await query(
        "INSERT INTO users (email, mobile, password, role, terms_accepted_at) VALUES ($1, $2, $3, $4, NOW()) RETURNING id",
        [email, mobile, hashedPassword, role]
      );
      
      logger.info(`[Auth] Registration successful for user ID: ${inserted[0].id} with role: ${role}`);
      res.json({ id: inserted[0].id });
    } catch (e: any) {
      if (e.code === '23505') {
        if (e.constraint === 'users_email_key') {
          return res.status(400).json({ error: "Email already registered. Please login instead." });
        }
        if (e.constraint === 'users_mobile_key') {
           return res.status(400).json({ error: "Mobile number already registered. Please login instead." });
        }
      }
      next(e);
    }
  });

  app.post("/api/auth/login", validate(loginSchema), async (req, res, next) => {
    let { login, password } = req.body;
    login = login?.toLowerCase().trim();
    logger.info(`[Auth] Login attempt for: ${login}`);
    try {
      const { rows } = await query("SELECT * FROM users WHERE email = $1 OR mobile = $1", [login]);
      const user = rows[0];
      
      if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      
      const superAdminEmail = 'bharvadvijay371@gmail.com';
      const effectiveRole = (user.email === superAdminEmail) ? 'admin' : user.role;
      
      const token = jwt.sign({ id: user.id, email: user.email, role: effectiveRole }, JWT_SECRET, { expiresIn: '15m' });
      const refreshToken = jwt.sign({ id: user.id }, JWT_REFRESH_SECRET, { expiresIn: '7d' });

      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000 
      });

      logger.info(`[Auth] Login successful for ${login} (ID: ${user.id}) with role: ${effectiveRole}`);
      res.json({ token, user: { id: user.id, email: user.email, role: effectiveRole, balance: parseFloat(user.balance) } });
    } catch (e: any) {
      next(e);
    }
  });

  app.post("/api/auth/refresh", async (req, res, next) => {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) return res.status(401).json({ error: "Refresh token required" });

    jwt.verify(refreshToken, JWT_REFRESH_SECRET, async (err: any, decoded: any) => {
      if (err) return res.status(403).json({ error: "Invalid or expired refresh token" });
      
      try {
        const { rows } = await query("SELECT id, email, role FROM users WHERE id = $1", [decoded.id]);
        const user = rows[0];
        if (!user) return res.status(403).json({ error: "User no longer exists" });

        const effectiveRole = (user.email === 'bharvadvijay371@gmail.com') ? 'admin' : user.role;
        
        const newToken = jwt.sign({ id: user.id, email: user.email, role: effectiveRole }, JWT_SECRET, { expiresIn: '15m' });
        res.json({ token: newToken });
      } catch (e) {
        next(e);
      }
    });
  });

  app.post("/api/auth/logout", (req, res) => {
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    });
    res.json({ success: true, message: "Logged out successfully" });
  });

  app.post("/api/auth/angelone/login", authenticateToken, validate(angelOneLoginSchema), async (req: any, res, next) => {
    const { clientCode, password, totp } = req.body;
    const apiKey = process.env.ANGEL_ONE_API_KEY;

    if (!apiKey) return res.status(500).json({ error: "ANGEL_ONE_API_KEY is missing." });

    try {
      const response = await fetch("https://apiconnect.angelone.in/rest/auth/angelone/user/v1/loginByPassword", {
        method: "POST",
        headers: {
          "X-PrivateKey": apiKey,
          "X-SourceID": "WEB",
          "X-ClientLocalIP": "192.168.1.1",
          "X-ClientPublicIP": "106.193.147.210",
          "X-MACAddress": "00-00-00-00-00-00",
          "Accept": "application/json",
          "X-UserType": "USER",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ clientCode, password, totp })
      });

      const data = await response.json();
      if (data.status && data.data && data.data.jwtToken) {
        const { jwtToken, refreshToken, feedToken } = data.data;
        
        await query(
          "INSERT INTO user_tokens (user_id, broker, access_token, refresh_token, feed_token) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (user_id, broker) DO UPDATE SET access_token = EXCLUDED.access_token, refresh_token = EXCLUDED.refresh_token, feed_token = EXCLUDED.feed_token",
          [req.user.id, 'angelone', encrypt(jwtToken), encrypt(refreshToken), encrypt(feedToken)]
        );
        
        await query("UPDATE users SET is_angelone_connected = true WHERE id = $1", [req.user.id]);
        res.json({ success: true, message: "Angel One connected successfully" });
      } else {
        res.status(400).json({ error: data.message || "Angel One login failed" });
      }
    } catch (e) {
      next(e);
    }
  });

  app.get("/api/admin/users", authenticateToken, async (req: any, res, next) => {
    if (req.user.role !== 'admin') return res.sendStatus(403);
    try {
      const { rows: users } = await query("SELECT id, email, mobile, role, balance, created_at FROM users ORDER BY created_at DESC");
      res.json(users);
    } catch (e) {
      next(e);
    }
  });

  app.post("/api/admin/users/:id/role", authenticateToken, async (req: any, res, next) => {
    if (req.user.role !== 'admin') return res.sendStatus(403);
    try {
      const { role } = req.body;
      const { id } = req.params;
      await query("UPDATE users SET role = $1 WHERE id = $2", [role, id]);
      res.json({ success: true });
    } catch (e) {
      next(e);
    }
  });

  app.get("/api/admin/whitelist", authenticateToken, async (req: any, res, next) => {
    if (req.user.role !== 'admin') return res.sendStatus(403);
    try {
      const { rows: list } = await query("SELECT * FROM beta_whitelist ORDER BY created_at DESC");
      res.json(list);
    } catch (e) {
      next(e);
    }
  });

  app.post("/api/admin/whitelist", authenticateToken, validate(whitelistSchema), async (req: any, res, next) => {
    if (req.user.role !== 'admin') return res.sendStatus(403);
    const { identifier } = req.body;
    try {
      await query("INSERT INTO beta_whitelist (identifier) VALUES ($1)", [identifier]);
      res.json({ success: true });
    } catch (e) {
      res.status(400).json({ error: "Already whitelisted" });
    }
  });

  app.delete("/api/admin/whitelist/:id", authenticateToken, async (req: any, res, next) => {
    if (req.user.role !== 'admin') return res.sendStatus(403);
    try {
      await query("DELETE FROM beta_whitelist WHERE id = $1", [req.params.id]);
      res.json({ success: true });
    } catch (e) {
      next(e);
    }
  });

  app.post("/api/admin/users/create", authenticateToken, validate(adminCreateUserSchema), async (req: any, res, next) => {
    if (req.user.role !== 'admin') return res.sendStatus(403);
    const { email, mobile, password, role } = req.body;
    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      const { rows } = await query(
        "INSERT INTO users (email, mobile, password, role) VALUES ($1, $2, $3, $4) RETURNING id",
        [email, mobile, hashedPassword, role]
      );
      res.json({ id: rows[0].id });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.get("/api/user/profile", authenticateToken, async (req: any, res, next) => {
    try {
      const { rows: userRows } = await query("SELECT id, email, mobile, role, kyc_status, is_kyc_approved, balance FROM users WHERE id = $1", [req.user.id]);
      const user = userRows[0];
      if (!user) return res.status(404).json({ error: "User not found" });
      
      const { rows: tokenRows } = await query("SELECT access_token FROM user_tokens WHERE user_id = $1 AND broker = 'upstox'", [req.user.id]);
      const userToken = tokenRows[0];
      
      let balance = parseFloat(user?.balance) || 0;
      if (userToken) {
        try {
          const decryptedToken = decrypt(userToken.access_token);
          const response = await fetch("https://api.upstox.com/v2/user/get-funds-and-margin", {
            headers: { "Authorization": `Bearer ${decryptedToken}`, "Accept": "application/json" }
          });
          const data = await response.json();
          if (data.status === 'success') balance = data.data.equity.available_margin;
        } catch (e) {
          logger.warn("Failed to fetch Upstox funds", e);
        }
      }

      res.json({ ...user, balance, is_uptox_connected: !!userToken });
    } catch (e) {
      next(e);
    }
  });

  app.get("/api/auth/uptox/url", (req, res) => {
    const apiKey = process.env.UPTOX_API_KEY;
    let redirectUri = process.env.UPTOX_REDIRECT_URI;
    
    const host = req.get('host') || "";
    const protocol = req.get('x-forwarded-proto') || req.protocol;
    const detectedUri = `${protocol}://${host}/auth/callback`;

    if (!redirectUri || !redirectUri.startsWith('http')) {
      redirectUri = detectedUri;
    }
    
    if (host.includes('ais-dev-kmtq2mfzcdgtjnm6loanhz')) {
       redirectUri = 'https://ais-dev-kmtq2mfzcdgtjnm6loanhz-448575883234.asia-southeast1.run.app/auth/callback';
    }
    
    if (!apiKey) return res.status(500).json({ error: "UPTOX_API_KEY is missing." });

    const url = `https://api.upstox.com/v2/login/authorization/dialog?response_type=code&client_id=${apiKey}&redirect_uri=${encodeURIComponent(redirectUri)}`;
    res.json({ url });
  });

  app.get("/auth/callback", async (req, res, next) => {
    const { code } = req.query;
    if (!code) return res.status(400).send("No code provided.");

    const apiKey = process.env.UPTOX_API_KEY;
    const apiSecret = process.env.UPTOX_API_SECRET;
    
    let redirectUri = process.env.UPTOX_REDIRECT_URI;
    if (!redirectUri || redirectUri.includes('ais-pre-') || redirectUri.includes('ais-dev-') || !redirectUri.startsWith('http')) {
      const host = req.get('host');
      const protocol = req.get('x-forwarded-proto') || req.protocol;
      redirectUri = `${protocol}://${host}/auth/callback`;
    }

    try {
      const response = await fetch("https://api.upstox.com/v2/login/authorization/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json" },
        body: new URLSearchParams({
          code: code as string,
          client_id: apiKey!,
          client_secret: apiSecret!,
          redirect_uri: redirectUri!,
          grant_type: "authorization_code",
        }),
      });

      const data = await response.json();
      if (data.access_token) {
        const allowedOrigin = process.env.NODE_ENV === 'production'
          ? (process.env.VITE_APP_URL || 'https://aapacapital.com') 
          : 'http://localhost:5173';

        res.send(`
          <html>
            <body style="background: #000; color: #fff; display: flex; align-items: center; justify-content: center; height: 100vh;">
              <div>
                <h2 style="color: #10b981;">Connection Successful!</h2>
                <script>
                  if (window.opener) {
                    window.opener.postMessage({ type: 'UPTOX_AUTH_SUCCESS', token: '${data.access_token}', refresh_token: '${data.refresh_token || ""}' }, '${allowedOrigin}');
                    setTimeout(() => window.close(), 2000);
                  }
                </script>
              </div>
            </body>
          </html>
        `);
      } else {
        res.status(400).json(data);
      }
    } catch (e) {
      next(e);
    }
  });

  app.post("/api/auth/uptox/save-token", authenticateToken, validate(upstoxSaveTokenSchema), async (req: any, res, next) => {
    try {
      const { access_token, refresh_token } = req.body;
      
      await query(
        "INSERT INTO user_tokens (user_id, broker, access_token, refresh_token) VALUES ($1, $2, $3, $4) ON CONFLICT (user_id, broker) DO UPDATE SET access_token = EXCLUDED.access_token, refresh_token = EXCLUDED.refresh_token",
        [req.user.id, 'upstox', encrypt(access_token), encrypt(refresh_token)]
      );
      await query("UPDATE users SET is_uptox_connected = true WHERE id = $1", [req.user.id]);
      
      // Reset backoff so it starts fetching immediately
      upstoxConsecutiveFailures = 0;
      upstoxBackoffUntil = 0;
      
      fetchRealPrices();
      res.json({ success: true });
    } catch (e) {
      next(e);
    }
  });

  app.get("/api/portfolio", authenticateToken, async (req: any, res, next) => {
    try {
      const { rows: tokens } = await query("SELECT broker, access_token FROM user_tokens WHERE user_id = $1", [req.user.id]);
      let combinedHoldings: any[] = [];
      
      for (const token of tokens) {
        const decryptedToken = decrypt(token.access_token);
        
        if (token.broker === 'upstox') {
          try {
            const response = await fetch("https://api.upstox.com/v2/portfolio/long-term-holdings", {
              headers: { "Authorization": `Bearer ${decryptedToken}`, "Accept": "application/json" }
            });
            const data = await response.json();
            if (data.status === 'success') {
              const holdings = data.data.map((h: any) => ({
                symbol: h.trading_symbol, quantity: h.quantity, average_price: h.average_price, current_price: h.last_price, broker: 'Upstox'
              }));
              combinedHoldings = [...combinedHoldings, ...holdings];
            }
          } catch (e) { logger.warn("Upstox holdings error", e); }
        } else if (token.broker === 'angelone') {
          try {
            const response = await fetch("https://apiconnect.angelone.in/rest/auth/angelone/portfolio/v1/getHolding", {
              headers: { "X-PrivateKey": process.env.ANGEL_ONE_API_KEY!, "X-SourceID": "WEB", "Authorization": `Bearer ${decryptedToken}`, "Content-Type": "application/json", "Accept": "application/json" }
            });
            const data = await response.json();
            if (data.status && data.data) {
              const holdings = data.data.map((h: any) => ({
                symbol: h.tradingsymbol, quantity: parseInt(h.quantity), average_price: parseFloat(h.averageprice), current_price: parseFloat(h.ltp), broker: 'Angel One'
              }));
              combinedHoldings = [...combinedHoldings, ...holdings];
            }
          } catch (e) { logger.warn("Angel One holdings error", e); }
        }
      }
      
      if (combinedHoldings.length > 0) return res.json(combinedHoldings);
      const { rows: localHoldings } = await query("SELECT *, 'Local' as broker FROM portfolios WHERE user_id = $1", [req.user.id]);
      res.json(localHoldings);
    } catch (e) {
      next(e);
    }
  });

  app.post("/api/orders", authenticateToken, requireKyc, validate(placeOrderSchema), async (req: any, res, next) => {
    try {
      const { symbol, type, order_type, quantity, price, product, broker } = req.body;
      const userId = req.user.id;
      const { rows } = await query("SELECT access_token FROM user_tokens WHERE user_id = $1 AND broker = $2", [userId, broker]);
      const userToken = rows[0];

      if (!userToken) return res.status(400).json({ error: `Please connect your ${broker} account.` });
      
      const decryptedToken = decrypt(userToken.access_token);

      if (broker === 'upstox') {
        try {
          const response = await fetch("https://api.upstox.com/v2/order/place", {
            method: "POST",
            headers: { "Authorization": `Bearer ${decryptedToken}`, "Content-Type": "application/json", "Accept": "application/json" },
            body: JSON.stringify({
              quantity, product: product.toUpperCase() === 'INTRADAY' ? 'I' : 'D', validity: 'DAY', price,
              tag: 'AAPA_APP', instrument_token: symbol.includes('|') ? symbol : `NSE_EQ|${symbol}`, order_type: order_type.toUpperCase(), 
              transaction_type: type.toUpperCase(), disclosed_quantity: 0, trigger_price: 0, is_amo: false
            })
          });
          const data = await response.json();

          if (data.status === 'success') {
            await query(
              "INSERT INTO orders (user_id, symbol, type, order_type, quantity, price, broker, broker_order_id, status, raw_broker_response) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'completed', $9)", 
              [userId, symbol, type, order_type, quantity, price, broker, data.data.order_id, JSON.stringify(data)]
            );
            return res.json({ success: true, order_id: data.data.order_id });
          }
          
          const errorMsg = data.errors?.[0]?.message || "Upstox order failed";
          await query(
            "INSERT INTO orders (user_id, symbol, type, order_type, quantity, price, broker, status, failed_reason, raw_broker_response) VALUES ($1, $2, $3, $4, $5, $6, $7, 'failed', $8, $9)", 
            [userId, symbol, type, order_type, quantity, price, broker, errorMsg, JSON.stringify(data)]
          );
          return res.status(400).json({ error: errorMsg });

        } catch (e: any) { 
          await query(
            "INSERT INTO orders (user_id, symbol, type, order_type, quantity, price, broker, status, failed_reason, raw_broker_response) VALUES ($1, $2, $3, $4, $5, $6, $7, 'failed', $8, $9)", 
            [userId, symbol, type, order_type, quantity, price, broker, e.message, JSON.stringify({ error: e.message })]
          );
          throw new Error("Upstox API Error");
        }
      } else if (broker === 'angelone') {
        try {
          const response = await fetch("https://apiconnect.angelone.in/rest/auth/angelone/order/v1/placeOrder", {
            method: "POST",
            headers: { "X-PrivateKey": process.env.ANGEL_ONE_API_KEY!, "X-SourceID": "WEB", "Authorization": `Bearer ${decryptedToken}`, "Content-Type": "application/json", "Accept": "application/json" },
            body: JSON.stringify({
              variety: "NORMAL", tradingsymbol: symbol, symboltoken: ANGEL_ONE_TOKENS[symbol] || "3045", transactiontype: type.toUpperCase(),
              exchange: symbol.includes('NIFTY') || symbol.includes('BANK') ? "NFO" : "NSE", ordertype: order_type.toUpperCase(), producttype: product.toUpperCase() === 'INTRADAY' ? 'INTRADAY' : 'DELIVERY',
              duration: "DAY", price, squareoff: "0", stoploss: "0", quantity: quantity.toString()
            })
          });
          const data = await response.json();

          if (data.status && data.data && data.data.orderid) {
            await query(
              "INSERT INTO orders (user_id, symbol, type, order_type, quantity, price, broker, broker_order_id, status, raw_broker_response) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'completed', $9)", 
              [userId, symbol, type, order_type, quantity, price, broker, data.data.orderid, JSON.stringify(data)]
            );
            return res.json({ success: true, order_id: data.data.orderid });
          }

          const errorMsg = data.message || "Angel One order failed";
          await query(
            "INSERT INTO orders (user_id, symbol, type, order_type, quantity, price, broker, status, failed_reason, raw_broker_response) VALUES ($1, $2, $3, $4, $5, $6, $7, 'failed', $8, $9)", 
            [userId, symbol, type, order_type, quantity, price, broker, errorMsg, JSON.stringify(data)]
          );
          return res.status(400).json({ error: errorMsg });
          
        } catch (e: any) { 
          await query(
            "INSERT INTO orders (user_id, symbol, type, order_type, quantity, price, broker, status, failed_reason, raw_broker_response) VALUES ($1, $2, $3, $4, $5, $6, $7, 'failed', $8, $9)", 
            [userId, symbol, type, order_type, quantity, price, broker, e.message, JSON.stringify({ error: e.message })]
          );
          throw new Error("Angel One API error");
        }
      }
    } catch (e) {
      next(e);
    }
  });

  // Market Data Arrays
  const primaryIndices = ["NIFTY 50", "SENSEX", "BANKNIFTY", "FINNIFTY", "MIDCAP NIFTY", "SMALLCAP NIFTY"];
  const secondaryIndices = ["NIFTY IT", "NIFTY AUTO", "NIFTY PHARMA", "NIFTY METAL", "NIFTY FMCG", "NIFTY REALTY"];
  const stocks = ["RELIANCE", "TCS", "HDFCBANK", "INFY", "ICICIBANK", "BHARTIARTL", "SBIN", "LICI", "ITC", "HINDUNILVR"];
  const allSymbols = [...primaryIndices, ...secondaryIndices, ...stocks];
  
  const ANGEL_ONE_TOKENS: Record<string, string> = { "RELIANCE": "2885", "TCS": "11536", "HDFCBANK": "1333", "INFY": "1594", "ICICIBANK": "4963", "BHARTIARTL": "10604", "SBIN": "3045", "LICI": "11802", "ITC": "1660", "HINDUNILVR": "1330", "NIFTY 50": "99926000", "BANKNIFTY": "99926009", "FINNIFTY": "99926037", "SENSEX": "99919000" };
  const stockPrices: Record<string, number> = { "NIFTY 50": 22145.20, "SENSEX": 72850.40, "BANKNIFTY": 46800.15, "FINNIFTY": 20850.60, "MIDCAP NIFTY": 10920.45, "SMALLCAP NIFTY": 16150.30, "NIFTY IT": 37850.20, "NIFTY AUTO": 20150.40, "NIFTY PHARMA": 18920.15, "NIFTY METAL": 7950.60, "NIFTY FMCG": 54120.30, "NIFTY REALTY": 890.45, "RELIANCE": 2985.40, "TCS": 4120.15, "HDFCBANK": 1450.60, "INFY": 1680.40, "ICICIBANK": 1050.20, "BHARTIARTL": 1120.30, "SBIN": 750.45, "LICI": 940.20, "ITC": 410.15, "HINDUNILVR": 2380.60 };
  allSymbols.forEach(s => { if (!stockPrices[s]) stockPrices[s] = Math.random() * 1000 + 100; });
  const indexMap: Record<string, string[]> = { 'NIFTY 50': ['NSE_INDEX|Nifty 50', 'NSE_INDEX|NIFTY 50'], 'BANKNIFTY': ['NSE_INDEX|Nifty Bank', 'NSE_INDEX|NIFTY BANK'], 'FINNIFTY': ['NSE_INDEX|Nifty Fin Service', 'NSE_INDEX|NIFTY FIN SERVICE'], 'MIDCAP NIFTY': ['NSE_INDEX|Nifty Midcap 100', 'NSE_INDEX|NIFTY MIDCAP 100'], 'SENSEX': ['BSE_INDEX|SENSEX', 'BSE_INDEX|Sensex'], 'SMALLCAP NIFTY': ['NSE_INDEX|Nifty Smallcap 100', 'NSE_INDEX|NIFTY SMALLCAP 100'], 'NIFTY IT': ['NSE_INDEX|Nifty IT', 'NSE_INDEX|NIFTY IT'], 'NIFTY AUTO': ['NSE_INDEX|Nifty Auto', 'NSE_INDEX|NIFTY AUTO'], 'NIFTY PHARMA': ['NSE_INDEX|Nifty Pharma', 'NSE_INDEX|NIFTY PHARMA'], 'NIFTY METAL': ['NSE_INDEX|Nifty Metal', 'NSE_INDEX|NIFTY METAL'], 'NIFTY FMCG': ['NSE_INDEX|Nifty FMCG', 'NSE_INDEX|NIFTY FMCG'], 'NIFTY REALTY': ['NSE_INDEX|Nifty Realty', 'NSE_INDEX|NIFTY REALTY'] };

  // --- API Loop Stabilization ---
  let isFetchingUpstox = false;
  let upstoxConsecutiveFailures = 0;
  let upstoxBackoffUntil = 0;

  const fetchRealPrices = async () => {
    if (isFetchingUpstox) return;
    if (Date.now() < upstoxBackoffUntil) return; 

    isFetchingUpstox = true;
    try {
      const { rows } = await query("SELECT user_id, access_token FROM user_tokens WHERE broker = 'upstox' LIMIT 1");
      const userToken = rows[0];
      if (!userToken) return;

      const decryptedToken = decrypt(userToken.access_token);

      const stockKeys = stocks.map(s => `NSE_EQ|${s}`);
      const indexKeys = Object.values(indexMap).flat();
      const allKeys = [...stockKeys, ...indexKeys].join(',');
      
      const response = await fetch(`https://api.upstox.com/v2/market-quote/quotes?instrument_key=${allKeys}`, { 
        headers: { "Authorization": `Bearer ${decryptedToken}`, "Accept": "application/json" }, 
        signal: AbortSignal.timeout(4000) 
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          logger.warn("[MarketData] Upstox token expired (401). Clearing token.");
          await query("DELETE FROM user_tokens WHERE broker = 'upstox'");
          await query("UPDATE users SET is_uptox_connected = false WHERE id = $1", [userToken.user_id]);
          
          const payload = JSON.stringify({ type: 'broker_disconnected', broker: 'upstox' });
          wss.clients.forEach(c => { if (c.readyState === WebSocket.OPEN) c.send(payload); });
          
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
      if (data.status === 'success' && data.data) {
        const reverseMap: Record<string, string> = {};
        Object.entries(indexMap).forEach(([internal, upstoxKeys]) => upstoxKeys.forEach(uk => reverseMap[uk] = internal));
        Object.keys(data.data).forEach(key => {
          const price = data.data[key].last_price;
          if (!price) return;
          if (reverseMap[key]) stockPrices[reverseMap[key]] = price;
          else if (allSymbols.includes(key.split('|')[1])) stockPrices[key.split('|')[1]] = price;
        });
      }
    } catch (e) { 
      upstoxConsecutiveFailures++;
      const backoffTime = Math.min(upstoxConsecutiveFailures * 5000, 60000);
      upstoxBackoffUntil = Date.now() + backoffTime;
      logger.error(`[MarketData] Upstox Fetch Error: ${e instanceof Error ? e.message : 'Unknown'}. Backing off for ${backoffTime}ms.`);
    } finally { 
      isFetchingUpstox = false; 
    }
  };

  let isFetchingAngel = false;
  const fetchAngelOnePrices = async () => {
    if (isFetchingAngel) return;
    isFetchingAngel = true;
    try {
      const { rows } = await query("SELECT access_token FROM user_tokens WHERE broker = 'angelone' LIMIT 1");
      const userToken = rows[0];
      if (!userToken) return;

      const decryptedToken = decrypt(userToken.access_token);

      const response = await fetch("https://apiconnect.angelone.in/rest/auth/angelone/market/v1/quote", {
        method: "POST", headers: { "X-PrivateKey": process.env.ANGEL_ONE_API_KEY!, "X-SourceID": "WEB", "Authorization": `Bearer ${decryptedToken}`, "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ mode: "LTP", exchangeTokens: { NSE: ["3045", "99926000", "99926009"] } }), signal: AbortSignal.timeout(4000)
      });
      const data = await response.json();
      if (data.status && data.data?.fetched) {
        data.data.fetched.forEach((item: any) => { if (allSymbols.includes(item.tradingSymbol)) stockPrices[item.tradingSymbol] = item.ltp; });
      }
    } catch (e) { } finally { isFetchingAngel = false; }
  };

  app.post("/api/market/refresh", authenticateToken, async (req: any, res: any, next: any) => {
    try {
      await fetchRealPrices();
      res.json({ success: true, last_prices: stockPrices });
    } catch (e) {
      next(e);
    }
  });

  fetchRealPrices();
  setInterval(fetchRealPrices, 5000);
  setInterval(fetchAngelOnePrices, 5000);

  setInterval(async () => {
    let isSimulated = false;
    try {
      const { rows } = await query("SELECT COUNT(*) as count FROM user_tokens");
      if (parseInt(rows[0].count) === 0) {
        isSimulated = true;
        allSymbols.forEach(symbol => { stockPrices[symbol] += stockPrices[symbol] * (Math.random() * 0.0002 - 0.0001); });
      }
    } catch (e) {}

    const payload = JSON.stringify({ type: 'ticker', data: stockPrices, isSimulated });
    wss.clients.forEach(c => { if (c.readyState === WebSocket.OPEN) c.send(payload); });
  }, 1000);

  app.get("/api/market-status", async (req, res, next) => {
    try {
      const { rows: countRows } = await query("SELECT COUNT(*) as count FROM user_tokens");
      const { rows: tokens } = await query("SELECT user_id, updated_at FROM user_tokens");
      res.json({ is_fetching: parseInt(countRows[0].count) > 0, token_count: parseInt(countRows[0].count), tokens, last_prices: stockPrices, api_key_set: !!process.env.UPTOX_API_KEY, market_hours: { open: "09:15", close: "15:30", timezone: "Asia/Kolkata" } });
    } catch (e) {
      next(e);
    }
  });

  app.use((err: any, req: any, res: any, next: any) => {
    logger.error('Unhandled error', {
      error: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
      userId: req.user?.id,
    });

    res.status(500).json({
      error: 'An internal server error occurred. Please try again.',
    });
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
    app.get("*", async (req, res, next) => {
      if (req.url.startsWith('/api')) return next();
      try {
        const html = await vite.transformIndexHtml(req.originalUrl, await fs.readFile(path.join(__dirname, "index.html"), "utf-8"));
        res.status(200).set({ "Content-Type": "text/html" }).end(html);
      } catch (e) { vite.ssrFixStacktrace(e as Error); next(e); }
    });
  } else {
    const distPath = path.join(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => res.sendFile(path.join(distPath, "index.html")));
  }

  server.listen(3000, "0.0.0.0", () => {
    logger.info(`[Server] AAPA CAPITAL server running on http://0.0.0.0:3000`);
  });
}

startServer().catch((e) => {
  logger.error("Failed to start server", e);
});