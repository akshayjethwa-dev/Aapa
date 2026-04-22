-- migrations/008_add_onboarding_fields.sql
-- Adds onboarding step tracking to the users table

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS onboarding_step INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS first_login_completed_at TIMESTAMPTZ DEFAULT NULL;

-- onboarding_step values:
--   0 = not started (new user, never opened onboarding)
--   1 = Account step seen
--   2 = Broker (Upstox) connected
--   3 = KYC & Risk accepted
--   4 = Completed (Ready to Trade)

-- Backfill: existing users who already have upstox connected are considered complete
UPDATE users
SET
  onboarding_step = 4,
  first_login_completed_at = COALESCE(updated_at, NOW())
WHERE is_uptox_connected = true AND onboarding_step = 0;

-- Existing users who have kyc approved but no upstox -> step 2
UPDATE users
SET onboarding_step = 2
WHERE is_kyc_approved = true AND is_uptox_connected = false AND onboarding_step = 0;