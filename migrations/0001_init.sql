-- Gym Gang store schema (Cloudflare D1 / SQLite)

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS products (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  sku        TEXT NOT NULL UNIQUE,
  name       TEXT NOT NULL,
  category   TEXT NOT NULL CHECK (category IN ('men', 'women', 'acc')),
  price      INTEGER NOT NULL CHECK (price >= 0),
  compare_at INTEGER CHECK (compare_at IS NULL OR compare_at >= 0),
  summary    TEXT NOT NULL DEFAULT '',
  specs      TEXT NOT NULL DEFAULT '[]',
  image      TEXT NOT NULL DEFAULT '',
  colors     TEXT NOT NULL DEFAULT '[]',
  sizes      TEXT NOT NULL DEFAULT '[]',
  active     INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- One row per size x colour. stock NULL = not tracked (unlimited).
CREATE TABLE IF NOT EXISTS variants (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  size       TEXT NOT NULL,
  color      TEXT NOT NULL,
  stock      INTEGER CHECK (stock IS NULL OR stock >= 0),
  UNIQUE (product_id, size, color)
);

CREATE TABLE IF NOT EXISTS customers (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  phone      TEXT NOT NULL UNIQUE,
  email      TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS orders (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  code            TEXT NOT NULL UNIQUE,
  customer_id     INTEGER NOT NULL REFERENCES customers (id),
  status          TEXT NOT NULL DEFAULT 'new'
                  CHECK (status IN ('new', 'confirmed', 'shipped', 'delivered', 'cancelled')),
  payment_method  TEXT NOT NULL CHECK (payment_method IN ('cod', 'transfer', 'paymob')),
  payment_status  TEXT NOT NULL DEFAULT 'pending'
                  CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
  subtotal        INTEGER NOT NULL,
  discount        INTEGER NOT NULL DEFAULT 0,
  shipping        INTEGER NOT NULL,
  total           INTEGER NOT NULL,
  promo_code      TEXT,
  governorate     TEXT NOT NULL,
  address         TEXT NOT NULL,
  notes           TEXT,
  paymob_order_id TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders (created_at);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders (customer_id);

CREATE TABLE IF NOT EXISTS order_items (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id   INTEGER NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL,
  name       TEXT NOT NULL,
  sku        TEXT NOT NULL,
  size       TEXT NOT NULL,
  color      TEXT NOT NULL,
  unit_price INTEGER NOT NULL,
  qty        INTEGER NOT NULL CHECK (qty > 0)
);
CREATE INDEX IF NOT EXISTS idx_items_order ON order_items (order_id);
CREATE INDEX IF NOT EXISTS idx_items_product ON order_items (product_id);

CREATE TABLE IF NOT EXISTS promo_codes (
  code         TEXT PRIMARY KEY,
  percent      INTEGER NOT NULL CHECK (percent BETWEEN 1 AND 90),
  active       INTEGER NOT NULL DEFAULT 1,
  min_subtotal INTEGER NOT NULL DEFAULT 0,
  max_uses     INTEGER,
  used_count   INTEGER NOT NULL DEFAULT 0,
  expires_at   TEXT
);

CREATE TABLE IF NOT EXISTS subscribers (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  email      TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Admin-uploaded product images (base64 text, served by /api/images/:id).
CREATE TABLE IF NOT EXISTS images (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  mime       TEXT NOT NULL,
  data_b64   TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS rate_limits (
  key          TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  count        INTEGER NOT NULL
);
