import { createClient } from "@supabase/supabase-js";

// PENTING: file ini hanya boleh diimport dari Server Component atau API Route,
// JANGAN PERNAH diimport dari komponen client ("use client") karena
// SUPABASE_SERVICE_ROLE_KEY punya akses penuh ke database (bypass RLS).
export function getSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Supabase env vars belum diisi. Cek .env.local (NEXT_PUBLIC_SUPABASE_URL & SUPABASE_SERVICE_ROLE_KEY)."
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  });
}

export type CardRow = {
  card_id: string;
  business_name: string | null;
  place_id: string | null;
  google_review_url: string | null;
  pin_hash: string | null;
  is_active: boolean;
  rating_guard?: boolean;
  prod_card_ready?: boolean;
  prod_nfc_installed?: boolean;
  prod_ready_sell?: boolean;
  created_at: string;
  updated_at?: string | null;
  activated_at: string | null;
  pin_failed_attempts?: number;
  pin_locked_until?: string | null;
};
