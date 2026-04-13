import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Handle unexpected errors on idle clients to prevent Node.js from crashing
pool.on('error', (err, client) => {
  console.error('[DB] Unexpected error on idle database client:', err.message);
});

// Reusable query helper
export const query = async (text: string, params?: any[]) => {
  return pool.query(text, params);
};