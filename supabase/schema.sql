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
