import fs from 'fs';
import { pipeline } from 'stream/promises';
import zlib from 'zlib';
import { pool } from '../src/db/index.js'; // Adjust based on your db setup

// Upstox provides daily master CSV files
const UPSTOX_NSE_EQ_URL = 'https://assets.upstox.com/market-quote/instruments/exchange/NSE.csv.gz';
const UPSTOX_BSE_EQ_URL = 'https://assets.upstox.com/market-quote/instruments/exchange/BSE.csv.gz';

async function syncInstruments() {
  console.log('[Sync] Creating instruments table if not exists...');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS instruments (
      instrument_key VARCHAR(100) PRIMARY KEY,
      exchange_token VARCHAR(100),
      tradingsymbol VARCHAR(100),
      name VARCHAR(255),
      exchange VARCHAR(20),
      instrument_type VARCHAR(20)
    );
    -- Index for fast searching
    CREATE INDEX IF NOT EXISTS idx_instruments_search ON instruments USING gin(tradingsymbol gin_trgm_ops);
  `);

  console.log('[Sync] Table ready. Please use a library like "csv-parser" to fetch and insert the CSV data.');
  console.log('[Sync] Fetching NSE file from:', UPSTOX_NSE_EQ_URL);
  
  // Note: For a production app, you will download the .csv.gz file, 
  // unzip it using zlib, parse the CSV, and run an INSERT or UPSERT into the database.
  // Upstox columns are: instrument_key, exchange_token, tradingsymbol, name, last_price, expiry, strike, tick_size, lot_size, instrument_type, option_type, exchange
}

syncInstruments().catch(console.error);