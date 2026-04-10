-- Add compliance fields to users table
ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS kyc_status VARCHAR(50) DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS kyc_documents JSONB,
  ADD COLUMN IF NOT EXISTS kyc_submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS kyc_approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;

-- Add audit fields to orders table
ALTER TABLE orders 
  ADD COLUMN IF NOT EXISTS broker VARCHAR(50),
  ADD COLUMN IF NOT EXISTS broker_order_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS failed_reason TEXT;