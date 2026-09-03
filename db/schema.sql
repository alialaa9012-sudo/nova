-- ============================================================
-- NOVA — AI Restaurant Operations
-- Database schema (PostgreSQL 18 / Neon)
--
-- هذا الملف يعيد بناء قاعدة البيانات من الصفر.
-- تم استخراجه من قاعدة البيانات الحية للمشروع.
-- التشغيل:  psql "$DATABASE_URL" -f db/schema.sql
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------- المطاعم ----------
CREATE TABLE IF NOT EXISTS restaurants (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                        text NOT NULL,
  whatsapp_phone_number_id    text UNIQUE,
  whatsapp_business_account_id text,
  timezone                    text NOT NULL DEFAULT 'Africa/Cairo',
  currency                    text NOT NULL DEFAULT 'EGP'
                                CHECK (currency IN ('EGP','SAR','AED')),
  active                      boolean NOT NULL DEFAULT true,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  deleted_at                  timestamptz
);

-- ---------- الفروع ----------
CREATE TABLE IF NOT EXISTS branches (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name          text NOT NULL,
  address       text,
  open_hours    jsonb,
  active        boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz
);

-- ---------- المستخدمون (لوحة التحكم) ----------
CREATE TABLE IF NOT EXISTS users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  branch_id     uuid REFERENCES branches(id),
  name          text NOT NULL,
  email         text NOT NULL,
  password_hash text NOT NULL,           -- bcrypt
  role          text NOT NULL CHECK (role IN ('owner','manager','staff')),
  active        boolean NOT NULL DEFAULT true,
  last_login_at timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ---------- العملاء ----------
CREATE TABLE IF NOT EXISTS customers (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id       uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  phone               text NOT NULL,
  name                text,
  classification      text NOT NULL DEFAULT 'new'
                        CHECK (classification IN ('new','repeat','vip')),
  favorite_item       text,
  preferred_branch_id uuid REFERENCES branches(id),
  visit_count         integer NOT NULL DEFAULT 0,
  last_visit_at       timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  deleted_at          timestamptz,
  UNIQUE (restaurant_id, phone)
);

-- ---------- المحادثات ----------
CREATE TABLE IF NOT EXISTS conversations (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id     uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  customer_id       uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  channel           text NOT NULL DEFAULT 'whatsapp'
                      CHECK (channel IN ('whatsapp','instagram','facebook','google_reviews')),
  status            text NOT NULL DEFAULT 'ai'
                      CHECK (status IN ('ai','human','closed')),
  assigned_to       text,
  escalation_reason text,
  last_message_at   timestamptz NOT NULL DEFAULT now(),
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- ---------- الرسائل ----------
CREATE TABLE IF NOT EXISTS messages (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id     uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  direction           text NOT NULL CHECK (direction IN ('inbound','outbound')),
  sender              text NOT NULL CHECK (sender IN ('customer','ai','staff')),
  message_type        text NOT NULL DEFAULT 'text'
                        CHECK (message_type IN ('text','image','voice','document')),
  body                text,
  media_url           text,
  whatsapp_message_id text,
  intent_type         text CHECK (intent_type IS NULL OR intent_type IN
                        ('reservation','menu_query','complaint','hours','location',
                         'job_application','smalltalk','out_of_scope','other')),
  tokens_in           integer,
  tokens_out          integer,
  cost_usd            numeric,
  latency_ms          integer,
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- ---------- الحجوزات ----------
CREATE TABLE IF NOT EXISTS reservations (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id    uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  branch_id        uuid NOT NULL REFERENCES branches(id),
  customer_id      uuid NOT NULL REFERENCES customers(id),
  conversation_id  uuid REFERENCES conversations(id),
  reservation_time timestamptz NOT NULL,
  guests           integer NOT NULL CHECK (guests > 0),
  duration_minutes integer,
  source           text NOT NULL DEFAULT 'whatsapp'
                     CHECK (source IN ('whatsapp','instagram','facebook','voice','call','manual')),
  status           text NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','confirmed','cancelled')),
  notes            text,
  special_requests text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- ---------- الشكاوى ----------
CREATE TABLE IF NOT EXISTS complaints (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  branch_id       uuid REFERENCES branches(id),
  customer_id     uuid NOT NULL REFERENCES customers(id),
  conversation_id uuid REFERENCES conversations(id),
  summary         text NOT NULL,
  priority        text NOT NULL DEFAULT 'mid' CHECK (priority IN ('high','mid','low')),
  status          text NOT NULL DEFAULT 'new' CHECK (status IN ('new','in_progress','resolved')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  resolved_at     timestamptz
);

-- ---------- المنيو ----------
CREATE TABLE IF NOT EXISTS menu_categories (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name          text NOT NULL,
  sort_order    integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS menu_items (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id       uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  category_id         uuid REFERENCES menu_categories(id),
  name                text NOT NULL,
  price               numeric NOT NULL CHECK (price >= 0),
  available           boolean NOT NULL DEFAULT true,
  unavailable_reason  text CHECK (unavailable_reason IS NULL OR
                        unavailable_reason IN ('kitchen','staff','seasonal')),
  available_again_at  timestamptz,
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS menu_item_variants (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id      uuid NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  label        text NOT NULL,
  variant_type text NOT NULL CHECK (variant_type IN ('size','addon')),
  price        numeric NOT NULL CHECK (price >= 0),
  sort_order   integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ---------- قاعدة معرفة البوت ----------
CREATE TABLE IF NOT EXISTS kb_entries (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  topic         text NOT NULL,
  content       text NOT NULL,
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- ---------- تعليمات طارئة للبوت ----------
CREATE TABLE IF NOT EXISTS emergency_overrides (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  category      text NOT NULL
                  CHECK (category IN ('stock_outage','price_change','closure','promo','general')),
  text          text NOT NULL CHECK (char_length(text) <= 4000),
  added_by      text,
  active        boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  cancelled_at  timestamptz
);

-- ---------- تقييمات جوجل ----------
CREATE TABLE IF NOT EXISTS google_reviews (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id    uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  google_review_id text,
  google_place_id  text,
  reviewer_name    text,
  rating           smallint CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5)),
  review_text      text,
  sentiment        text CHECK (sentiment IS NULL OR
                     sentiment IN ('positive','neutral','negative','mixed')),
  ai_reply_draft   text,
  reply_final      text,
  status           text NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','replied','skipped')),
  replied_at       timestamptz,
  replied_by       text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- ---------- تكلفة الذكاء الاصطناعي اليومية ----------
CREATE TABLE IF NOT EXISTS daily_costs (
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  day           date NOT NULL,
  tokens_in     bigint NOT NULL DEFAULT 0,
  tokens_out    bigint NOT NULL DEFAULT 0,
  cost_usd      numeric NOT NULL DEFAULT 0,
  hard_cap_usd  numeric NOT NULL DEFAULT 5.00,
  PRIMARY KEY (restaurant_id, day)
);

-- ---------- حدود المعدل ----------
CREATE TABLE IF NOT EXISTS rate_limits (
  scope    text NOT NULL,
  scope_id text NOT NULL,
  bucket   timestamptz NOT NULL,
  hits     integer NOT NULL DEFAULT 0,
  PRIMARY KEY (scope, scope_id, bucket)
);

-- ---------- سجل العمليات ----------
CREATE TABLE IF NOT EXISTS audit_log (
  id            bigserial PRIMARY KEY,
  restaurant_id uuid REFERENCES restaurants(id) ON DELETE SET NULL,
  actor         text NOT NULL,
  action        text NOT NULL,
  entity_type   text,
  entity_id     uuid,
  payload       jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ---------- الفهارس ----------
CREATE UNIQUE INDEX IF NOT EXISTS uniq_users_email
  ON users (lower(email));
CREATE INDEX IF NOT EXISTS idx_users_restaurant   ON users (restaurant_id);
CREATE INDEX IF NOT EXISTS idx_users_branch       ON users (branch_id);

CREATE INDEX IF NOT EXISTS idx_customers_restaurant_phone
  ON customers (restaurant_id, phone);

CREATE INDEX IF NOT EXISTS idx_reservations_restaurant_time
  ON reservations (restaurant_id, reservation_time);

CREATE INDEX IF NOT EXISTS idx_complaints_restaurant_status
  ON complaints (restaurant_id, status);

CREATE INDEX IF NOT EXISTS idx_conversations_customer
  ON conversations (customer_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_status
  ON conversations (restaurant_id, status) WHERE status IN ('ai','human');

CREATE INDEX IF NOT EXISTS idx_messages_conversation
  ON messages (conversation_id, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_messages_wa_msg_id
  ON messages (whatsapp_message_id) WHERE whatsapp_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_menu_items_restaurant
  ON menu_items (restaurant_id);
CREATE INDEX IF NOT EXISTS idx_menu_item_variants_item
  ON menu_item_variants (item_id);

CREATE INDEX IF NOT EXISTS idx_emergency_overrides_active
  ON emergency_overrides (restaurant_id) WHERE active;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_google_reviews_ext
  ON google_reviews (restaurant_id, google_review_id) WHERE google_review_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_log_restaurant_time
  ON audit_log (restaurant_id, created_at DESC);
