import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,                       
  idleTimeoutMillis: 30000,      // Relaxed to 30 seconds
  connectionTimeoutMillis: 15000, // FIX: Relaxed from 2s to 15 seconds to allow cloud routing
});

pool.on('error', (err, client) => {
  console.error('[DB] Unexpected error on idle database client:', err.message);
});

export const query = async (text: string, params?: any[]) => {
  return pool.query(text, params);
};