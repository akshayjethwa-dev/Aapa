import bcrypt from 'bcrypt';
import { query } from './src/db';

async function seedAdmin() {
  // 1. Move the variables inside the function scope
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  // 2. TypeScript now sees this check directly before the variables are used
  if (!adminEmail || !adminPassword) {
    console.error('ADMIN_EMAIL and ADMIN_PASSWORD env vars are required');
    process.exit(1);
  }

  try {
    // TypeScript now knows 100% that adminPassword is a string
    const passwordHash = await bcrypt.hash(adminPassword, 12);

    await query(
      `INSERT INTO users (email, password_hash, role, is_approved) 
       VALUES ($1, $2, 'admin', true)
       ON CONFLICT (email) DO NOTHING`,
      [adminEmail, passwordHash]
    );

    console.log(`Admin user created: ${adminEmail}`);
    process.exit(0);
  } catch (error) {
    console.error("Failed to seed admin:", error);
    process.exit(1);
  }
}

seedAdmin();