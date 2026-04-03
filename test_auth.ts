import bcrypt from 'bcryptjs';
import Database from 'better-sqlite3';

const db = new Database('sqlite.db');
const login = 'bharvadvijay371@gmail.com';
const password = 'password'; // I don't know the actual password, but I can check if it exists

const user = db.prepare("SELECT * FROM users WHERE email = ?").get(login) as any;
if (user) {
    console.log("User found:", user.email);
    console.log("Password hash:", user.password);
} else {
    console.log("User not found");
}
