-- migrations/011_add_order_validity_trigger_price.sql
-- Add validity and trigger_price columns to the orders table

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS validity     VARCHAR(5)     NOT NULL DEFAULT 'DAY',
  ADD COLUMN IF NOT EXISTS trigger_price NUMERIC(12,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN orders.validity      IS 'DAY or IOC';
COMMENT ON COLUMN orders.trigger_price IS 'Stop-loss trigger price; 0 for non-SL orders';