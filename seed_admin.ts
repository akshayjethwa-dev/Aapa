import bcrypt from 'bcrypt';
import { db } from './src/db'; // your DB connection

const adminEmail = process.env.ADMIN_EMAIL;
const adminPassword = process.env.ADMIN_PASSWORD;

if (!adminEmail || !adminPassword) {
  console.error('ADMIN_EMAIL and ADMIN_PASSWORD env vars are required');
  process.exit(1);
}

const passwordHash = await bcrypt.hash(adminPassword, 12);

await db.run(
  `INSERT OR IGNORE INTO users (email, password_hash, role, is_approved) 
   VALUES (?, ?, 'admin', 1)`,
  [adminEmail, passwordHash]
);

console.log(`Admin user created: ${adminEmail}`);