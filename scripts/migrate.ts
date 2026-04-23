import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

import { pool } from "../src/db/index";
import { logger } from "../src/utils/logger";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const runMigrations = async () => {
  logger.info("[DB] Starting Database Migration Process...");
  try {
    let migrationsDir = path.join(__dirname, "..", "migrations");
    if (!fsSync.existsSync(migrationsDir)) {
      migrationsDir = path.join(__dirname, "migrations");
    }

    // List all migrations in order
    const migrations = [
      { file: "001_initial_schema.sql",             label: "001 Initial Schema" },
      { file: "002_add_audit_compliance_fields.sql", label: "002 Audit Fields" },
      { file: "003_add_broker_audit_logs.sql",       label: "003 Broker Audit Logs" },
      { file: "004_add_kyc_fields.sql",              label: "004 KYC Fields" },
      { file: "005_add_terms_accepted_field.sql",    label: "005 Terms Accepted" },
      { file: "006_enable_rls.sql",                  label: "006 Enable RLS" },
      { file: "007_add_expires_at_to_user_tokens.sql", label: "007 Token Expiry" },
      { file: "008_add_onboarding_fields.sql",       label: "008 Onboarding Fields" },
      { file: "009_add_risk_profile.sql",            label: "009 Risk Profile" },
      { file: "010_user_watchlists.sql",             label: "010 User Watchlists" },
    ];

    for (const migration of migrations) {
      try {
        const filePath = path.join(migrationsDir, migration.file);
        const sql = await fs.readFile(filePath, "utf8");
        await pool.query(sql);
        logger.info(`[DB] ✅ Migration ${migration.label} applied successfully.`);
      } catch (migErr) {
        logger.warn(`[DB] ⚠️  Skipping Migration ${migration.label}: File not found or already applied.`, migErr);
      }
    }

    logger.info("[DB] ✅ All migrations completed.");
    process.exit(0);
  } catch (error) {
    logger.error("[DB] ❌ Fatal error during migration:", error);
    process.exit(1);
  }
};

runMigrations();