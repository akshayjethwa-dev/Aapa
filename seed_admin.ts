import bcrypt from 'bcryptjs';
import { pool } from './src/db/index'; 
import { logger } from './src/utils/logger'; // Import the new logger

const adminEmail = process.env.ADMIN_EMAIL;
const adminPassword = process.env.ADMIN_PASSWORD;

async function seed() {
  if (!adminEmail || !adminPassword) {
    logger.error('ADMIN_EMAIL and ADMIN_PASSWORD env vars are required');
    process.exit(1);
  }

  try {
    const passwordHash = await bcrypt.hash(adminPassword, 12);
    
    await pool.query(
      `INSERT INTO users (email, password, role) 
       VALUES ($1, $2, 'admin') 
       ON CONFLICT (email) DO NOTHING`,
      [adminEmail, passwordHash]
    );

    logger.info(`Admin user created/verified: ${adminEmail}`);
  } catch (error) {
    logger.error('Error seeding admin user', error);
  } finally {
    process.exit(0);
  }
}

seed();