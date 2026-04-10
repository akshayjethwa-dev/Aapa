import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from '../src/db/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to parse basic CSV (assumes no commas inside the actual data values for simplicity)
const parseCSV = (csvContent: string) => {
  const lines = csvContent.split('\n').filter(line => line.trim() !== '');
  const headers = lines[0].split(',').map(h => h.trim());
  const rows = lines.slice(1).map(line => {
    const values = line.split(',');
    return headers.reduce((obj: any, header, index) => {
      obj[header] = values[index]?.trim();
      return obj;
    }, {});
  });
  return rows;
};

const importUsers = async () => {
  const csvPath = path.join(__dirname, '..', 'data_export', 'users.csv');
  
  if (!fs.existsSync(csvPath)) {
    console.log('[Import] No users.csv found in /data_export directory. Skipping.');
    return;
  }

  const csvContent = fs.readFileSync(csvPath, 'utf8');
  const users = parseCSV(csvContent);

  console.log(`[Import] Found ${users.length} users to import.`);

  for (const user of users) {
    try {
      await pool.query(
        `INSERT INTO users (id, email, mobile, password, role, is_kyc_approved, is_uptox_connected, is_angelone_connected, balance, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (email) DO NOTHING`,
        [
          user.id, 
          user.email || null, 
          user.mobile || null, 
          user.password, 
          user.role || 'user', 
          user.is_kyc_approved === '1' || user.is_kyc_approved === 'true',
          user.is_uptox_connected === '1' || user.is_uptox_connected === 'true',
          user.is_angelone_connected === '1' || user.is_angelone_connected === 'true',
          parseFloat(user.balance) || 100000.0,
          user.created_at || new Date().toISOString()
        ]
      );
      console.log(`[Import] Imported user: ${user.email || user.mobile}`);
    } catch (err: any) {
      console.error(`[Import] Failed to import user ${user.email}:`, err.message);
    }
  }
  console.log('[Import] User import completed.');
};

const runMigration = async () => {
  console.log('[Import] Starting CSV to PostgreSQL migration...');
  await importUsers();
  // Add similar functions here for portfolios.csv, orders.csv, etc., as needed.
  console.log('[Import] All migrations finished.');
  process.exit(0);
};

runMigration();