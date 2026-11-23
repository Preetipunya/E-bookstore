-- =====================================================================
-- Book Worm E-Bookstore - PostgreSQL schema (idempotent)
-- =====================================================================

-- ---------- Identity ----------
CREATE TABLE IF NOT EXISTS users (
  id             SERIAL PRIMARY KEY,
  name           VARCHAR(120) NOT NULL,
  email          VARCHAR(255) NOT NULL,
  password_hash  VARCHAR(100) NOT NULL,
  phone          VARCHAR(20),
  reward_balance INTEGER NOT NULL DEFAULT 0 CHECK (reward_balance >= 0),
  role           VARCHAR(20) NOT NULL DEFAULT 'customer' CHECK (role IN ('customer','admin')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_users_email ON users (lower(email));

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_refresh_tokens_user ON refresh_tokens (user_id);

CREATE TABLE IF NOT EXISTS password_resets (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS addresses (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  full_name   VARCHAR(120) NOT NULL,
  phone       VARCHAR(20) NOT NULL,
  line1       VARCHAR(200) NOT NULL,
  line2       VARCHAR(200),
  city        VARCHAR(100) NOT NULL,
  state       VARCHAR(100) NOT NULL,
  country     VARCHAR(100) NOT NULL DEFAULT 'India',
  postal_code VARCHAR(12) NOT NULL,
  is_default  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_addresses_user ON addresses (user_id);

-- ---------- Catalogue ----------
CREATE TABLE IF NOT EXISTS authors (
  id   SERIAL PRIMARY KEY,
  name VARCHAR(160) NOT NULL UNIQUE,
  bio  TEXT
);

CREATE TABLE IF NOT EXISTS publishers (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(160) NOT NULL UNIQUE,
  slug        VARCHAR(160) NOT NULL UNIQUE,
  description TEXT
);

CREATE TABLE IF NOT EXISTS categories (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100) NOT NULL UNIQUE,
  slug        VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS books (
  id               SERIAL PRIMARY KEY,
  isbn             VARCHAR(20) NOT NULL UNIQUE,
  title            VARCHAR(255) NOT NULL,
  description      TEXT NOT NULL,
  author_id        INTEGER NOT NULL REFERENCES authors(id),
  publisher_id     INTEGER NOT NULL REFERENCES publishers(id),
  category_id      INTEGER NOT NULL REFERENCES categories(id),
  list_price       NUMERIC(10,2) NOT NULL CHECK (list_price > 0),
  discount_percent SMALLINT NOT NULL DEFAULT 0 CHECK (discount_percent BETWEEN 0 AND 90),
  language         VARCHAR(40) NOT NULL DEFAULT 'English',
  format           VARCHAR(20) NOT NULL DEFAULT 'Paperback' CHECK (format IN ('Paperback','Hardcover','eBook')),
  pages            INTEGER CHECK (pages > 0),
  published_date   DATE NOT NULL,
  rating_avg       NUMERIC(3,2) NOT NULL DEFAULT 0 CHECK (rating_avg BETWEEN 0 AND 5),
  rating_count     INTEGER NOT NULL DEFAULT 0,
  sales_count      INTEGER NOT NULL DEFAULT 0,
  is_featured      BOOLEAN NOT NULL DEFAULT FALSE,
  cover_color_1    VARCHAR(7) NOT NULL DEFAULT '#1f3a5f',
  cover_color_2    VARCHAR(7) NOT NULL DEFAULT '#0b1a2f',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_books_category   ON books (category_id);
CREATE INDEX IF NOT EXISTS ix_books_author     ON books (author_id);
CREATE INDEX IF NOT EXISTS ix_books_publisher  ON books (publisher_id);
CREATE INDEX IF NOT EXISTS ix_books_price      ON books (list_price);
CREATE INDEX IF NOT EXISTS ix_books_rating     ON books (rating_avg DESC);
CREATE INDEX IF NOT EXISTS ix_books_sales      ON books (sales_count DESC);
CREATE INDEX IF NOT EXISTS ix_books_published  ON books (published_date DESC);
CREATE INDEX IF NOT EXISTS ix_books_title_lower ON books (lower(title));
CREATE INDEX IF NOT EXISTS ix_books_fts ON books USING GIN (to_tsvector('english', title || ' ' || description));

CREATE TABLE IF NOT EXISTS book_images (
  id         SERIAL PRIMARY KEY,
  book_id    INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  url        VARCHAR(500) NOT NULL,
  kind       VARCHAR(20) NOT NULL DEFAULT 'front' CHECK (kind IN ('front','back','gallery')),
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS ix_book_images_book ON book_images (book_id);

CREATE TABLE IF NOT EXISTS inventory (
  book_id       INTEGER PRIMARY KEY REFERENCES books(id) ON DELETE CASCADE,
  quantity      INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  reorder_level INTEGER NOT NULL DEFAULT 5,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reviews (
  id         SERIAL PRIMARY KEY,
  book_id    INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating     SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment    VARCHAR(1000) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (book_id, user_id)
);
CREATE INDEX IF NOT EXISTS ix_reviews_book ON reviews (book_id);

-- ---------- Shopping ----------
CREATE TABLE IF NOT EXISTS coupons (
  id            SERIAL PRIMARY KEY,
  code          VARCHAR(40) NOT NULL UNIQUE,
  description   VARCHAR(255) NOT NULL,
  discount_type VARCHAR(10) NOT NULL CHECK (discount_type IN ('percent','flat','shipping')),
  value         NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (value >= 0),
  max_discount  NUMERIC(10,2),
  min_order     NUMERIC(10,2) NOT NULL DEFAULT 0,
  valid_from    TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_until   TIMESTAMPTZ,
  usage_limit   INTEGER,
  used_count    INTEGER NOT NULL DEFAULT 0,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS carts (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  coupon_code VARCHAR(40),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cart_items (
  id             SERIAL PRIMARY KEY,
  cart_id        INTEGER NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  book_id        INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  quantity       INTEGER NOT NULL DEFAULT 1 CHECK (quantity BETWEEN 1 AND 10),
  saved_for_later BOOLEAN NOT NULL DEFAULT FALSE,
  added_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (cart_id, book_id)
);

CREATE TABLE IF NOT EXISTS wishlist (
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  book_id    INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, book_id)
);

-- ---------- Orders & payments ----------
CREATE TABLE IF NOT EXISTS orders (
  id              SERIAL PRIMARY KEY,
  order_number    VARCHAR(30) NOT NULL UNIQUE,
  user_id         INTEGER NOT NULL REFERENCES users(id),
  address_id      INTEGER REFERENCES addresses(id) ON DELETE SET NULL,
  ship_name       VARCHAR(120) NOT NULL,
  ship_phone      VARCHAR(20) NOT NULL,
  ship_line1      VARCHAR(200) NOT NULL,
  ship_line2      VARCHAR(200),
  ship_city       VARCHAR(100) NOT NULL,
  ship_state      VARCHAR(100) NOT NULL,
  ship_country    VARCHAR(100) NOT NULL,
  ship_postal     VARCHAR(12) NOT NULL,
  status          VARCHAR(20) NOT NULL CHECK (status IN ('payment_pending','payment_failed','confirmed','processing','shipped','delivered','cancelled')),
  subtotal        NUMERIC(10,2) NOT NULL CHECK (subtotal >= 0),
  book_discount   NUMERIC(10,2) NOT NULL DEFAULT 0,
  coupon_code     VARCHAR(40),
  coupon_discount NUMERIC(10,2) NOT NULL DEFAULT 0,
  tax             NUMERIC(10,2) NOT NULL DEFAULT 0,
  shipping        NUMERIC(10,2) NOT NULL DEFAULT 0,
  points_redeemed INTEGER NOT NULL DEFAULT 0 CHECK (points_redeemed >= 0),
  points_discount NUMERIC(10,2) NOT NULL DEFAULT 0,
  total           NUMERIC(10,2) NOT NULL CHECK (total >= 0),
  points_earned   INTEGER NOT NULL DEFAULT 0,
  cancel_reason   VARCHAR(500),
  cancelled_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_orders_user_created ON orders (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_orders_status ON orders (status);

CREATE TABLE IF NOT EXISTS order_items (
  id         SERIAL PRIMARY KEY,
  order_id   INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  book_id    INTEGER NOT NULL REFERENCES books(id),
  title      VARCHAR(255) NOT NULL,
  author     VARCHAR(160) NOT NULL,
  list_price NUMERIC(10,2) NOT NULL,
  unit_price NUMERIC(10,2) NOT NULL,
  quantity   INTEGER NOT NULL CHECK (quantity > 0),
  line_total NUMERIC(10,2) NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_order_items_order ON order_items (order_id);
CREATE INDEX IF NOT EXISTS ix_order_items_book  ON order_items (book_id);

CREATE TABLE IF NOT EXISTS payments (
  id             SERIAL PRIMARY KEY,
  order_id       INTEGER REFERENCES orders(id) ON DELETE SET NULL,
  user_id        INTEGER NOT NULL REFERENCES users(id),
  method         VARCHAR(20) NOT NULL CHECK (method IN ('credit_card','debit_card','upi','net_banking','wallet')),
  status         VARCHAR(10) NOT NULL CHECK (status IN ('success','failed','pending','refunded')),
  amount         NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
  transaction_ref VARCHAR(40) NOT NULL UNIQUE,
  details_masked JSONB NOT NULL DEFAULT '{}'::jsonb,
  failure_reason VARCHAR(255),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_payments_order ON payments (order_id);
CREATE INDEX IF NOT EXISTS ix_payments_user  ON payments (user_id);

-- ---------- Rewards ----------
CREATE TABLE IF NOT EXISTS reward_points (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_id      INTEGER REFERENCES orders(id) ON DELETE SET NULL,
  points        INTEGER NOT NULL CHECK (points <> 0),
  type          VARCHAR(10) NOT NULL CHECK (type IN ('earned','redeemed','refunded','reversed','bonus')),
  description   VARCHAR(255) NOT NULL,
  balance_after INTEGER NOT NULL CHECK (balance_after >= 0),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_reward_points_user ON reward_points (user_id, created_at DESC);

-- ---------- Personalisation & audit ----------
CREATE TABLE IF NOT EXISTS book_views (
  user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  book_id   INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, book_id)
);

CREATE TABLE IF NOT EXISTS recommendations (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  book_id    INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  score      NUMERIC(10,3) NOT NULL,
  reason     VARCHAR(30) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, book_id, reason)
);
CREATE INDEX IF NOT EXISTS ix_recommendations_user ON recommendations (user_id, score DESC);

CREATE TABLE IF NOT EXISTS audit_logs (
  id          BIGSERIAL PRIMARY KEY,
  user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action      VARCHAR(60) NOT NULL,
  entity_type VARCHAR(40),
  entity_id   VARCHAR(40),
  metadata    JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_audit_logs_user ON audit_logs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_audit_logs_entity ON audit_logs (entity_type, entity_id);
