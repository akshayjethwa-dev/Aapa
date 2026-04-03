import Database from "better-sqlite3";
import bcrypt from "bcryptjs";

const db = new Database("sqlite.db");

async function seed() {
  const admins = [
    { email: "bharvadvijay371@gmail.com", password: "Aniket@371" },
    { email: "dwarkeshtrading7@gmail.com", password: "Aniket@371" }
  ];

  for (const admin of admins) {
    const hashedPassword = await bcrypt.hash(admin.password, 10);
    try {
      db.prepare("INSERT OR IGNORE INTO users (email, password, role, balance) VALUES (?, ?, ?, ?)").run(
        admin.email, 
        hashedPassword, 
        'admin',
        100000
      );
      console.log(`Admin user created: ${admin.email}`);
    } catch (e) {
      db.prepare("UPDATE users SET role = 'admin' WHERE email = ?").run(admin.email);
      console.log(`User ${admin.email} promoted to admin`);
    }

    try {
      db.prepare("INSERT OR IGNORE INTO beta_whitelist (identifier, is_approved) VALUES (?, 1)").run(admin.email);
      console.log(`Admin ${admin.email} added to beta whitelist`);
    } catch (e) {
      console.log(`Admin ${admin.email} already in whitelist`);
    }
  }
}

seed();
