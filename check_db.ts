import Database from "better-sqlite3";
const db = new Database("sqlite.db");
const users = db.prepare("SELECT * FROM users").all();
console.log("Users:", JSON.stringify(users, null, 2));
const whitelist = db.prepare("SELECT * FROM beta_whitelist").all();
console.log("Whitelist:", JSON.stringify(whitelist, null, 2));
const tokens = db.prepare("SELECT * FROM user_tokens").all();
console.log("Tokens:", JSON.stringify(tokens, null, 2));
