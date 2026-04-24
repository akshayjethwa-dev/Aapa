-- We need the pg_trgm extension to allow for lightning-fast partial text searches
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS instruments (
    instrument_key VARCHAR(100) PRIMARY KEY,
    exchange_token VARCHAR(100),
    tradingsymbol VARCHAR(100),
    name VARCHAR(255),
    exchange VARCHAR(20),
    instrument_type VARCHAR(20),
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- This GIN index is the magic that makes "ILIKE '%RELIANCE%'" instant on 100k rows
CREATE INDEX IF NOT EXISTS idx_instruments_search ON instruments USING gin (tradingsymbol gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_instruments_name_search ON instruments USING gin (name gin_trgm_ops);