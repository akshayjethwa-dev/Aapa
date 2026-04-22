-- migrations/010_user_watchlists.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Creates tables for named, multi-watchlist support per user.
-- Each user can have multiple watchlists; each watchlist has ordered symbols.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Parent table: one row per named watchlist
CREATE TABLE IF NOT EXISTS user_watchlists (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 50),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Child table: symbols inside a watchlist, with sort order
CREATE TABLE IF NOT EXISTS user_watchlist_items (
  id           UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  watchlist_id UUID    NOT NULL REFERENCES user_watchlists(id) ON DELETE CASCADE,
  symbol       TEXT    NOT NULL CHECK (char_length(symbol) BETWEEN 1 AND 50),
  sort_order   INTEGER NOT NULL DEFAULT 0,
  added_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (watchlist_id, symbol)           -- no duplicate symbols per watchlist
);

-- 3. Indexes for fast per-user and per-watchlist lookups
CREATE INDEX IF NOT EXISTS idx_user_watchlists_user_id
  ON user_watchlists(user_id);

CREATE INDEX IF NOT EXISTS idx_user_watchlist_items_watchlist_id
  ON user_watchlist_items(watchlist_id);

-- 4. Trigger: keep updated_at fresh on user_watchlists
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_watchlists_updated_at ON user_watchlists;
CREATE TRIGGER trg_user_watchlists_updated_at
  BEFORE UPDATE ON user_watchlists
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 5. Seed a default "My Watchlist" for every existing user who has none
INSERT INTO user_watchlists (user_id, name)
SELECT id, 'My Watchlist'
FROM   users u
WHERE  NOT EXISTS (
  SELECT 1 FROM user_watchlists w WHERE w.user_id = u.id
);