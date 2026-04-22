-- migrations/009_add_risk_profile.sql

-- Add Risk Profile tracking
ALTER TABLE users ADD COLUMN IF NOT EXISTS risk_profile VARCHAR(50);

-- Add Segments Enabled array (storing it as JSONB for flexibility)
ALTER TABLE users ADD COLUMN IF NOT EXISTS segments_enabled JSONB DEFAULT '["EQUITY"]'::jsonb;