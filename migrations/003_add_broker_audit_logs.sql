-- migrations/003_add_broker_audit_logs.sql
ALTER TABLE orders ADD COLUMN IF NOT EXISTS raw_broker_response JSONB;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS failed_reason TEXT;