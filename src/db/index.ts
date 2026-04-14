import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// ========================================================
// --- UPDATED FOR TASK 3.2: Connection Pooling Limits  ---
// ========================================================
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  // Added pooling limits to prevent DB exhaustion during traffic spikes
  max: 20,                       // Maximum 20 connections per server instance
  idleTimeoutMillis: 10000,      // Close idle connections after 10 seconds
  connectionTimeoutMillis: 2000, // Return an error after 2 seconds if DB is unresponsive
});
// ========================================================

// Handle unexpected errors on idle clients to prevent Node.js from crashing
pool.on('error', (err, client) => {
  console.error('[DB] Unexpected error on idle database client:', err.message);
});

// Reusable query helper
export const query = async (text: string, params?: any[]) => {
  return pool.query(text, params);
};