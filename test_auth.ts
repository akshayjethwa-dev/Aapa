import bcrypt from 'bcryptjs';
import { query, pool } from './src/db/index';

const testAuth = async () => {
  const login = 'bharvadvijay371@gmail.com';
  // We seeded this password during the migration
  const testPassword = 'Aniket@371'; 

  try {
    const { rows } = await query("SELECT * FROM users WHERE email = $1", [login]);
    const user = rows[0];

    if (user) {
        console.log("User found:", user.email);
        console.log("Password hash in DB:", user.password);
        
        // Let's also test if the hash matching works
        const isMatch = await bcrypt.compare(testPassword, user.password);
        console.log(`Does password '${testPassword}' match the hash?`, isMatch);
    } else {
        console.log("User not found in PostgreSQL database");
    }
  } catch (error) {
    console.error("Error querying database:", error);
  } finally {
    // Close the connection pool so the script can exit cleanly
    await pool.end();
  }
};

testAuth();