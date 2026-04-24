import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  
  // =========================================================================
  // SUPABASE TRANSACTION POOLER CONFIGURATION (Phase 2 Upgrade)
  // =========================================================================
  // When using Supabase Transaction Mode (port 6543), we keep the local 
  // max connections low. The external Supavisor pooler handles high concurrency.
  max: 10,                       
  
  idleTimeoutMillis: 30000,      // Relaxed to 30 seconds to prevent constant tearing down
  connectionTimeoutMillis: 15000, // 15 seconds to allow cloud routing/DNS resolution
});

pool.on('error', (err, client) => {
  console.error('[DB] Unexpected error on idle database client:', err.message);
});

export const query = async (text: string, params?: any[]) => {
  return pool.query(text, params);
};