// src/routes/watchlists.ts
// ─────────────────────────────────────────────────────────────────────────────
// Endpoints (all require JWT via authenticate middleware in server.ts):
//
//   GET    /api/watchlists                        → list all watchlists + items
//   POST   /api/watchlists                        → create a new watchlist
//   PUT    /api/watchlists/:id                    → rename / reorder items
//   DELETE /api/watchlists/:id                    → delete a watchlist
//   POST   /api/watchlists/:id/items              → add a symbol
//   DELETE /api/watchlists/:id/items/:itemId      → remove a symbol
//
// Wire in server.ts:
//   import watchlistsRouter from './routes/watchlists';
//   app.use('/api/watchlists', authenticate, watchlistsRouter);
// ─────────────────────────────────────────────────────────────────────────────

import { Router, Response } from 'express';
import { query } from '../db/index';
import { logger } from '../utils/logger';

const router = Router();

// ─── helpers ──────────────────────────────────────────────────────────────────

/** Verify the watchlist belongs to the requesting user; return the row or null */
async function ownedWatchlist(watchlistId: string, userId: string) {
  const { rows } = await query(
    `SELECT id, name FROM user_watchlists WHERE id = $1 AND user_id = $2`,
    [watchlistId, userId]
  );
  return rows[0] || null;
}

// ─── GET /api/watchlists ──────────────────────────────────────────────────────
// Returns all watchlists for the current user, each with its items array
// sorted by sort_order ASC.
router.get('/', async (req: any, res: Response) => {
  try {
    const { rows } = await query(
      `SELECT
         w.id,
         w.name,
         w.created_at,
         w.updated_at,
         COALESCE(
           json_agg(
             json_build_object(
               'id',         i.id,
               'symbol',     i.symbol,
               'sort_order', i.sort_order,
               'added_at',   i.added_at
             ) ORDER BY i.sort_order ASC
           ) FILTER (WHERE i.id IS NOT NULL),
           '[]'
         ) AS items
       FROM  user_watchlists      w
       LEFT  JOIN user_watchlist_items i ON i.watchlist_id = w.id
       WHERE w.user_id = $1
       GROUP BY w.id
       ORDER BY w.created_at ASC`,
      [req.user.id]
    );

    return res.json(rows);
  } catch (e) {
    logger.error('[GET /api/watchlists] Error:', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/watchlists ─────────────────────────────────────────────────────
// Body: { name: string }
// Creates a new empty watchlist. Max 10 watchlists per user.
router.post('/', async (req: any, res: Response) => {
  const { name } = req.body;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ error: 'name is required' });
  }
  if (name.trim().length > 50) {
    return res.status(400).json({ error: 'name must be ≤ 50 characters' });
  }

  try {
    // Enforce per-user limit
    const { rows: countRows } = await query(
      `SELECT COUNT(*) FROM user_watchlists WHERE user_id = $1`,
      [req.user.id]
    );
    if (parseInt(countRows[0].count, 10) >= 10) {
      return res.status(400).json({ error: 'Maximum 10 watchlists allowed per user' });
    }

    const { rows } = await query(
      `INSERT INTO user_watchlists (user_id, name)
       VALUES ($1, $2)
       RETURNING id, name, created_at, updated_at`,
      [req.user.id, name.trim()]
    );

    logger.info(`[watchlists] User ${req.user.id} created watchlist "${rows[0].name}"`);
    return res.status(201).json({ ...rows[0], items: [] });
  } catch (e) {
    logger.error('[POST /api/watchlists] Error:', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── PUT /api/watchlists/:id ──────────────────────────────────────────────────
// Body: { name?: string, items?: Array<{ id: string, sort_order: number }> }
// Can rename the watchlist AND/OR reorder its items in one call.
router.put('/:id', async (req: any, res: Response) => {
  const { id } = req.params;
  const { name, items } = req.body;

  try {
    const wl = await ownedWatchlist(id, req.user.id);
    if (!wl) return res.status(404).json({ error: 'Watchlist not found' });

    // 1. Rename if provided
    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({ error: 'name must be a non-empty string' });
      }
      if (name.trim().length > 50) {
        return res.status(400).json({ error: 'name must be ≤ 50 characters' });
      }
      await query(
        `UPDATE user_watchlists SET name = $1 WHERE id = $2`,
        [name.trim(), id]
      );
    }

    // 2. Reorder items if provided: array of { id, sort_order }
    if (Array.isArray(items) && items.length > 0) {
      // Use a single UPDATE … FROM (VALUES …) for efficiency
      const values = items
        .map((_, idx) => `($${idx * 2 + 1}::uuid, $${idx * 2 + 2}::int)`)
        .join(', ');
      const params = items.flatMap(item => [item.id, item.sort_order]);

      await query(
        `UPDATE user_watchlist_items AS wi
         SET    sort_order = v.sort_order
         FROM   (VALUES ${values}) AS v(id, sort_order)
         WHERE  wi.id           = v.id
         AND    wi.watchlist_id = $${params.length + 1}`,
        [...params, id]
      );
    }

    // Return the full updated watchlist with items
    const { rows } = await query(
      `SELECT
         w.id, w.name, w.created_at, w.updated_at,
         COALESCE(
           json_agg(
             json_build_object(
               'id',         i.id,
               'symbol',     i.symbol,
               'sort_order', i.sort_order,
               'added_at',   i.added_at
             ) ORDER BY i.sort_order ASC
           ) FILTER (WHERE i.id IS NOT NULL),
           '[]'
         ) AS items
       FROM  user_watchlists      w
       LEFT  JOIN user_watchlist_items i ON i.watchlist_id = w.id
       WHERE w.id = $1
       GROUP BY w.id`,
      [id]
    );

    return res.json(rows[0]);
  } catch (e) {
    logger.error('[PUT /api/watchlists/:id] Error:', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── DELETE /api/watchlists/:id ───────────────────────────────────────────────
// Deletes the watchlist and all its items (CASCADE handles the items).
// Will not allow deletion if it's the user's only watchlist.
router.delete('/:id', async (req: any, res: Response) => {
  const { id } = req.params;

  try {
    const wl = await ownedWatchlist(id, req.user.id);
    if (!wl) return res.status(404).json({ error: 'Watchlist not found' });

    const { rows: countRows } = await query(
      `SELECT COUNT(*) FROM user_watchlists WHERE user_id = $1`,
      [req.user.id]
    );
    if (parseInt(countRows[0].count, 10) <= 1) {
      return res.status(400).json({ error: 'Cannot delete the last remaining watchlist' });
    }

    await query(`DELETE FROM user_watchlists WHERE id = $1`, [id]);

    logger.info(`[watchlists] User ${req.user.id} deleted watchlist ${id}`);
    return res.status(204).send();
  } catch (e) {
    logger.error('[DELETE /api/watchlists/:id] Error:', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/watchlists/:id/items ──────────────────────────────────────────
// Body: { symbol: string }
// Adds a symbol to the watchlist. Max 50 symbols per watchlist.
// sort_order defaults to MAX(current) + 1 so new item appends to the end.
router.post('/:id/items', async (req: any, res: Response) => {
  const { id } = req.params;
  const { symbol } = req.body;

  if (!symbol || typeof symbol !== 'string' || symbol.trim().length === 0) {
    return res.status(400).json({ error: 'symbol is required' });
  }

  try {
    const wl = await ownedWatchlist(id, req.user.id);
    if (!wl) return res.status(404).json({ error: 'Watchlist not found' });

    // Enforce item limit
    const { rows: countRows } = await query(
      `SELECT COUNT(*) FROM user_watchlist_items WHERE watchlist_id = $1`,
      [id]
    );
    if (parseInt(countRows[0].count, 10) >= 50) {
      return res.status(400).json({ error: 'Maximum 50 symbols allowed per watchlist' });
    }

    // Compute next sort_order
    const { rows: maxRows } = await query(
      `SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order
       FROM user_watchlist_items WHERE watchlist_id = $1`,
      [id]
    );
    const nextOrder: number = maxRows[0].next_order;

    const { rows } = await query(
      `INSERT INTO user_watchlist_items (watchlist_id, symbol, sort_order)
       VALUES ($1, $2, $3)
       ON CONFLICT (watchlist_id, symbol) DO NOTHING
       RETURNING id, symbol, sort_order, added_at`,
      [id, symbol.trim().toUpperCase(), nextOrder]
    );

    if (!rows[0]) {
      return res.status(409).json({ error: `${symbol.toUpperCase()} is already in this watchlist` });
    }

    return res.status(201).json(rows[0]);
  } catch (e) {
    logger.error('[POST /api/watchlists/:id/items] Error:', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── DELETE /api/watchlists/:id/items/:itemId ─────────────────────────────────
// Removes a single symbol from the watchlist.
router.delete('/:id/items/:itemId', async (req: any, res: Response) => {
  const { id, itemId } = req.params;

  try {
    const wl = await ownedWatchlist(id, req.user.id);
    if (!wl) return res.status(404).json({ error: 'Watchlist not found' });

    const { rowCount } = await query(
      `DELETE FROM user_watchlist_items
       WHERE id = $1 AND watchlist_id = $2`,
      [itemId, id]
    );

    if (rowCount === 0) {
      return res.status(404).json({ error: 'Item not found in this watchlist' });
    }

    return res.status(204).send();
  } catch (e) {
    logger.error('[DELETE /api/watchlists/:id/items/:itemId] Error:', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;