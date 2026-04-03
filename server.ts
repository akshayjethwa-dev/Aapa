import express from "express";
import { createServer as createViteServer } from "vite";
import http from "http";
import { WebSocketServer, WebSocket } from "ws";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs/promises";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const db = new Database("sqlite.db");
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE,
    mobile TEXT UNIQUE,
    password TEXT,
    role TEXT DEFAULT 'user',
    is_kyc_approved INTEGER DEFAULT 0,
    is_uptox_connected INTEGER DEFAULT 0,
    is_angelone_connected INTEGER DEFAULT 0,
    balance REAL DEFAULT 100000.0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS portfolios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    symbol TEXT,
    quantity INTEGER,
    average_price REAL,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    symbol TEXT,
    type TEXT, -- 'buy' or 'sell'
    order_type TEXT, -- 'market', 'limit', 'sl'
    quantity INTEGER,
    price REAL,
    status TEXT DEFAULT 'completed', -- 'pending', 'completed', 'cancelled'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS kyc_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    pan TEXT,
    aadhaar TEXT,
    bank_account TEXT,
    ifsc TEXT,
    status TEXT DEFAULT 'pending',
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS user_tokens (
    user_id INTEGER,
    broker TEXT, -- 'upstox', 'angelone'
    access_token TEXT,
    refresh_token TEXT,
    feed_token TEXT, -- For Angel One
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, broker),
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS beta_whitelist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    identifier TEXT UNIQUE, -- email or mobile
    is_approved INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Whitelist the initial user
  INSERT OR IGNORE INTO beta_whitelist (identifier) VALUES ('bharvadvijay371@gmail.com');
  INSERT OR IGNORE INTO beta_whitelist (identifier) VALUES ('bharvadvijay371@gamil.com');
  INSERT OR IGNORE INTO beta_whitelist (identifier) VALUES ('bharvaddvijay371@gmail.com');
  INSERT OR IGNORE INTO beta_whitelist (identifier) VALUES ('8128332216');
`);

// Seed Admin Users
const seedAdmins = async () => {
  const admins = [
    { email: "bharvadvijay371@gmail.com", password: "Aniket@371" },
    { email: "dwarkeshtrading7@gmail.com", password: "Aniket@371" }
  ];

  for (const admin of admins) {
    const existing = db.prepare("SELECT * FROM users WHERE email = ?").get(admin.email);
    if (!existing) {
      const hashedPassword = await bcrypt.hash(admin.password, 10);
      db.prepare("INSERT INTO users (email, password, role, balance) VALUES (?, ?, ?, ?)").run(
        admin.email, 
        hashedPassword, 
        'admin',
        100000
      );
      console.log(`[Seed] Admin user created: ${admin.email}`);
    } else {
      // Ensure they are admin
      db.prepare("UPDATE users SET role = 'admin' WHERE email = ?").run(admin.email);
    }
  }
};

seedAdmins().catch(err => console.error("[Seed] Error seeding admins:", err));

// Migration: Add columns if missing
const migrate = async () => {
  const tables = [
    { table: 'users', column: 'is_uptox_connected', type: 'INTEGER DEFAULT 0' },
    { table: 'users', column: 'is_angelone_connected', type: 'INTEGER DEFAULT 0' },
  ];

  tables.forEach(({ table, column, type }) => {
    try {
      db.prepare(`SELECT ${column} FROM ${table} LIMIT 1`).get();
    } catch (e) {
      console.log(`[DB] Adding ${column} column to ${table} table...`);
      db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`).run();
    }
  });

  // Ensure super admin exists with correct password
  const superAdminEmail = 'bharvadvijay371@gmail.com';
  const superAdminPassword = 'Aniket@371';
  const hashedAdminPassword = await bcrypt.hash(superAdminPassword, 10);
  
  const existingAdmin = db.prepare("SELECT * FROM users WHERE email = ?").get(superAdminEmail);
  if (existingAdmin) {
    db.prepare("UPDATE users SET role = 'admin', password = ? WHERE email = ?").run(hashedAdminPassword, superAdminEmail);
  } else {
    db.prepare("INSERT OR IGNORE INTO users (email, mobile, password, role) VALUES (?, ?, ?, ?)").run(superAdminEmail, '8128332216', hashedAdminPassword, 'admin');
  }

  // Re-create user_tokens if it's the old schema
  try {
    const info = db.prepare("PRAGMA table_info(user_tokens)").all();
    const hasBroker = info.some((c: any) => c.name === 'broker');
    if (!hasBroker) {
      console.log("[DB] Migrating user_tokens table to multi-broker schema...");
      db.exec("DROP TABLE user_tokens");
      db.exec(`
        CREATE TABLE user_tokens (
          user_id INTEGER,
          broker TEXT,
          access_token TEXT,
          refresh_token TEXT,
          feed_token TEXT,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (user_id, broker),
          FOREIGN KEY(user_id) REFERENCES users(id)
        )
      `);
    }
  } catch (e) {
    console.error("[DB] Migration error for user_tokens:", e);
  }
};

await migrate();

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws, req) => {
    const ip = req.socket.remoteAddress;
    console.log(`[WebSocket] New client connected from ${ip}. Total clients: ${wss.clients.size}`);
    
    // Send initial data immediately
    ws.send(JSON.stringify({ type: 'ticker', data: stockPrices }));

    ws.on('close', () => {
      console.log(`[WebSocket] Client disconnected. Remaining clients: ${wss.clients.size}`);
    });

    ws.on('error', (err) => {
      console.error('[WebSocket] Client error:', err);
    });
  });

  app.use(express.json());

  // Request logging middleware
  app.use((req, res, next) => {
    console.log(`[HTTP] ${req.method} ${req.url}`);
    next();
  });

  const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret";

  // Auth Middleware
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

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  app.post("/api/auth/register", async (req, res) => {
    let { email, mobile, password } = req.body;
    email = email?.toLowerCase().trim();
    mobile = mobile?.trim();
    
    console.log(`[Auth] Registration attempt for email: ${email}`);
    const hashedPassword = await bcrypt.hash(password, 10);
    try {
      // Check if this is the first user or the super admin
      const userCount = db.prepare("SELECT COUNT(*) as count FROM users").get().count;
      const superAdminEmail = 'bharvadvijay371@gmail.com';
      const role = (userCount === 0 || email === superAdminEmail) ? 'admin' : 'user';
      
      const info = db.prepare("INSERT INTO users (email, mobile, password, role) VALUES (?, ?, ?, ?)").run(email, mobile, hashedPassword, role);
      console.log(`[Auth] Registration successful for user ID: ${info.lastInsertRowid} with role: ${role}`);
      res.json({ id: info.lastInsertRowid });
    } catch (e: any) {
      console.error(`[Auth] Registration failed for ${email}:`, e.message);
      if (e.message.includes("UNIQUE constraint failed: users.email")) {
        return res.status(400).json({ error: "Email already registered. Please login instead." });
      }
      if (e.message.includes("UNIQUE constraint failed: users.mobile")) {
        return res.status(400).json({ error: "Mobile number already registered. Please login instead." });
      }
      res.status(400).json({ error: "User already exists or invalid data" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    let { login, password } = req.body;
    login = login?.toLowerCase().trim();
    console.log(`[Auth] Login attempt for: ${login}`);
    try {
      const user: any = db.prepare("SELECT * FROM users WHERE email = ? OR mobile = ?").get(login, login);
      if (!user) {
        console.log(`[Auth] Login failed: User ${login} not found`);
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        console.log(`[Auth] Login failed: Incorrect password for ${login}`);
        return res.status(401).json({ error: "Invalid credentials" });
      }
      
      // Force admin role for super admin email
      const superAdminEmail = 'bharvadvijay371@gmail.com';
      const effectiveRole = (user.email === superAdminEmail) ? 'admin' : user.role;
      
      const token = jwt.sign({ id: user.id, email: user.email, role: effectiveRole }, JWT_SECRET);
      console.log(`[Auth] Login successful for ${login} (ID: ${user.id}) with role: ${effectiveRole}`);
      res.json({ token, user: { id: user.id, email: user.email, role: effectiveRole, balance: user.balance } });
    } catch (e: any) {
      console.error(`[Auth] Login error for ${login}:`, e.message);
      res.status(500).json({ error: "Internal server error during login" });
    }
  });

  // Angel One Auth Route
  app.post("/api/auth/angelone/login", authenticateToken, async (req: any, res) => {
    const { clientCode, password, totp } = req.body;
    const apiKey = process.env.ANGEL_ONE_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: "ANGEL_ONE_API_KEY is missing in server environment." });
    }

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
        
        db.prepare("INSERT OR REPLACE INTO user_tokens (user_id, broker, access_token, refresh_token, feed_token) VALUES (?, ?, ?, ?, ?)")
          .run(req.user.id, 'angelone', jwtToken, refreshToken, feedToken);
        
        db.prepare("UPDATE users SET is_angelone_connected = 1 WHERE id = ?").run(req.user.id);
        
        res.json({ success: true, message: "Angel One connected successfully" });
      } else {
        res.status(400).json({ error: data.message || "Angel One login failed" });
      }
    } catch (e) {
      console.error("[AngelOne] Login error:", e);
      res.status(500).json({ error: "Failed to connect to Angel One API" });
    }
  });

  // Admin: User Management
  app.get("/api/admin/users", authenticateToken, (req: any, res) => {
    if (req.user.role !== 'admin') return res.sendStatus(403);
    const users = db.prepare("SELECT id, email, mobile, role, balance, created_at FROM users ORDER BY created_at DESC").all();
    res.json(users);
  });

  app.post("/api/admin/users/:id/role", authenticateToken, (req: any, res) => {
    if (req.user.role !== 'admin') return res.sendStatus(403);
    const { role } = req.body;
    const { id } = req.params;
    db.prepare("UPDATE users SET role = ? WHERE id = ?").run(role, id);
    res.json({ success: true });
  });

  // Admin: Beta Whitelist Management
  app.get("/api/admin/whitelist", authenticateToken, (req: any, res) => {
    if (req.user.role !== 'admin') return res.sendStatus(403);
    const list = db.prepare("SELECT * FROM beta_whitelist ORDER BY created_at DESC").all();
    res.json(list);
  });

  app.post("/api/admin/whitelist", authenticateToken, (req: any, res) => {
    if (req.user.role !== 'admin') return res.sendStatus(403);
    const { identifier } = req.body;
    try {
      db.prepare("INSERT INTO beta_whitelist (identifier) VALUES (?)").run(identifier);
      res.json({ success: true });
    } catch (e) {
      res.status(400).json({ error: "Already whitelisted" });
    }
  });

  app.delete("/api/admin/whitelist/:id", authenticateToken, (req: any, res) => {
    if (req.user.role !== 'admin') return res.sendStatus(403);
    db.prepare("DELETE FROM beta_whitelist WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  app.post("/api/admin/users/create", authenticateToken, async (req: any, res) => {
    if (req.user.role !== 'admin') return res.sendStatus(403);
    const { email, mobile, password, role } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    try {
      const info = db.prepare("INSERT INTO users (email, mobile, password, role) VALUES (?, ?, ?, ?)").run(email, mobile, hashedPassword, role || 'user');
      res.json({ id: info.lastInsertRowid });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.get("/api/user/profile", authenticateToken, async (req: any, res) => {
    const user = db.prepare("SELECT id, email, mobile, role, is_kyc_approved, balance FROM users WHERE id = ?").get(req.user.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    
    const userToken = db.prepare("SELECT access_token FROM user_tokens WHERE user_id = ?").get(req.user.id);
    
    let balance = user?.balance || 0;
    if (userToken) {
      try {
        const response = await fetch("https://api.upstox.com/v2/user/get-funds-and-margin", {
          headers: { "Authorization": `Bearer ${userToken.access_token}`, "Accept": "application/json" }
        });
        const data = await response.json();
        if (data.status === 'success') {
          balance = data.data.equity.available_margin;
        }
      } catch (e) {
        console.error("Failed to fetch Upstox funds", e);
      }
    }

    res.json({ ...user, balance, is_uptox_connected: !!userToken });
  });

  // Uptox Auth Routes
  app.get("/api/auth/uptox/url", (req, res) => {
    const apiKey = process.env.UPTOX_API_KEY;
    
    // Robust Redirect URI detection
    let redirectUri = process.env.UPTOX_REDIRECT_URI;
    
    const host = req.get('host');
    const protocol = req.get('x-forwarded-proto') || req.protocol;
    const detectedUri = `${protocol}://${host}/auth/callback`;

    // Use the provided one if it's a valid URL, otherwise use detected
    if (redirectUri && redirectUri.startsWith('http')) {
      // Keep it
    } else {
      redirectUri = detectedUri;
    }
    
    // Override for specific user request if needed, but auto-detection is usually better.
    // However, the user explicitly asked to fix it with a specific URL.
    if (host.includes('ais-dev-kmtq2mfzcdgtjnm6loanhz')) {
       redirectUri = 'https://ais-dev-kmtq2mfzcdgtjnm6loanhz-448575883234.asia-southeast1.run.app/auth/callback';
    }
    
    if (!apiKey) {
      return res.status(500).json({ error: "UPTOX_API_KEY is missing. Please set it in your environment variables." });
    }

    const url = `https://api.upstox.com/v2/login/authorization/dialog?response_type=code&client_id=${apiKey}&redirect_uri=${encodeURIComponent(redirectUri)}`;
    console.log(`[Auth] Generated Upstox URL with Redirect URI: ${redirectUri}`);
    res.json({ url });
  });

  app.get("/auth/callback", async (req, res) => {
    const { code } = req.query;
    if (!code) return res.status(400).send("No code provided by Upstox. Check if you cancelled the login.");

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
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
      });

      const data = await response.json();
      if (data.access_token) {
        // Associate this token with the user session
        res.send(`
          <html>
            <body style="background: #000; color: #fff; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; text-align: center;">
              <div>
                <h2 style="color: #10b981;">Connection Successful!</h2>
                <p>Uptox has been linked to your Aapa Capital account.</p>
                <p>You can close this window now.</p>
                <script>
                  if (window.opener) {
                    window.opener.postMessage({ 
                      type: 'UPTOX_AUTH_SUCCESS', 
                      token: '${data.access_token}',
                      refresh_token: '${data.refresh_token || ""}'
                    }, '*');
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
      res.status(500).send("Authentication failed");
    }
  });

  app.post("/api/auth/uptox/save-token", authenticateToken, async (req: any, res) => {
    const { access_token, refresh_token } = req.body;
    db.prepare("INSERT OR REPLACE INTO user_tokens (user_id, broker, access_token, refresh_token) VALUES (?, ?, ?, ?)")
      .run(req.user.id, 'upstox', access_token, refresh_token || null);
    db.prepare("UPDATE users SET is_uptox_connected = 1 WHERE id = ?").run(req.user.id);
    
    // Trigger immediate fetch
    console.log(`[Auth] New token saved for user ${req.user.id}. Triggering immediate market data fetch.`);
    fetchRealPrices();
    
    res.json({ success: true });
  });

  app.get("/api/portfolio", authenticateToken, async (req: any, res) => {
    const userId = req.user.id;
    const tokens = db.prepare("SELECT broker, access_token FROM user_tokens WHERE user_id = ?").all(userId) as any[];
    
    let combinedHoldings: any[] = [];
    
    for (const token of tokens) {
      if (token.broker === 'upstox') {
        try {
          const response = await fetch("https://api.upstox.com/v2/portfolio/long-term-holdings", {
            headers: { "Authorization": `Bearer ${token.access_token}`, "Accept": "application/json" }
          });
          const data = await response.json();
          if (data.status === 'success') {
            const holdings = data.data.map((h: any) => ({
              symbol: h.trading_symbol,
              quantity: h.quantity,
              average_price: h.average_price,
              current_price: h.last_price,
              broker: 'Upstox'
            }));
            combinedHoldings = [...combinedHoldings, ...holdings];
          }
        } catch (e) {
          console.error("Failed to fetch Upstox holdings", e);
        }
      } else if (token.broker === 'angelone') {
        try {
          const apiKey = process.env.ANGEL_ONE_API_KEY;
          const response = await fetch("https://apiconnect.angelone.in/rest/auth/angelone/portfolio/v1/getHolding", {
            headers: {
              "X-PrivateKey": apiKey!,
              "X-SourceID": "WEB",
              "Authorization": `Bearer ${token.access_token}`,
              "Content-Type": "application/json",
              "Accept": "application/json"
            }
          });
          const data = await response.json();
          if (data.status && data.data) {
            const holdings = data.data.map((h: any) => ({
              symbol: h.tradingsymbol,
              quantity: parseInt(h.quantity),
              average_price: parseFloat(h.averageprice),
              current_price: parseFloat(h.ltp),
              broker: 'Angel One'
            }));
            combinedHoldings = [...combinedHoldings, ...holdings];
          }
        } catch (e) {
          console.error("Failed to fetch Angel One holdings", e);
        }
      }
    }
    
    if (combinedHoldings.length > 0) {
      return res.json(combinedHoldings);
    }
    
    // Fallback if not connected or failed
    const localHoldings = db.prepare("SELECT *, 'Local' as broker FROM portfolios WHERE user_id = ?").all(req.user.id);
    res.json(localHoldings);
  });

  app.post("/api/orders", authenticateToken, async (req: any, res) => {
    const { symbol, type, order_type, quantity, price, product = 'I', broker = 'upstox' } = req.body;
    const userId = req.user.id;
    const userToken: any = db.prepare("SELECT access_token FROM user_tokens WHERE user_id = ? AND broker = ?").get(userId, broker);

    if (!userToken) {
      return res.status(400).json({ error: `Please connect your ${broker} account to place orders.` });
    }

    if (broker === 'upstox') {
      try {
        const response = await fetch("https://api.upstox.com/v2/order/place", {
          method: "POST",
          headers: { 
            "Authorization": `Bearer ${userToken.access_token}`, 
            "Content-Type": "application/json",
            "Accept": "application/json" 
          },
          body: JSON.stringify({
            quantity: parseInt(quantity),
            product: product.toUpperCase() === 'INTRADAY' ? 'I' : 'D', 
            validity: 'DAY',
            price: parseFloat(price) || 0,
            tag: 'AAPA_APP',
            instrument_token: symbol.includes('|') ? symbol : `NSE_EQ|${symbol}`, 
            order_type: order_type.toUpperCase(), 
            transaction_type: type.toUpperCase(), 
            disclosed_quantity: 0,
            trigger_price: 0,
            is_amo: false
          })
        });
        const data = await response.json();
        if (data.status === 'success') {
          db.prepare("INSERT INTO orders (user_id, symbol, type, order_type, quantity, price) VALUES (?, ?, ?, ?, ?, ?)").run(userId, symbol, type, order_type, quantity, price);
          return res.json({ success: true, order_id: data.data.order_id });
        } else {
          return res.status(400).json({ error: data.errors?.[0]?.message || "Upstox order failed" });
        }
      } catch (e) {
        console.error("Upstox order error", e);
        return res.status(500).json({ error: "Failed to connect to Upstox API" });
      }
    } else if (broker === 'angelone') {
      try {
        const apiKey = process.env.ANGEL_ONE_API_KEY;
        const symbolToken = ANGEL_ONE_TOKENS[symbol] || "3045"; // Fallback to RELIANCE if not found
        
        const response = await fetch("https://apiconnect.angelone.in/rest/auth/angelone/order/v1/placeOrder", {
          method: "POST",
          headers: {
            "X-PrivateKey": apiKey!,
            "X-SourceID": "WEB",
            "Authorization": `Bearer ${userToken.access_token}`,
            "Content-Type": "application/json",
            "Accept": "application/json"
          },
          body: JSON.stringify({
            "variety": "NORMAL",
            "tradingsymbol": symbol,
            "symboltoken": symbolToken,
            "transactiontype": type.toUpperCase(),
            "exchange": symbol.includes('NIFTY') || symbol.includes('BANK') ? "NFO" : "NSE",
            "ordertype": order_type.toUpperCase(),
            "producttype": product.toUpperCase() === 'INTRADAY' ? 'INTRADAY' : 'DELIVERY',
            "duration": "DAY",
            "price": parseFloat(price) || 0,
            "squareoff": "0",
            "stoploss": "0",
            "quantity": quantity.toString()
          })
        });
        const data = await response.json();
        if (data.status && data.data && data.data.orderid) {
          db.prepare("INSERT INTO orders (user_id, symbol, type, order_type, quantity, price) VALUES (?, ?, ?, ?, ?, ?)").run(userId, symbol, type, order_type, quantity, price);
          return res.json({ success: true, order_id: data.data.orderid });
        } else {
          return res.status(400).json({ error: data.message || "Angel One order failed" });
        }
      } catch (e) {
        console.error("Angel One order error", e);
        return res.status(500).json({ error: "Failed to connect to Angel One API" });
      }
    }
  });

  // WebSocket for Real-time Market Data Simulation
  const primaryIndices = ["NIFTY 50", "SENSEX", "BANKNIFTY", "FINNIFTY", "MIDCAP NIFTY", "SMALLCAP NIFTY"];
  const secondaryIndices = ["NIFTY IT", "NIFTY AUTO", "NIFTY PHARMA", "NIFTY METAL", "NIFTY FMCG", "NIFTY REALTY"];
  const stocks = ["RELIANCE", "TCS", "HDFCBANK", "INFY", "ICICIBANK", "BHARTIARTL", "SBIN", "LICI", "ITC", "HINDUNILVR"];
  
  const allSymbols = [...primaryIndices, ...secondaryIndices, ...stocks];
  
  // Angel One Symbol Token Mapping (Common symbols)
  const ANGEL_ONE_TOKENS: Record<string, string> = {
    "RELIANCE": "2885",
    "TCS": "11536",
    "HDFCBANK": "1333",
    "INFY": "1594",
    "ICICIBANK": "4963",
    "BHARTIARTL": "10604",
    "SBIN": "3045",
    "LICI": "11802",
    "ITC": "1660",
    "HINDUNILVR": "1330",
    "NIFTY 50": "99926000",
    "BANKNIFTY": "99926009",
    "FINNIFTY": "99926037",
    "SENSEX": "99919000"
  };

  const stockPrices: Record<string, number> = {
    "NIFTY 50": 22145.20,
    "SENSEX": 72850.40,
    "BANKNIFTY": 46800.15,
    "FINNIFTY": 20850.60,
    "MIDCAP NIFTY": 10920.45,
    "SMALLCAP NIFTY": 16150.30,
    "NIFTY IT": 37850.20,
    "NIFTY AUTO": 20150.40,
    "NIFTY PHARMA": 18920.15,
    "NIFTY METAL": 7950.60,
    "NIFTY FMCG": 54120.30,
    "NIFTY REALTY": 890.45,
    "RELIANCE": 2985.40,
    "TCS": 4120.15,
    "HDFCBANK": 1450.60,
    "INFY": 1680.40,
    "ICICIBANK": 1050.20,
    "BHARTIARTL": 1120.30,
    "SBIN": 750.45,
    "LICI": 940.20,
    "ITC": 410.15,
    "HINDUNILVR": 2380.60
  };
  
  // Fill any missing symbols with a random value
  allSymbols.forEach(symbol => {
    if (!stockPrices[symbol]) {
      stockPrices[symbol] = Math.random() * 1000 + 100;
    }
  });

  const indexMap: Record<string, string[]> = {
    'NIFTY 50': ['NSE_INDEX|Nifty 50', 'NSE_INDEX|NIFTY 50'],
    'BANKNIFTY': ['NSE_INDEX|Nifty Bank', 'NSE_INDEX|NIFTY BANK'],
    'FINNIFTY': ['NSE_INDEX|Nifty Fin Service', 'NSE_INDEX|NIFTY FIN SERVICE'],
    'MIDCAP NIFTY': ['NSE_INDEX|Nifty Midcap 100', 'NSE_INDEX|NIFTY MIDCAP 100'],
    'SENSEX': ['BSE_INDEX|SENSEX', 'BSE_INDEX|Sensex'],
    'SMALLCAP NIFTY': ['NSE_INDEX|Nifty Smallcap 100', 'NSE_INDEX|NIFTY SMALLCAP 100'],
    'NIFTY IT': ['NSE_INDEX|Nifty IT', 'NSE_INDEX|NIFTY IT'],
    'NIFTY AUTO': ['NSE_INDEX|Nifty Auto', 'NSE_INDEX|NIFTY AUTO'],
    'NIFTY PHARMA': ['NSE_INDEX|Nifty Pharma', 'NSE_INDEX|NIFTY PHARMA'],
    'NIFTY METAL': ['NSE_INDEX|Nifty Metal', 'NSE_INDEX|NIFTY METAL'],
    'NIFTY FMCG': ['NSE_INDEX|Nifty FMCG', 'NSE_INDEX|NIFTY FMCG'],
    'NIFTY REALTY': ['NSE_INDEX|Nifty Realty', 'NSE_INDEX|NIFTY REALTY']
  };

  let isFetchingUpstox = false;
  const fetchRealPrices = async () => {
    if (isFetchingUpstox) return;
    isFetchingUpstox = true;
    
    const userToken: any = db.prepare("SELECT access_token FROM user_tokens WHERE broker = 'upstox' LIMIT 1").get();
    if (!userToken) {
      if (Math.random() < 0.01) { // Log only ~1% of the time to avoid spam
        console.log("[MarketData] No Upstox token found. Simulation active.");
      }
      isFetchingUpstox = false;
      return;
    }

    try {
      const stockKeys = stocks.map(s => `NSE_EQ|${s}`);
      const indexKeys = Object.values(indexMap).flat();
      const allKeys = [...stockKeys, ...indexKeys].join(',');
      
      const url = `https://api.upstox.com/v2/market-quote/quotes?instrument_key=${allKeys}`;
      const response = await fetch(url, {
        headers: { 
          "Authorization": `Bearer ${userToken.access_token}`, 
          "Accept": "application/json" 
        },
        signal: AbortSignal.timeout(4000) // 4s timeout
      });
      
      if (!response.ok) {
        const errText = await response.text();
        console.error(`[MarketData] Upstox API Error ${response.status}:`, errText);
        if (response.status === 401) {
          console.log("[MarketData] Token expired or invalid. Clearing tokens.");
          db.prepare("DELETE FROM user_tokens WHERE broker = 'upstox'").run();
        }
        return;
      }

      const data = await response.json();
      
      if (data.status === 'success' && data.data) {
        const reverseMap: Record<string, string> = {};
        Object.entries(indexMap).forEach(([internal, upstoxKeys]) => {
          upstoxKeys.forEach(uk => reverseMap[uk] = internal);
        });

        Object.keys(data.data).forEach(key => {
          const price = data.data[key].last_price;
          if (!price) return;

          if (reverseMap[key]) {
            stockPrices[reverseMap[key]] = price;
          } else {
            const symbol = key.split('|')[1];
            if (allSymbols.includes(symbol)) {
              stockPrices[symbol] = price;
            }
          }
        });
        
        if (Math.random() < 0.1) {
          console.log(`[MarketData] Upstox Success. NIFTY: ${stockPrices['NIFTY 50']}`);
        }
      }
    } catch (e) {
      console.error("[MarketData] Upstox Exception:", e);
    } finally {
      isFetchingUpstox = false;
    }
  };

  let isFetchingAngel = false;
  const fetchAngelOnePrices = async () => {
    if (isFetchingAngel) return;
    isFetchingAngel = true;

    const userToken: any = db.prepare("SELECT access_token, feed_token FROM user_tokens WHERE broker = 'angelone' LIMIT 1").get();
    if (!userToken) {
      isFetchingAngel = false;
      return;
    }

    const apiKey = process.env.ANGEL_ONE_API_KEY;
    try {
      const response = await fetch("https://apiconnect.angelone.in/rest/auth/angelone/market/v1/quote", {
        method: "POST",
        headers: {
          "X-PrivateKey": apiKey!,
          "X-SourceID": "WEB",
          "Authorization": `Bearer ${userToken.access_token}`,
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({
          "mode": "LTP",
          "exchangeTokens": {
            "NSE": ["3045", "99926000", "99926009"]
          }
        }),
        signal: AbortSignal.timeout(4000)
      });

      const data = await response.json();
      if (data.status && data.data && data.data.fetched) {
        data.data.fetched.forEach((item: any) => {
          const symbol = item.tradingSymbol;
          if (allSymbols.includes(symbol)) {
            stockPrices[symbol] = item.ltp;
          }
        });
      }
    } catch (e) {
      console.error("[AngelOne] Market data error:", e);
    } finally {
      isFetchingAngel = false;
    }
  };

  // AI Trading Signals (Mock implementation using Gemini)
  app.get("/api/ai/signals", authenticateToken, async (req, res) => {
    try {
      // In a real app, we'd pass current market data to Gemini
      const prompt = `Act as a professional stock market analyst. Based on current market trends (NIFTY at ${stockPrices['NIFTY 50']}, BANKNIFTY at ${stockPrices['BANKNIFTY']}), provide 3 high-probability trading signals for Indian stocks. Format as JSON: [{symbol, side, entry, target, stoploss, reason}].`;
      
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });

      const text = response.text;
      const jsonMatch = text.match(/\[.*\]/s);
      if (jsonMatch) {
        res.json(JSON.parse(jsonMatch[0]));
      } else {
        res.json([
          { symbol: "RELIANCE", side: "BUY", entry: stockPrices["RELIANCE"], target: stockPrices["RELIANCE"] * 1.05, stoploss: stockPrices["RELIANCE"] * 0.98, reason: "Strong support at current levels" },
          { symbol: "TCS", side: "SELL", entry: stockPrices["TCS"], target: stockPrices["TCS"] * 0.95, stoploss: stockPrices["TCS"] * 1.02, reason: "Overbought on daily charts" }
        ]);
      }
    } catch (e) {
      res.status(500).json({ error: "AI Signal generation failed" });
    }
  });

  app.post("/api/market/refresh", authenticateToken, async (req: any, res: any) => {
    console.log(`[MarketData] Manual refresh requested by user ${req.user.id}`);
    await fetchRealPrices();
    res.json({ success: true, last_prices: stockPrices });
  });

  // Fetch real prices every 5 seconds to stay within rate limits
  fetchRealPrices();
  setInterval(fetchRealPrices, 5000);
  setInterval(fetchAngelOnePrices, 5000);

  setInterval(() => {
    // If no Upstox token is available, simulate small movements for visual feedback
    const hasToken = db.prepare("SELECT COUNT(*) as count FROM user_tokens").get() as any;
    if (hasToken.count === 0) {
      allSymbols.forEach(symbol => {
        const current = stockPrices[symbol];
        const change = current * (Math.random() * 0.0002 - 0.0001); // 0.01% max change
        stockPrices[symbol] = current + change;
      });
    }

    const data = JSON.stringify({ type: 'ticker', data: stockPrices });
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  }, 1000);

  app.get("/api/market-status", (req, res) => {
    const tokenCount = db.prepare("SELECT COUNT(*) as count FROM user_tokens").get() as any;
    const tokens = db.prepare("SELECT user_id, updated_at FROM user_tokens").all();
    res.json({ 
      is_fetching: tokenCount.count > 0,
      token_count: tokenCount.count,
      tokens: tokens,
      last_prices: stockPrices,
      api_key_set: !!process.env.UPTOX_API_KEY,
      market_hours: {
        open: "09:15",
        close: "15:30",
        timezone: "Asia/Kolkata"
      }
    });
  });

  app.get("/api/portfolio/holdings", authenticateToken, async (req: any, res) => {
    const userId = req.user.id;
    const tokens = db.prepare("SELECT broker, access_token FROM user_tokens WHERE user_id = ?").all(userId) as any[];
    
    let combinedHoldings: any[] = [];
    
    for (const token of tokens) {
      if (token.broker === 'upstox') {
        try {
          const response = await fetch("https://api.upstox.com/v2/portfolio/long-term-holdings", {
            headers: { "Authorization": `Bearer ${token.access_token}`, "Accept": "application/json" }
          });
          const data = await response.json();
          if (data.status === 'success') {
            combinedHoldings = [...combinedHoldings, ...data.data.map((h: any) => ({ ...h, broker: 'Upstox' }))];
          }
        } catch (e) {
          console.error("Failed to fetch Upstox holdings", e);
        }
      } else if (token.broker === 'angelone') {
        try {
          const apiKey = process.env.ANGEL_ONE_API_KEY;
          const response = await fetch("https://apiconnect.angelone.in/rest/auth/angelone/portfolio/v1/getHolding", {
            headers: {
              "X-PrivateKey": apiKey!,
              "X-SourceID": "WEB",
              "Authorization": `Bearer ${token.access_token}`,
              "Content-Type": "application/json",
              "Accept": "application/json"
            }
          });
          const data = await response.json();
          if (data.status && data.data) {
            combinedHoldings = [...combinedHoldings, ...data.data.map((h: any) => ({ ...h, broker: 'Angel One' }))];
          }
        } catch (e) {
          console.error("Failed to fetch Angel One holdings", e);
        }
      }
    }
    
    res.json({ status: 'success', data: combinedHoldings });
  });

  app.get("/api/portfolio/positions", authenticateToken, async (req: any, res) => {
    const userId = req.user.id;
    const tokens = db.prepare("SELECT broker, access_token FROM user_tokens WHERE user_id = ?").all(userId) as any[];
    
    let combinedPositions: any[] = [];
    
    for (const token of tokens) {
      if (token.broker === 'upstox') {
        try {
          const response = await fetch("https://api.upstox.com/v2/portfolio/short-term-positions", {
            headers: { "Authorization": `Bearer ${token.access_token}`, "Accept": "application/json" }
          });
          const data = await response.json();
          if (data.status === 'success' && data.data) {
            combinedPositions = [...combinedPositions, ...data.data.map((p: any) => ({ ...p, broker: 'Upstox' }))];
          }
        } catch (e) {
          console.error("Failed to fetch Upstox positions", e);
        }
      } else if (token.broker === 'angelone') {
        try {
          const apiKey = process.env.ANGEL_ONE_API_KEY;
          const response = await fetch("https://apiconnect.angelone.in/rest/auth/angelone/portfolio/v1/getPosition", {
            headers: {
              "X-PrivateKey": apiKey!,
              "X-SourceID": "WEB",
              "Authorization": `Bearer ${token.access_token}`,
              "Content-Type": "application/json",
              "Accept": "application/json"
            }
          });
          const data = await response.json();
          if (data.status && data.data) {
            combinedPositions = [...combinedPositions, ...data.data.map((p: any) => ({ ...p, broker: 'Angel One' }))];
          }
        } catch (e) {
          console.error("Failed to fetch Angel One positions", e);
        }
      }
    }
    
    res.json({ status: 'success', data: combinedPositions });
  });

  app.get("/api/option-chain", authenticateToken, async (req: any, res) => {
    const { instrument_key, expiry_date } = req.query;
    const userId = req.user.id;
    const userToken: any = db.prepare("SELECT access_token FROM user_tokens WHERE user_id = ?").get(userId);

    if (!userToken) {
      // Return mock data for demonstration if not connected
      const indexName = (instrument_key as string).split('|')[1];
      const spot = stockPrices[indexName] || 22000;
      const interval = indexName.includes('Bank') ? 100 : 50;
      const atm = Math.round(spot / interval) * interval;
      
      const mockData = [];
      for (let i = -30; i <= 30; i++) {
        const strike = atm + (i * interval);
        const dist = Math.abs(strike - spot);
        mockData.push({
          strike_price: strike,
          call_options: {
            market_data: {
              ltp: Math.max(1, (spot - strike) + (50 / (dist/interval + 1))),
              perc_change: (Math.random() * 10 - 5)
            }
          },
          put_options: {
            market_data: {
              ltp: Math.max(1, (strike - spot) + (50 / (dist/interval + 1))),
              perc_change: (Math.random() * 10 - 5)
            }
          }
        });
      }
      return res.json({ status: 'success', data: mockData });
    }

    try {
      const url = `https://api.upstox.com/v2/option/chain?instrument_key=${instrument_key}&expiry_date=${expiry_date}`;
      const response = await fetch(url, {
        headers: { "Authorization": `Bearer ${userToken.access_token}`, "Accept": "application/json" }
      });
      const data = await response.json();
      res.json(data);
    } catch (e) {
      res.status(500).json({ error: "Failed to fetch option chain" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    
    // Handle client-side routing in dev by serving transformed index.html
    app.get("*", async (req, res, next) => {
      if (req.url.startsWith('/api')) return next();
      try {
        const url = req.originalUrl;
        const template = await fs.readFile(path.join(__dirname, "index.html"), "utf-8");
        const html = await vite.transformIndexHtml(url, template);
        res.status(200).set({ "Content-Type": "text/html" }).end(html);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    const distPath = path.join(__dirname, "dist");
    app.use(express.static(distPath));
    
    // SPA fallback for all other routes
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"), (err) => {
        if (err) {
          console.error("[Server] Error sending index.html:", err);
          res.status(500).send("Internal Server Error");
        }
      });
    });
  }

  const PORT = 3000;
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] AAPA CAPITAL server started successfully`);
    console.log(`[Server] Listening on http://0.0.0.0:${PORT}`);
    console.log(`[Server] Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

startServer().catch(err => {
  console.error("[Server] Failed to start server:", err);
  process.exit(1);
});
