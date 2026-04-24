import { Router } from 'express';
import { pool } from '../db/index.js';

const router = Router();

router.get('/search', async (req, res) => {
  const query = req.query.q as string;
  
  if (!query || query.length < 2) {
    return res.json({ instruments: [] });
  }

  try {
    // The ILIKE uses the GIN index we created in the migration
    // We limit to 50 results to keep the payload tiny and the UI snappy
    const result = await pool.query(`
      SELECT instrument_key, tradingsymbol, name, exchange, instrument_type 
      FROM instruments 
      WHERE tradingsymbol ILIKE $1 OR name ILIKE $1
      LIMIT 50
    `, [`%${query}%`]);

    res.json({ instruments: result.rows });
  } catch (error) {
    console.error('Search API error:', error);
    res.status(500).json({ error: 'Failed to search instruments' });
  }
});

export default router;