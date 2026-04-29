/**
 * src/routes/instruments.ts
 *
 * GET /api/instruments/search
 *   ?q=<query>                        — required, min 2 chars
 *   &exchange=NSE|BSE|NFO             — optional (default: NSE+BSE)
 *   &instrument_type=EQ|INDEX|FUT|OPT — optional (default: EQ+INDEX)
 *   &limit=<n>                        — optional, max 100, default 50
 *
 * Response: { instruments: Instrument[], total: number }
 */

import { Router, Request, Response } from 'express';
import { pool } from '../db/index.js';

const router = Router();

const VALID_EXCHANGES = new Set(['NSE', 'BSE', 'NFO', 'MCX', 'CDS', 'BFO']);
const VALID_TYPES     = new Set(['EQ', 'INDEX', 'FUT', 'OPT', 'OPTIDX', 'FUTIDX', 'UNDIND']);

router.get('/search', async (req: Request, res: Response) => {
  const q = ((req.query.q as string) ?? '').trim();
  if (q.length < 2) return res.json({ instruments: [], total: 0 });

  const exchangeParam = (req.query.exchange as string | undefined)?.toUpperCase();
  const typeParam     = (req.query.instrument_type as string | undefined)?.toUpperCase();
  const exchange  = exchangeParam && VALID_EXCHANGES.has(exchangeParam) ? exchangeParam : null;
  const instrType = typeParam    && VALID_TYPES.has(typeParam)    ? typeParam    : null;

  const limitRaw = parseInt((req.query.limit as string) ?? '50', 10);
  const limit    = isNaN(limitRaw) ? 50 : Math.min(Math.max(limitRaw, 1), 100);

  const params: unknown[] = [`%${q}%`]; // $1
  let paramIdx = 2;

  // Exchange clause — default to NSE+BSE (skip NFO noise)
  let exchangeClause = '';
  if (exchange) {
    exchangeClause = ` AND exchange = $${paramIdx}`;
    params.push(exchange);
    paramIdx++;
  } else {
    exchangeClause = ` AND exchange IN ('NSE','BSE')`;
  }

  // Type clause — default to EQ+INDEX
  let typeClause = '';
  if (instrType) {
    typeClause = ` AND instrument_type = $${paramIdx}`;
    params.push(instrType);
    paramIdx++;
  } else {
    typeClause = ` AND instrument_type IN ('EQ','INDEX','UNDIND')`;
  }

  // Escape single quotes in the prefix for the CASE score
  const safeQ = q.replace(/'/g, "''");

  const sql = `
    SELECT instrument_key, tradingsymbol, name, exchange, instrument_type
    FROM instruments
    WHERE (tradingsymbol ILIKE $1 OR name ILIKE $1)
      ${exchangeClause}
      ${typeClause}
    ORDER BY
      CASE
        WHEN tradingsymbol ILIKE '${safeQ}%' THEN 0
        WHEN tradingsymbol ILIKE $1           THEN 1
        ELSE 2
      END,
      length(tradingsymbol),
      tradingsymbol
    LIMIT ${limit}
  `;

  try {
    const result = await pool.query(sql, params);
    return res.json({ instruments: result.rows, total: result.rowCount ?? result.rows.length });
  } catch (error) {
    console.error('[instruments/search] DB error:', error);
    return res.status(500).json({ error: 'Failed to search instruments' });
  }
});

export default router;