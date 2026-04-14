-- Add the expires_at column to user_tokens
ALTER TABLE user_tokens 
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '24 hours');