import Database from "better-sqlite3";
const db = new Database("sqlite.db");

try {
    // 1. Delete the duplicate user with lowercase email but no mobile (User 1)
    // We assume User 2 is the "correct" one because it has the mobile number.
    const deleteResult = db.prepare("DELETE FROM users WHERE id = 1").run();
    console.log("Deleted User 1:", deleteResult.changes);

    // 2. Update User 2 to have lowercase email and promote to admin
    const updateResult = db.prepare("UPDATE users SET email = LOWER(email), role = 'admin' WHERE id = 2").run();
    console.log("Updated User 2 email and promoted to admin:", updateResult.changes);

    // 3. Verify
    const users = db.prepare("SELECT * FROM users").all();
    console.log("Remaining Users:", JSON.stringify(users, null, 2));
} catch (e) {
    console.error("Database fix failed:", e);
}
