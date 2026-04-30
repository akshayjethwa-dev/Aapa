// scripts/sync_upstox_instruments.ts
import { gunzipSync } from 'zlib';
import { pool } from '../src/db/index.js'; // <-- Notice the .js extension here! Crucial for ESM.
import dotenv from 'dotenv';

dotenv.config();

const UPSTOX_URL = 'https://assets.upstox.com/market-quote/instruments/exchange/complete.json.gz';

async function syncInstruments() {
  console.log(`[${new Date().toISOString()}] Starting Upstox instrument sync...`);
  
  // Get a dedicated client from the pool for our transaction
  const client = await pool.connect();

  try {
    // 1. Fetch the compressed file (using Node native fetch)
    const response = await fetch(UPSTOX_URL);
    if (!response.ok) throw new Error(`Failed to fetch: ${response.statusText}`);
    const buffer = await response.arrayBuffer();

    // 2. Unzip and parse
    console.log("Unzipping data...");
    const unzipped = gunzipSync(Buffer.from(buffer));
    const json = JSON.parse(unzipped.toString('utf-8'));
    
    // Upstox JSON can be a record object or an array. Ensure we have an array.
    const rawInstruments = Array.isArray(json) ? json : Object.values(json);

    console.log(`Parsed ${rawInstruments.length} instruments. Upserting to PostgreSQL...`);

    // 3. Begin Transaction
    await client.query('BEGIN');

    // 4. Chunk the upsert to avoid hitting Postgres parameter limits (Max is 65535)
    // 2000 records * 10 columns = 20,000 parameters per chunk (Very safe)
    const CHUNK_SIZE = 2000; 
    
    for (let i = 0; i < rawInstruments.length; i += CHUNK_SIZE) {
      const chunk = rawInstruments.slice(i, i + CHUNK_SIZE);
      
      const values: any[] = [];
      const placeholders: string[] = [];
      let paramIdx = 1;

      for (const inst of chunk) {
        placeholders.push(`($${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, NOW())`);
        values.push(
          inst.instrument_key,
          inst.tradingsymbol,
          inst.name || '',
          inst.exchange || '',
          inst.instrument_type || '',
          inst.expiry ? new Date(inst.expiry).toISOString() : null,
          inst.strike || null,
          inst.tick_size || 0,
          inst.lot_size || 1
        );
      }

      const sql = `
        INSERT INTO instruments (
          instrument_key, tradingsymbol, name, exchange, instrument_type, expiry, strike, tick_size, lot_size, updated_at
        ) VALUES ${placeholders.join(', ')}
        ON CONFLICT (instrument_key) DO UPDATE SET
          tradingsymbol = EXCLUDED.tradingsymbol,
          name = EXCLUDED.name,
          exchange = EXCLUDED.exchange,
          instrument_type = EXCLUDED.instrument_type,
          expiry = EXCLUDED.expiry,
          strike = EXCLUDED.strike,
          tick_size = EXCLUDED.tick_size,
          lot_size = EXCLUDED.lot_size,
          updated_at = EXCLUDED.updated_at
      `;

      await client.query(sql, values);
      console.log(`Inserted chunk ${i} to ${i + chunk.length}`);
    }

    // 5. Commit Transaction
    await client.query('COMMIT');
    console.log(`[${new Date().toISOString()}] Sync completed successfully!`);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error("Sync failed:", error);
    process.exit(1);
  } finally {
    client.release();
  }
}

// Run the sync script
syncInstruments().then(() => process.exit(0));