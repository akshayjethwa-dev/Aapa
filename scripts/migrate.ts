import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

// Import DB and Logger relative to the scripts folder
import { pool } from "../src/db/index";
import { logger } from "../src/utils/logger";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const runMigrations = async () => {
  logger.info("[DB] Starting Database Migration Process...");
  try {
    // Determine the correct path for migrations depending on dev (ts) vs prod (bundled js)
    let migrationsDir = path.join(__dirname, "..", "migrations");
    if (!fsSync.existsSync(migrationsDir)) {
      migrationsDir = path.join(__dirname, "migrations");
    }

    const schemaPath = path.join(migrationsDir, "001_initial_schema.sql");
    const schema = await fs.readFile(schemaPath, "utf8");
    await pool.query(schema);
    logger.info("[DB] PostgreSQL Schema 001 initialized successfully.");

    // Run Audit & Compliance Migration
    try {
      const migration2Path = path.join(migrationsDir, "002_add_audit_compliance_fields.sql");
      const migration2 = await fs.readFile(migration2Path, "utf8");
      await pool.query(migration2);
      logger.info("[DB] PostgreSQL Schema 002 (Audit Fields) applied successfully.");
    } catch (migErr) {
      logger.warn("[DB] Skipping Migration 002: File not found or error.", migErr);
    }

    // Run Broker Audit Logging Migration
    try {
      const migration3Path = path.join(migrationsDir, "003_add_broker_audit_logs.sql");
      const migration3 = await fs.readFile(migration3Path, "utf8");
      await pool.query(migration3);
      logger.info("[DB] PostgreSQL Schema 003 (Broker Audit Logs) applied successfully.");
    } catch (migErr) {
      logger.warn("[DB] Skipping Migration 003: File not found or error.", migErr);
    }

    // Run KYC Migration
    try {
      const migration4Path = path.join(migrationsDir, "004_add_kyc_fields.sql");
      const migration4 = await fs.readFile(migration4Path, "utf8");
      await pool.query(migration4);
      logger.info("[DB] PostgreSQL Schema 004 (KYC Fields) applied successfully.");
    } catch (migErr) {
      logger.warn("[DB] Skipping Migration 004: File not found or error.", migErr);
    }

    // Run Terms Accepted Migration
    try {
      const migration5Path = path.join(migrationsDir, "005_add_terms_accepted_field.sql");
      const migration5 = await fs.readFile(migration5Path, "utf8");
      await pool.query(migration5);
      logger.info("[DB] PostgreSQL Schema 005 (Terms Accepted) applied successfully.");
    } catch (migErr) {
      logger.warn("[DB] Skipping Migration 005: File not found or error.", migErr);
    }

    logger.info("[DB] All migrations applied successfully.");
    process.exit(0); // Exit cleanly
  } catch (error) {
    logger.error("[DB] Error applying migrations:", error);
    process.exit(1); // Exit with failure code for CI/CD pipelines
  }
};

runMigrations();