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

// Import PostgreSQL Database setup
import { pool, query } from "./src/db/index"; 

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();


// Run Migration & Seed Admin
const initDbAndSeed = async () => {
  try {
    const schemaPath = path.join(__dirname, "migrations", "001_initial_schema.sql");
    const schema = await fs.readFile(schemaPath, "utf8");
    await pool.query(schema);
    console.log("[DB] PostgreSQL Schema initialized successfully.");

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
        console.log(`[Seed] Admin user created: ${admin.email}`);
      } else {
        await query("UPDATE users SET role = 'admin' WHERE email = $1", [admin.email]);
      }
    }
  } catch (error) {
    console.error("[DB] Error initializing DB or seeding admins:", error);
  }
};

await initDbAndSeed();

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws, req) => {
    const ip = req.socket.remoteAddress;
    console.log(`[WebSocket] New client connected from ${ip}. Total clients: ${wss.clients.size}`);
    
    ws.send(JSON.stringify({ type: 'ticker', data: stockPrices }));

    ws.on('close', () => {
      console.log(`[WebSocket] Client disconnected. Remaining clients: ${wss.clients.size}`);
    });

    ws.on('error', (err) => {
      console.error('[WebSocket] Client error:', err);
    });
  });

  app.use(express.json());

  app.use((req, res, next) => {
    console.log(`[HTTP] ${req.method} ${req.url}`);
    next();
  });

  const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret";

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

  app.post("/api/auth/register", async (req, res) => {
    let { email, mobile, password } = req.body;
    email = email?.toLowerCase().trim();
    mobile = mobile?.trim();
    
    console.log(`[Auth] Registration attempt for email: ${email}`);
    const hashedPassword = await bcrypt.hash(password, 10);
    try {
      const { rows: countRows } = await query("SELECT COUNT(*) as count FROM users");
      const userCount = parseInt(countRows[0].count);
      const superAdminEmail = 'bharvadvijay371@gmail.com';
      const role = (userCount === 0 || email === superAdminEmail) ? 'admin' : 'user';
      
      const { rows: inserted } = await query(
        "INSERT INTO users (email, mobile, password, role) VALUES ($1, $2, $3, $4) RETURNING id",
        [email, mobile, hashedPassword, role]
      );
      
      console.log(`[Auth] Registration successful for user ID: ${inserted[0].id} with role: ${role}`);
      res.json({ id: inserted[0].id });
    } catch (e: any) {
      console.error(`[Auth] Registration failed for ${email}:`, e.message);
      // Postgres Unique constraint error codes
      if (e.code === '23505') {
        if (e.constraint === 'users_email_key') {
          return res.status(400).json({ error: "Email already registered. Please login instead." });
        }
        if (e.constraint === 'users_mobile_key') {
           return res.status(400).json({ error: "Mobile number already registered. Please login instead." });
        }
      }
      res.status(400).json({ error: "User already exists or invalid data" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    let { login, password } = req.body;
    login = login?.toLowerCase().trim();
    console.log(`[Auth] Login attempt for: ${login}`);
    try {
      const { rows } = await query("SELECT * FROM users WHERE email = $1 OR mobile = $1", [login]);
      const user = rows[0];
      
      if (!user) {
        console.log(`[Auth] Login failed: User ${login} not found`);
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        console.log(`[Auth] Login failed: Incorrect password for ${login}`);
        return res.status(401).json({ error: "Invalid credentials" });
      }
      
      const superAdminEmail = 'bharvadvijay371@gmail.com';
      const effectiveRole = (user.email === superAdminEmail) ? 'admin' : user.role;
      
      const token = jwt.sign({ id: user.id, email: user.email, role: effectiveRole }, JWT_SECRET);
      console.log(`[Auth] Login successful for ${login} (ID: ${user.id}) with role: ${effectiveRole}`);
      res.json({ token, user: { id: user.id, email: user.email, role: effectiveRole, balance: parseFloat(user.balance) } });
    } catch (e: any) {
      console.error(`[Auth] Login error for ${login}:`, e.message);
      res.status(500).json({ error: "Internal server error during login" });
    }
  });

  app.post("/api/auth/angelone/login", authenticateToken, async (req: any, res) => {
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
          [req.user.id, 'angelone', jwtToken, refreshToken, feedToken]
        );
        
        await query("UPDATE users SET is_angelone_connected = true WHERE id = $1", [req.user.id]);
        res.json({ success: true, message: "Angel One connected successfully" });
      } else {
        res.status(400).json({ error: data.message || "Angel One login failed" });
      }
    } catch (e) {
      console.error("[AngelOne] Login error:", e);
      res.status(500).json({ error: "Failed to connect to Angel One API" });
    }
  });

  app.get("/api/admin/users", authenticateToken, async (req: any, res) => {
    if (req.user.role !== 'admin') return res.sendStatus(403);
    const { rows: users } = await query("SELECT id, email, mobile, role, balance, created_at FROM users ORDER BY created_at DESC");
    res.json(users);
  });

  app.post("/api/admin/users/:id/role", authenticateToken, async (req: any, res) => {
    if (req.user.role !== 'admin') return res.sendStatus(403);
    const { role } = req.body;
    const { id } = req.params;
    await query("UPDATE users SET role = $1 WHERE id = $2", [role, id]);
    res.json({ success: true });
  });

  app.get("/api/admin/whitelist", authenticateToken, async (req: any, res) => {
    if (req.user.role !== 'admin') return res.sendStatus(403);
    const { rows: list } = await query("SELECT * FROM beta_whitelist ORDER BY created_at DESC");
    res.json(list);
  });

  app.post("/api/admin/whitelist", authenticateToken, async (req: any, res) => {
    if (req.user.role !== 'admin') return res.sendStatus(403);
    const { identifier } = req.body;
    try {
      await query("INSERT INTO beta_whitelist (identifier) VALUES ($1)", [identifier]);
      res.json({ success: true });
    } catch (e) {
      res.status(400).json({ error: "Already whitelisted" });
    }
  });

  app.delete("/api/admin/whitelist/:id", authenticateToken, async (req: any, res) => {
    if (req.user.role !== 'admin') return res.sendStatus(403);
    await query("DELETE FROM beta_whitelist WHERE id = $1", [req.params.id]);
    res.json({ success: true });
  });

  app.post("/api/admin/users/create", authenticateToken, async (req: any, res) => {
    if (req.user.role !== 'admin') return res.sendStatus(403);
    const { email, mobile, password, role } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    try {
      const { rows } = await query(
        "INSERT INTO users (email, mobile, password, role) VALUES ($1, $2, $3, $4) RETURNING id",
        [email, mobile, hashedPassword, role || 'user']
      );
      res.json({ id: rows[0].id });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.get("/api/user/profile", authenticateToken, async (req: any, res) => {
    const { rows: userRows } = await query("SELECT id, email, mobile, role, is_kyc_approved, balance FROM users WHERE id = $1", [req.user.id]);
    const user = userRows[0];
    if (!user) return res.status(404).json({ error: "User not found" });
    
    const { rows: tokenRows } = await query("SELECT access_token FROM user_tokens WHERE user_id = $1", [req.user.id]);
    const userToken = tokenRows[0];
    
    let balance = parseFloat(user?.balance) || 0;
    if (userToken) {
      try {
        const response = await fetch("https://api.upstox.com/v2/user/get-funds-and-margin", {
          headers: { "Authorization": `Bearer ${userToken.access_token}`, "Accept": "application/json" }
        });
        const data = await response.json();
        if (data.status === 'success') balance = data.data.equity.available_margin;
      } catch (e) {
        console.error("Failed to fetch Upstox funds", e);
      }
    }

    res.json({ ...user, balance, is_uptox_connected: !!userToken });
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

  app.get("/auth/callback", async (req, res) => {
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
        res.send(`
          <html>
            <body style="background: #000; color: #fff; display: flex; align-items: center; justify-content: center; height: 100vh;">
              <div>
                <h2 style="color: #10b981;">Connection Successful!</h2>
                <script>
                  if (window.opener) {
                    window.opener.postMessage({ type: 'UPTOX_AUTH_SUCCESS', token: '${data.access_token}', refresh_token: '${data.refresh_token || ""}' }, '*');
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
    await query(
      "INSERT INTO user_tokens (user_id, broker, access_token, refresh_token) VALUES ($1, $2, $3, $4) ON CONFLICT (user_id, broker) DO UPDATE SET access_token = EXCLUDED.access_token, refresh_token = EXCLUDED.refresh_token",
      [req.user.id, 'upstox', access_token, refresh_token || null]
    );
    await query("UPDATE users SET is_uptox_connected = true WHERE id = $1", [req.user.id]);
    fetchRealPrices();
    res.json({ success: true });
  });

  app.get("/api/portfolio", authenticateToken, async (req: any, res) => {
    const { rows: tokens } = await query("SELECT broker, access_token FROM user_tokens WHERE user_id = $1", [req.user.id]);
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
              symbol: h.trading_symbol, quantity: h.quantity, average_price: h.average_price, current_price: h.last_price, broker: 'Upstox'
            }));
            combinedHoldings = [...combinedHoldings, ...holdings];
          }
        } catch (e) { console.error("Upstox holdings error", e); }
      } else if (token.broker === 'angelone') {
        try {
          const response = await fetch("https://apiconnect.angelone.in/rest/auth/angelone/portfolio/v1/getHolding", {
            headers: { "X-PrivateKey": process.env.ANGEL_ONE_API_KEY!, "X-SourceID": "WEB", "Authorization": `Bearer ${token.access_token}`, "Content-Type": "application/json", "Accept": "application/json" }
          });
          const data = await response.json();
          if (data.status && data.data) {
            const holdings = data.data.map((h: any) => ({
              symbol: h.tradingsymbol, quantity: parseInt(h.quantity), average_price: parseFloat(h.averageprice), current_price: parseFloat(h.ltp), broker: 'Angel One'
            }));
            combinedHoldings = [...combinedHoldings, ...holdings];
          }
        } catch (e) { console.error("Angel One holdings error", e); }
      }
    }
    
    if (combinedHoldings.length > 0) return res.json(combinedHoldings);
    const { rows: localHoldings } = await query("SELECT *, 'Local' as broker FROM portfolios WHERE user_id = $1", [req.user.id]);
    res.json(localHoldings);
  });

  app.post("/api/orders", authenticateToken, async (req: any, res) => {
    const { symbol, type, order_type, quantity, price, product = 'I', broker = 'upstox' } = req.body;
    const userId = req.user.id;
    const { rows } = await query("SELECT access_token FROM user_tokens WHERE user_id = $1 AND broker = $2", [userId, broker]);
    const userToken = rows[0];

    if (!userToken) return res.status(400).json({ error: `Please connect your ${broker} account.` });

    if (broker === 'upstox') {
      try {
        const response = await fetch("https://api.upstox.com/v2/order/place", {
          method: "POST",
          headers: { "Authorization": `Bearer ${userToken.access_token}`, "Content-Type": "application/json", "Accept": "application/json" },
          body: JSON.stringify({
            quantity: parseInt(quantity), product: product.toUpperCase() === 'INTRADAY' ? 'I' : 'D', validity: 'DAY', price: parseFloat(price) || 0,
            tag: 'AAPA_APP', instrument_token: symbol.includes('|') ? symbol : `NSE_EQ|${symbol}`, order_type: order_type.toUpperCase(), 
            transaction_type: type.toUpperCase(), disclosed_quantity: 0, trigger_price: 0, is_amo: false
          })
        });
        const data = await response.json();
        if (data.status === 'success') {
          await query("INSERT INTO orders (user_id, symbol, type, order_type, quantity, price) VALUES ($1, $2, $3, $4, $5, $6)", 
            [userId, symbol, type, order_type, quantity, price]);
          return res.json({ success: true, order_id: data.data.order_id });
        }
        return res.status(400).json({ error: data.errors?.[0]?.message || "Upstox order failed" });
      } catch (e) { return res.status(500).json({ error: "Upstox API Error" }); }
    } else if (broker === 'angelone') {
      try {
        const response = await fetch("https://apiconnect.angelone.in/rest/auth/angelone/order/v1/placeOrder", {
          method: "POST",
          headers: { "X-PrivateKey": process.env.ANGEL_ONE_API_KEY!, "X-SourceID": "WEB", "Authorization": `Bearer ${userToken.access_token}`, "Content-Type": "application/json", "Accept": "application/json" },
          body: JSON.stringify({
            variety: "NORMAL", tradingsymbol: symbol, symboltoken: ANGEL_ONE_TOKENS[symbol] || "3045", transactiontype: type.toUpperCase(),
            exchange: symbol.includes('NIFTY') || symbol.includes('BANK') ? "NFO" : "NSE", ordertype: order_type.toUpperCase(), producttype: product.toUpperCase() === 'INTRADAY' ? 'INTRADAY' : 'DELIVERY',
            duration: "DAY", price: parseFloat(price) || 0, squareoff: "0", stoploss: "0", quantity: quantity.toString()
          })
        });
        const data = await response.json();
        if (data.status && data.data && data.data.orderid) {
          await query("INSERT INTO orders (user_id, symbol, type, order_type, quantity, price) VALUES ($1, $2, $3, $4, $5, $6)", 
            [userId, symbol, type, order_type, quantity, price]);
          return res.json({ success: true, order_id: data.data.orderid });
        }
        return res.status(400).json({ error: data.message || "Angel One order failed" });
      } catch (e) { return res.status(500).json({ error: "Angel One API error" }); }
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

  let isFetchingUpstox = false;
  const fetchRealPrices = async () => {
    if (isFetchingUpstox) return;
    isFetchingUpstox = true;
    try {
      const { rows } = await query("SELECT access_token FROM user_tokens WHERE broker = 'upstox' LIMIT 1");
      const userToken = rows[0];
      if (!userToken) return;

      const stockKeys = stocks.map(s => `NSE_EQ|${s}`);
      const indexKeys = Object.values(indexMap).flat();
      const allKeys = [...stockKeys, ...indexKeys].join(',');
      
      const response = await fetch(`https://api.upstox.com/v2/market-quote/quotes?instrument_key=${allKeys}`, { headers: { "Authorization": `Bearer ${userToken.access_token}`, "Accept": "application/json" }, signal: AbortSignal.timeout(4000) });
      
      if (!response.ok) {
        if (response.status === 401) await query("DELETE FROM user_tokens WHERE broker = 'upstox'");
        return;
      }
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
    } catch (e) { console.error("[MarketData] Error:", e); } finally { isFetchingUpstox = false; }
  };

  let isFetchingAngel = false;
  const fetchAngelOnePrices = async () => {
    if (isFetchingAngel) return;
    isFetchingAngel = true;
    try {
      const { rows } = await query("SELECT access_token FROM user_tokens WHERE broker = 'angelone' LIMIT 1");
      const userToken = rows[0];
      if (!userToken) return;

      const response = await fetch("https://apiconnect.angelone.in/rest/auth/angelone/market/v1/quote", {
        method: "POST", headers: { "X-PrivateKey": process.env.ANGEL_ONE_API_KEY!, "X-SourceID": "WEB", "Authorization": `Bearer ${userToken.access_token}`, "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ mode: "LTP", exchangeTokens: { NSE: ["3045", "99926000", "99926009"] } }), signal: AbortSignal.timeout(4000)
      });
      const data = await response.json();
      if (data.status && data.data?.fetched) {
        data.data.fetched.forEach((item: any) => { if (allSymbols.includes(item.tradingSymbol)) stockPrices[item.tradingSymbol] = item.ltp; });
      }
    } catch (e) { } finally { isFetchingAngel = false; }
  };

  app.post("/api/market/refresh", authenticateToken, async (req: any, res: any) => {
    await fetchRealPrices();
    res.json({ success: true, last_prices: stockPrices });
  });

  fetchRealPrices();
  setInterval(fetchRealPrices, 5000);
  setInterval(fetchAngelOnePrices, 5000);

  setInterval(async () => {
    try {
      const { rows } = await query("SELECT COUNT(*) as count FROM user_tokens");
      if (parseInt(rows[0].count) === 0) {
        allSymbols.forEach(symbol => { stockPrices[symbol] += stockPrices[symbol] * (Math.random() * 0.0002 - 0.0001); });
      }
    } catch (e) {}

    const payload = JSON.stringify({ type: 'ticker', data: stockPrices });
    wss.clients.forEach(c => { if (c.readyState === WebSocket.OPEN) c.send(payload); });
  }, 1000);

  app.get("/api/market-status", async (req, res) => {
    try {
      const { rows: countRows } = await query("SELECT COUNT(*) as count FROM user_tokens");
      const { rows: tokens } = await query("SELECT user_id, updated_at FROM user_tokens");
      res.json({ is_fetching: parseInt(countRows[0].count) > 0, token_count: parseInt(countRows[0].count), tokens, last_prices: stockPrices, api_key_set: !!process.env.UPTOX_API_KEY, market_hours: { open: "09:15", close: "15:30", timezone: "Asia/Kolkata" } });
    } catch (e) { res.status(500).json({ error: "Status fail" }); }
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
    console.log(`[Server] AAPA CAPITAL server running on http://0.0.0.0:3000`);
  });
}

startServer().catch(console.error);