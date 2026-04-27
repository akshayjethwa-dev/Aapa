-- migrations/015_add_bracket_order_fields.sql

-- Add columns to support Bracket Orders (OCO)
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS is_bracket BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS target_price NUMERIC(15, 2),
ADD COLUMN IF NOT EXISTS stoploss_price NUMERIC(15, 2);

-- Add a comment to the table columns for better documentation
COMMENT ON COLUMN orders.is_bracket IS 'Indicates if the order is a bracket order (OCO)';
COMMENT ON COLUMN orders.target_price IS 'The target profit spread for bracket orders';
COMMENT ON COLUMN orders.stoploss_price IS 'The stop loss spread for bracket orders';