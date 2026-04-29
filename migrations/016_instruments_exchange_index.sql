-- Migration 016: Composite index for exchange+type filtered searches
CREATE INDEX IF NOT EXISTS idx_instruments_exchange_type
  ON instruments (exchange, instrument_type);

-- Plain btree for exact-match fast-path on tradingsymbol
CREATE INDEX IF NOT EXISTS idx_instruments_tradingsymbol_btree
  ON instruments (tradingsymbol);