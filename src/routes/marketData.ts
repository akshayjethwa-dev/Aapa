// src/routes/marketData.ts
// Real data for Dashboard widgets — uses instruments table (no hardcoded keys)
//
//  GET /api/market/vix            — India VIX + Advance/Decline (Nifty 50)
//  GET /api/market/volume-rockers — Top volume surge stocks
//  GET /api/market/movers         — Top gainers and losers from Nifty 50 basket
//  GET /api/market/news           — Real news via NewsData.io
//  GET /api/market/stocks-in-news — News-mentioned stocks + live Upstox price
//  GET /api/market/events         — Market events from market_events table

import { Router, Request, Response } from 'express';
import axios from 'axios';

const router = Router();

// ── In-memory cache ──────────────────────────────────────────────────────────
const cache: Record<string, { data: any; expiry: number }> = {};
const CACHE_TTL = {
  vix:            60_000,      // 1 min  — VIX changes fast
  volumeRockers:  120_000,     // 2 min
  movers:         60_000,      // 1 min  — Top gainers/losers change fast
  news:           15 * 60_000, // 15 min
  events:         60 * 60_000, // 1 hour
};

function getCache(key: string) {
  const entry = cache[key];
  if (entry && Date.now() < entry.expiry) return entry.data;
  return null;
}
function setCache(key: string, data: any, ttl: number) {
  cache[key] = { data, expiry: Date.now() + ttl };
}

// ── Helper: get active Upstox token from any logged-in user ─────────────────
async function getAnyUpstoxToken(db: any): Promise<string | null> {
  try {
    const r = await db.query(
      `SELECT uptox_access_token FROM users
       WHERE uptox_access_token IS NOT NULL
         AND uptox_token_expiry > NOW()
       LIMIT 1`
    );
    return r.rows[0]?.uptox_access_token || null;
  } catch {
    return null;
  }
}

// ── Helper: look up instrument_key(s) from your instruments table ────────────
async function getInstrumentKeys(
  db: any,
  symbols: string[],
  exchange = 'NSE',
  instrType = 'EQ'
): Promise<Record<string, string>> {
  if (!symbols.length) return {};
  try {
    const r = await db.query(
      `SELECT tradingsymbol, instrument_key
       FROM instruments
       WHERE tradingsymbol = ANY($1)
         AND exchange = $2
         AND instrument_type = $3`,
      [symbols, exchange, instrType]
    );
    const map: Record<string, string> = {};
    r.rows.forEach((row: any) => { map[row.tradingsymbol] = row.instrument_key; });
    return map;
  } catch (e: any) {
    console.error('[getInstrumentKeys] error:', e.message);
    return {};
  }
}

// ── Helper: get instrument_key for a single INDEX
async function getIndexKey(db: any, name: string): Promise<string | null> {
  try {
    const r = await db.query(
      `SELECT instrument_key FROM instruments
       WHERE (name ILIKE $1 OR tradingsymbol ILIKE $1)
         AND instrument_type IN ('INDEX','UNDIND')
         AND exchange = 'NSE'
       LIMIT 1`,
      [`%${name}%`]
    );
    return r.rows[0]?.instrument_key || null;
  } catch {
    return null;
  }
}

// ── Helper: get top N liquid NSE EQ stocks from instruments table ─────────────
async function getTopNiftyStocks(db: any, limit = 50): Promise<Array<{ symbol: string; key: string }>> {
  try {
    const nifty50 = [
      'RELIANCE','TCS','HDFCBANK','ICICIBANK','INFY','HINDUNILVR','ITC','SBIN',
      'BHARTIARTL','KOTAKBANK','LT','AXISBANK','BAJFINANCE','MARUTI','HCLTECH',
      'SUNPHARMA','WIPRO','TITAN','POWERGRID','NTPC','ONGC','ULTRACEMCO','ADANIENT',
      'ADANIPORTS','BAJAJFINSV','DIVISLAB','DRREDDY','EICHERMOT','GRASIM','HEROMOTOCO',
      'HINDALCO','JSWSTEEL','M&M','NESTLEIND','SBILIFE','SHRIRAMFIN','TATAMOTORS',
      'TATACONSUM','TATASTEEL','TECHM','BPCL','CIPLA','COALINDIA','HDFCLIFE',
      'INDUSINDBK','LTIM','TRENT','APOLLOHOSP','BRITANNIA','BAJAJ-AUTO'
    ];

    const r = await db.query(
      `SELECT tradingsymbol, instrument_key
       FROM instruments
       WHERE tradingsymbol = ANY($1)
         AND exchange = 'NSE'
         AND instrument_type = 'EQ'
       ORDER BY array_position($1::text[], tradingsymbol)
       LIMIT $2`,
      [nifty50, limit]
    );
    return r.rows.map((row: any) => ({ symbol: row.tradingsymbol, key: row.instrument_key }));
  } catch (e: any) {
    console.error('[getTopNiftyStocks] error:', e.message);
    return [];
  }
}

// ── Helper: format news publish time ────────────────────────────────────────
function formatNewsTime(pubDate: string): string {
  if (!pubDate) return '';
  const diff = Math.floor((Date.now() - new Date(pubDate).getTime()) / 1000);
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ── Helper: batch Upstox quotes (max 500 keys per call) ─────────────────────
async function fetchUpstoxQuotes(token: string, keys: string[]): Promise<Record<string, any>> {
  if (!keys.length) return {};
  try {
    const BATCH = 100;
    const all: Record<string, any> = {};

    for (let i = 0; i < keys.length; i += BATCH) {
      const batch = keys.slice(i, i + BATCH).join(',');
      const r = await axios.get('https://api.upstox.com/v2/market-quote/quotes', {
        params: { instrument_key: batch },
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        timeout: 8000,
      });
      Object.assign(all, r.data?.data || {});
    }
    return all;
  } catch (e: any) {
    console.error('[fetchUpstoxQuotes] error:', e?.response?.data || e.message);
    return {};
  }
}

// ── GET /api/market/vix ──────────────────────────────────────────────────────
router.get('/vix', async (req: Request, res: Response) => {
  const cached = getCache('vix');
  if (cached) return res.json(cached);

  const db    = (req as any).db;
  const token = await getAnyUpstoxToken(db);

  if (!token) {
    return res.json({
      vix: null, vixChange: null, advance: null, decline: null,
      source: 'unavailable',
      message: 'No active Upstox session. Connect Upstox to see live VIX.',
    });
  }

  try {
    const vixKey = await getIndexKey(db, 'India VIX');
    const niftyStocks = await getTopNiftyStocks(db, 30);
    const niftyKeys   = niftyStocks.map(s => s.key).filter(Boolean);

    const allKeys = [...(vixKey ? [vixKey] : []), ...niftyKeys];
    const quotes  = await fetchUpstoxQuotes(token, allKeys);

    let vix: number | null       = null;
    let vixChange: number | null = null;

    if (vixKey) {
      const vixQuote = Object.values(quotes).find((q: any) =>
        q.instrument_token === vixKey || q.trading_symbol?.includes('VIX')
      ) as any;
      if (vixQuote) {
        vix = parseFloat((vixQuote.last_price ?? 0).toFixed(2));
        const close = vixQuote.ohlc?.close ?? 0;
        if (vix && close) vixChange = parseFloat(((vix - close) / close * 100).toFixed(2));
      }
    }

    let advance = 0, decline = 0;
    niftyStocks.forEach(({ key }) => {
      const q = quotes[key] || Object.values(quotes).find((v: any) => v.instrument_token === key) as any;
      if (!q) return;
      const chg = q.net_change ?? (q.last_price - (q.ohlc?.close ?? q.last_price));
      if (chg > 0) advance++;
      else if (chg < 0) decline++;
    });

    const payload = { vix, vixChange, advance, decline, total: niftyStocks.length, source: 'upstox', ts: new Date().toISOString() };
    setCache('vix', payload, CACHE_TTL.vix);
    return res.json(payload);

  } catch (err: any) {
    return res.json({ vix: null, vixChange: null, advance: null, decline: null, source: 'error' });
  }
});

// ── GET /api/market/volume-rockers ───────────────────────────────────────────
router.get('/volume-rockers', async (req: Request, res: Response) => {
  const cached = getCache('volumeRockers');
  if (cached) return res.json(cached);

  const db    = (req as any).db;
  const token = await getAnyUpstoxToken(db);

  if (!token) return res.json({ data: [], source: 'unavailable' });

  try {
    const stocks = await getTopNiftyStocks(db, 50);
    const keys   = stocks.map(s => s.key).filter(Boolean);

    const keyToSymbol: Record<string, string> = {};
    stocks.forEach(s => { keyToSymbol[s.key] = s.symbol; });

    const quotes  = await fetchUpstoxQuotes(token, keys);
    const rockers: any[] = [];

    Object.entries(quotes).forEach(([responseKey, q]: [string, any]) => {
      const symbol = q.trading_symbol || keyToSymbol[q.instrument_token] || keyToSymbol[responseKey] || responseKey.split(':')[1];
      const ltp       = q.last_price ?? 0;
      const volume    = q.volume ?? q.tot_trd_qnty ?? 0;
      const avgVolume = q.average_volume_20days ?? q.avg_volume_20d ?? 0;

      if (volume > 0 && avgVolume > 0) {
        const ratio = volume / avgVolume;
        if (ratio >= 2.0) {
          const close  = q.ohlc?.close ?? ltp;
          const change = close ? parseFloat(((ltp - close) / close * 100).toFixed(2)) : 0;
          rockers.push({
            symbol, price: parseFloat(ltp.toFixed(2)), change, volumeMultiplier: `${ratio.toFixed(1)}x`, volume,
          });
        }
      }
    });

    rockers.sort((a, b) => parseFloat(b.volumeMultiplier) - parseFloat(a.volumeMultiplier));

    const payload = { data: rockers.slice(0, 5), source: 'upstox', ts: new Date().toISOString() };
    setCache('volumeRockers', payload, CACHE_TTL.volumeRockers);
    return res.json(payload);
  } catch (err: any) {
    return res.json({ data: [], source: 'error' });
  }
});

// ── GET /api/market/movers ───────────────────────────────────────────────────
// Top Gainers and Losers from the Nifty 50 basket
router.get('/movers', async (req: Request, res: Response) => {
  const cached = getCache('movers');
  if (cached) return res.json(cached);

  const db    = (req as any).db;
  const token = await getAnyUpstoxToken(db);

  if (!token) return res.json({ gainers: [], losers: [], source: 'unavailable' });

  try {
    // 1. Fetch Nifty 50 stocks dynamically from the DB
    const stocks = await getTopNiftyStocks(db, 50);
    const keys   = stocks.map(s => s.key).filter(Boolean);

    const keyToSymbol: Record<string, string> = {};
    stocks.forEach(s => { keyToSymbol[s.key] = s.symbol; });

    // 2. Fetch live quotes for the entire basket
    const quotes = await fetchUpstoxQuotes(token, keys);
    const movers: any[] = [];

    // 3. Calculate % change for each
    Object.entries(quotes).forEach(([responseKey, q]: [string, any]) => {
      const symbol = q.trading_symbol || keyToSymbol[q.instrument_token] || keyToSymbol[responseKey] || responseKey.split(':')[1];
      const ltp = q.last_price ?? 0;
      const close = q.ohlc?.close ?? ltp;
      const absChange = parseFloat((ltp - close).toFixed(2));
      const changePct = close ? parseFloat(((ltp - close) / close * 100).toFixed(2)) : 0;

      if (ltp > 0) {
        movers.push({
          symbol,
          lastPrice: parseFloat(ltp.toFixed(2)),
          change: absChange,
          changePercent: changePct,
        });
      }
    });

    // 4. Sort and split into gainers and losers
    movers.sort((a, b) => b.changePercent - a.changePercent);

    const payload = { 
      gainers: movers.slice(0, 5), 
      losers: movers.slice(-5).reverse(), // bottom 5, worst performance first
      source: 'upstox', 
      ts: new Date().toISOString() 
    };

    setCache('movers', payload, CACHE_TTL.movers);
    return res.json(payload);
  } catch (err: any) {
    console.error('[marketData] /movers error:', err?.response?.data || err.message);
    return res.json({ gainers: [], losers: [], source: 'error' });
  }
});

// ── GET /api/market/news ─────────────────────────────────────────────────────
router.get('/news', async (_req: Request, res: Response) => {
  const cached = getCache('news');
  if (cached) return res.json(cached);

  const apiKey = process.env.NEWSDATA_API_KEY;
  if (!apiKey) {
    return res.json({ data: [], source: 'unavailable', message: 'NEWSDATA_API_KEY not set' });
  }

  try {
    const r = await axios.get('https://newsdata.io/api/1/news', {
      params: {
        apikey:   apiKey,
        q:        'NSE OR BSE OR Sensex OR Nifty OR stock market',
        country:  'in',
        language: 'en',
        category: 'business',
        size:     10,
      },
      timeout: 10000,
    });

    const articles = (r.data?.results || []).slice(0, 8).map((a: any) => ({
      id:       a.article_id,
      headline: a.title,
      source:   a.source_id || a.source_name || 'News',
      time:     formatNewsTime(a.pubDate),
      url:      a.link,
      thumb:    a.image_url || null,
    }));

    const payload = { data: articles, source: 'newsdata.io', ts: new Date().toISOString() };
    setCache('news', payload, CACHE_TTL.news);
    return res.json(payload);

  } catch (err: any) {
    console.error('[marketData] /news error:', err?.response?.data || err.message);
    return res.json({ data: [], source: 'error' });
  }
});

// ── GET /api/market/stocks-in-news ──────────────────────────────────────────
router.get('/stocks-in-news', async (req: Request, res: Response) => {
  const cached = getCache('stocksInNews');
  if (cached) return res.json(cached);

  const apiKey = process.env.NEWSDATA_API_KEY;
  const db     = (req as any).db;
  const token  = await getAnyUpstoxToken(db);

  if (!apiKey) return res.json({ data: [], source: 'unavailable' });

  try {
    const newsResp = await axios.get('https://newsdata.io/api/1/news', {
      params: {
        apikey:   apiKey,
        q:        'NSE stock shares India market earnings',
        country:  'in',
        language: 'en',
        category: 'business',
        size:     20,
      },
      timeout: 10000,
    });

    const headlines: string = (newsResp.data?.results || [])
      .map((a: any) => `${a.title || ''} ${a.description || ''}`)
      .join(' ');

    const headlineArticles = newsResp.data?.results || [];

    if (!headlines.trim()) return res.json({ data: [], source: 'no_news' });

    const words = headlines.match(/\b[A-Z][A-Z0-9&\-]{1,14}\b/g) || [];
    const candidates = [...new Set(words)].filter(w =>
      w.length >= 2 &&
      !['NSE','BSE','IPO','FII','DII','RBI','SEBI','GDP','CPI','EMI','CEO','CFO','MD','AGM','EPS','PAT','EBITDA','QOQ','YOY'].includes(w)
    );

    if (!candidates.length) return res.json({ data: [], source: 'no_match' });

    const r = await db.query(
      `SELECT tradingsymbol, instrument_key, name
       FROM instruments
       WHERE tradingsymbol = ANY($1)
         AND exchange = 'NSE'
         AND instrument_type = 'EQ'
       LIMIT 10`,
      [candidates]
    );

    if (!r.rows.length) return res.json({ data: [], source: 'no_match' });

    const matchedStocks: Array<{ symbol: string; key: string; name: string }> = r.rows.map((row: any) => ({
      symbol: row.tradingsymbol,
      key:    row.instrument_key,
      name:   row.name,
    }));

    let priceMap:  Record<string, number> = {};
    let changeMap: Record<string, number> = {};

    if (token && matchedStocks.length) {
      const quotes = await fetchUpstoxQuotes(token, matchedStocks.map(s => s.key));

      Object.values(quotes).forEach((q: any) => {
        const sym = q.trading_symbol;
        if (sym) {
          priceMap[sym]  = q.last_price;
          const close    = q.ohlc?.close ?? q.last_price;
          changeMap[sym] = close ? parseFloat(((q.last_price - close) / close * 100).toFixed(2)) : 0;
        }
      });
    }

    const tagForSymbol = (symbol: string): string => {
      const stockHeadlines = headlineArticles
        .filter((a: any) => `${a.title} ${a.description || ''}`.toUpperCase().includes(symbol))
        .map((a: any) => `${a.title} ${a.description || ''}`.toUpperCase())
        .join(' ');

      if (stockHeadlines.includes('RESULT') || stockHeadlines.includes('PROFIT') || stockHeadlines.includes('EARNINGS')) return 'Earnings';
      if (stockHeadlines.includes('DIVIDEND')) return 'Dividend';
      if (stockHeadlines.includes('ORDER') || stockHeadlines.includes('CONTRACT')) return 'Order Win';
      if (stockHeadlines.includes('ACQUI') || stockHeadlines.includes('MERGER')) return 'M&A';
      if (stockHeadlines.includes('PENALT') || stockHeadlines.includes('SEBI') || stockHeadlines.includes('REGULAT')) return 'Regulatory';
      if (stockHeadlines.includes('LAUNCH') || stockHeadlines.includes('EXPAND')) return 'Expansion';
      return 'In Focus';
    };

    const data = matchedStocks.slice(0, 5).map(s => ({
      symbol: s.symbol,
      name:   s.name,
      price:  priceMap[s.symbol]  ?? null,
      change: changeMap[s.symbol] ?? null,
      tag:    tagForSymbol(s.symbol),
      isLive: !!priceMap[s.symbol],
    }));

    const payload = { data, source: token ? 'newsdata.io+upstox' : 'newsdata.io', ts: new Date().toISOString() };
    setCache('stocksInNews', payload, CACHE_TTL.news);
    return res.json(payload);

  } catch (err: any) {
    console.error('[marketData] /stocks-in-news error:', err?.response?.data || err.message);
    return res.json({ data: [], source: 'error' });
  }
});

// ── GET /api/market/events ───────────────────────────────────────────────────
router.get('/events', async (req: Request, res: Response) => {
  const cached = getCache('events');
  if (cached) return res.json(cached);

  const filter = (req.query.filter as string) || 'upcoming';
  const db     = (req as any).db;

  try {
    const today   = new Date().toISOString().split('T')[0];
    let dateCeil  = '2099-12-31';

    if (filter === 'this_week') {
      const d = new Date(); d.setDate(d.getDate() + 7);
      dateCeil = d.toISOString().split('T')[0];
    } else if (filter === 'upcoming') {
      const d = new Date(); d.setDate(d.getDate() + 30);
      dateCeil = d.toISOString().split('T')[0];
    }

    const result = await db.query(
      `SELECT id, company, symbol, event_type, event_date, color
       FROM market_events
       WHERE is_active = TRUE
         AND event_date >= $1
         AND event_date <= $2
       ORDER BY event_date ASC
       LIMIT 10`,
      [today, dateCeil]
    );

    const now    = new Date();
    const events = result.rows.map((e: any) => {
      const eventDate = new Date(e.event_date);
      const diffDays  = Math.ceil((eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return {
        id:        e.id,
        company:   e.company,
        symbol:    e.symbol,
        type:      e.event_type,
        date:      eventDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
        countdown: diffDays <= 0 ? 'Today!' : diffDays === 1 ? 'Tomorrow' : `In ${diffDays} Days`,
        color:     e.color,
      };
    });

    const payload = { data: events, source: 'db', ts: new Date().toISOString() };
    setCache('events', payload, CACHE_TTL.events);
    return res.json(payload);

  } catch (err: any) {
    console.error('[marketData] /events error:', err.message);
    return res.json({ data: [], source: 'error' });
  }
});

export default router;