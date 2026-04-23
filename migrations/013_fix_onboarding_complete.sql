-- migrations/013_fix_onboarding_complete.sql
-- Safety: ensure is_onboarding_complete column does NOT exist
-- (it was never in a migration but was referenced in code — this fixes that)

-- Backfill: any user with is_uptox_connected = true should be at step 4
UPDATE users
SET onboarding_step = 4
WHERE is_uptox_connected = true AND (onboarding_step IS NULL OR onboarding_step < 4);

-- Backfill: pre-onboarding users who haven't started should be at step 0
UPDATE users
SET onboarding_step = 0
WHERE onboarding_step IS NULL;