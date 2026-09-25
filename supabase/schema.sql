-- Jalankan ini di Supabase SQL Editor (project kamu > SQL Editor > New query)

create table if not exists cards (
  card_id text primary key,
  business_name text,
  place_id text,
  google_review_url text,
  pin_hash text,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  activated_at timestamptz
);

-- Index buat lookup cepat (card_id sudah primary key jadi otomatis ada index,
-- ini cuma jaga-jaga kalau nanti query berdasarkan status juga)
create index if not exists idx_cards_is_active on cards (is_active);

-- Row Level Security: matikan akses langsung dari client,
-- semua akses HARUS lewat server (API routes pakai service_role key)
alter table cards enable row level security;
-- Sengaja TIDAK dibuatkan policy apapun di sini, artinya:
-- - anon/public key: tidak bisa baca/tulis apapun ke tabel ini
-- - service_role key (dipakai di server, bukan di browser): bisa full access
-- Ini penting supaya PIN hash & data bisnis tidak bisa diakses langsung dari frontend.

-- ──────────────────────────────────────────────────────────────────────────────
-- TABLE QR MEJA CUSTOM (Tammmu, dan client cafe lainnya)
-- ──────────────────────────────────────────────────────────────────────────────
create table if not exists table_qrs (
  id bigserial primary key,
  client_slug text not null,
  table_num text not null,
  url text not null,
  created_at timestamptz not null default now(),
  unique (client_slug, table_num)
);

create index if not exists idx_table_qrs_client_slug on table_qrs (client_slug);
create index if not exists idx_table_qrs_created_at on table_qrs (created_at desc);

-- Row Level Security: sama seperti cards, tidak ada akses langsung dari client
alter table table_qrs enable row level security;
-- (Tidak ada policy — hanya server dengan service_role yang bisa akses)

-- ──────────────────────────────────────────────────────────────────────────────
-- TABLE CLIENT MASTER (Multi-Client Template All-In-One)
-- Data branding, WiFi, rating, theme, dll untuk setiap cafe / client kamu
-- ──────────────────────────────────────────────────────────────────────────────
create table if not exists clients (
  id bigserial primary key,
  slug text not null unique,
  business_name text not null,
  status text not null default 'active',

  -- Brand & UI
  logo_url text,
  cover_mobile_url text,
  theme_accent text default '#3C3833',
  theme_bg text default '#FAF8F5',
  tagline text,
  font_heading text,
  operating_hours text,

  -- Konten All-In-One Menu
  wifi_ssid text,
  wifi_password text,
  google_place_id text,
  google_review_url text,

  -- Sosmed & kontak
  address text,
  instagram_url text,
  whatsapp_url text,

  -- Template engine
  template_key text not null default 'tammmu_v1',

  created_at timestamptz not null default now()
);

create index if not exists idx_clients_slug on clients (slug);
create index if not exists idx_clients_status on clients (status);

alter table clients enable row level security;

-- ──────────────────────────────────────────────────────────────────────────────
-- TABLE MENU CATEGORIES (per client)
-- ──────────────────────────────────────────────────────────────────────────────
create table if not exists menu_categories (
  id bigserial primary key,
  client_slug text not null references clients(slug) on delete cascade,
  key text not null,
  label text not null,
  sort_order int not null default 0,
  unique (client_slug, key)
);

create index if not exists idx_menu_categories_client on menu_categories (client_slug);
alter table menu_categories enable row level security;

-- ──────────────────────────────────────────────────────────────────────────────
-- TABLE MENU ITEMS (pengganti PRODUCTS const hardcode)
-- ──────────────────────────────────────────────────────────────────────────────
create table if not exists menu_items (
  id bigserial primary key,
  client_slug text not null references clients(slug) on delete cascade,
  category_key text not null,
  name text not null,
  price_label text,
  price_num bigint,
  description text,
  image_url text,
  badge text,
  is_featured boolean not null default false,
  is_active boolean not null default true,
  sort_order int not null default 0,
  search_key text,
  created_at timestamptz not null default now(),
  foreign key (client_slug, category_key) references menu_categories(client_slug, key) on delete cascade
);

create index if not exists idx_menu_items_client on menu_items (client_slug);
create index if not exists idx_menu_items_active on menu_items (client_slug, is_active);
alter table menu_items enable row level security;

-- ═══════════════════════════════════════════════════════
-- STORAGE: bucket "menu-assets" untuk upload logo, cover & foto menu
-- NOTE: bucket ini JUGA otomatis dibuat oleh /api/admin/upload saat
-- upload pertama (service role). SQL di bawah hanya untuk setup manual
-- / dokumentasi — idempotent, aman dijalankan berulang.
-- ═══════════════════════════════════════════════════════
insert into storage.buckets (id, name, public)
values ('menu-assets', 'menu-assets', true)
on conflict (id) do nothing;

-- ═══════════════════════════════════════════════════════
-- PORTAL CLIENT (/kelola): akun login client untuk kelola
-- menu & pengaturan bisnis mereka sendiri (self-service).
-- Password disimpan sebagai bcrypt hash. Satu client bisa
-- punya beberapa akun (misal owner + staff).
-- ═══════════════════════════════════════════════════════
create table if not exists client_users (
  id bigserial primary key,
  client_slug text not null references clients(slug) on delete cascade,
  email text not null,
  password_hash text not null,
  is_active boolean not null default true,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  unique (client_slug, email)
);

create index if not exists idx_client_users_slug on client_users (client_slug);
create index if not exists idx_client_users_email on client_users (lower(email));
alter table client_users enable row level security;

-- Toggle show/hide fitur shortcut per client (Panggil Waiter, Review, WiFi).
-- JSONB fleksibel: menambah toggle baru nanti cukup lewat portal tanpa ALTER TABLE.
alter table clients
  add column if not exists feature_flags jsonb not null
  default '{"waiter_call": true, "review": true, "wifi": true}'::jsonb;

-- Zona WiFi per area meja (misal Indoor meja 1-15, Outdoor 16-30).
-- Halaman /slug/XX otomatis pilih zona sesuai nomor meja; jika tidak
-- ada zona yang cocok → fallback ke wifi_ssid/wifi_password global.
-- Bentuk: [{label, ssid, password, from, to}]
alter table clients
  add column if not exists wifi_zones jsonb not null default '[]'::jsonb;

-- BATCH KARTU PERUSAHAAN: kartu NFC review yang dipesan borongan oleh
-- perusahaan (mis. "Kebab Baba Rafi" 30 kartu untuk banyak cabang).
-- batch_label = nama perusahaan (null = penjualan umum),
-- order_type  = 'khusus' (borongan perusahaan) | 'umum' (default).
-- Aktivasi kartu tetap manual oleh perusahaan (nama bisnis per cabang bisa beda).
alter table cards
  add column if not exists batch_label text,
  add column if not exists order_type text not null default 'umum';

-- ──────────────────────────────────────────────────────────────────────────────
-- SISTEM GUARD RATING (filter review sebelum ke Google)
-- rating_guard = true -> tap/scan kartu TIDAK langsung ke Google Maps,
-- tapi masuk halaman rating Ratey dulu:
--   - Bintang 4-5  -> auto-direct ke halaman Google Review
--   - Bintang 1-3  -> user isi keluhan (tersimpan di card_feedback,
--                     TIDAK diarahkan ke Google)
-- Default false = perilaku lama (langsung redirect ke Google).
-- ──────────────────────────────────────────────────────────────────────────────
alter table cards
  add column if not exists rating_guard boolean not null default false;

-- Keluhan user dari halaman guard (hanya rating 1-3 yang dicatat).
-- customer_name / customer_phone opsional (untuk follow-up oleh pemilik usaha).
create table if not exists card_feedback (
  id bigserial primary key,
  card_id text not null references cards(card_id) on delete cascade,
  rating int not null check (rating between 1 and 3),
  message text not null,
  customer_name text,
  customer_phone text,
  created_at timestamptz not null default now()
);

create index if not exists idx_card_feedback_card on card_feedback (card_id);
create index if not exists idx_card_feedback_created on card_feedback (created_at desc);

-- RLS: tanpa policy — hanya server (service_role) yang bisa akses
alter table card_feedback enable row level security;
