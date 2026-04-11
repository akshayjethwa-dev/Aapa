// check_pg.ts
import { query } from "./src/db/index.js";

async function checkDatabase() {
  try {
    const usersResult = await query("SELECT * FROM users");
    console.log("Users:", JSON.stringify(usersResult.rows, null, 2));

    const whitelistResult = await query("SELECT * FROM beta_whitelist");
    console.log("Whitelist:", JSON.stringify(whitelistResult.rows, null, 2));

  } catch (error) {
    console.error("Error querying database:", error);
  } finally {
    process.exit(0);
  }
}

checkDatabase();