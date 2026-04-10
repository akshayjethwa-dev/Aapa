CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE,
  mobile VARCHAR(20) UNIQUE,
  password TEXT NOT NULL,
  role VARCHAR(50) DEFAULT 'user',
  is_kyc_approved BOOLEAN DEFAULT false,
  is_uptox_connected BOOLEAN DEFAULT false,
  is_angelone_connected BOOLEAN DEFAULT false,
  balance NUMERIC(15, 2) DEFAULT 100000.0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS portfolios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  symbol VARCHAR(50),
  quantity INTEGER,
  average_price NUMERIC(15, 2)
);

CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  symbol VARCHAR(50),
  type VARCHAR(20),
  order_type VARCHAR(20),
  quantity INTEGER,
  price NUMERIC(15, 2),
  status VARCHAR(30) DEFAULT 'completed',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kyc_data (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  pan VARCHAR(20),
  aadhaar VARCHAR(20),
  bank_account VARCHAR(50),
  ifsc VARCHAR(20),
  status VARCHAR(50) DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS user_tokens (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  broker VARCHAR(50),
  access_token TEXT,
  refresh_token TEXT,
  feed_token TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, broker)
);

CREATE TABLE IF NOT EXISTS beta_whitelist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  identifier VARCHAR(255) UNIQUE,
  is_approved BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Whitelist the initial users (ON CONFLICT prevents duplicates on restart)
INSERT INTO beta_whitelist (identifier) VALUES ('bharvadvijay371@gmail.com') ON CONFLICT DO NOTHING;
INSERT INTO beta_whitelist (identifier) VALUES ('bharvadvijay371@gamil.com') ON CONFLICT DO NOTHING;
INSERT INTO beta_whitelist (identifier) VALUES ('bharvaddvijay371@gmail.com') ON CONFLICT DO NOTHING;
INSERT INTO beta_whitelist (identifier) VALUES ('8128332216') ON CONFLICT DO NOTHING;