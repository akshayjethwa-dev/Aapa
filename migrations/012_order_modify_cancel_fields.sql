-- Migration 012: Extend orders table for modify/cancel support
-- Run this in Supabase SQL Editor or via Railway PostgreSQL

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS exchange_order_id  TEXT,
  ADD COLUMN IF NOT EXISTS validity            TEXT    DEFAULT 'DAY',
  ADD COLUMN IF NOT EXISTS trigger_price       NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS filled_quantity     INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS average_price       NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS placed_at           TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS modified_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at        TIMESTAMPTZ;

-- Index for fast lookup by exchange_order_id (used during WebSocket sync)
CREATE INDEX IF NOT EXISTS idx_orders_exchange_order_id ON orders(exchange_order_id);

-- Index for fast lookup by user + status (used by Orders screen filter)
CREATE INDEX IF NOT EXISTS idx_orders_user_status ON orders(user_id, status);