CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL, password_hash TEXT NOT NULL, salt TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL, price INTEGER NOT NULL, category TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), product_id TEXT NOT NULL REFERENCES products(id), quantity INTEGER NOT NULL CHECK(quantity BETWEEN 1 AND 10), unit_price INTEGER NOT NULL, created_at TEXT NOT NULL, request_key TEXT NOT NULL, UNIQUE(user_id, request_key));
CREATE INDEX IF NOT EXISTS orders_user ON orders(user_id, created_at);
CREATE TABLE IF NOT EXISTS rate_limits (key TEXT PRIMARY KEY, attempts INTEGER NOT NULL, reset_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS deployments (app TEXT PRIMARY KEY, version TEXT NOT NULL, entry TEXT NOT NULL, previous_version TEXT, previous_entry TEXT, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS release_history (id TEXT PRIMARY KEY, app TEXT NOT NULL, version TEXT NOT NULL, entry TEXT NOT NULL, created_at TEXT NOT NULL);
