-- migrations/017_add_name_pan_to_users.sql

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS name VARCHAR(255), 
ADD COLUMN IF NOT EXISTS pan VARCHAR(20);