import type { SupabaseClient } from "@supabase/supabase-js";

// Field kartu yang penting untuk dilacak perubahannya (perubahan review link
// paling rawan disalahgunakan, jadi riwayat lama vs baru disimpan sebagai JSONB).
const TRACKED_FIELDS = [
  "business_name",
  "place_id",
  "google_review_url",
  "is_active",
  "rating_guard",
  "prod_card_ready",
  "prod_nfc_installed",
  "prod_ready_sell",
] as const;

type TrackedField = (typeof TRACKED_FIELDS)[number];

type Snapshot = Partial<Record<TrackedField, unknown>> | null | undefined;

export function pickTrackedFields(row: Record<string, unknown> | null | undefined): Snapshot {
  if (!row) return null;
  const snapshot: Record<string, unknown> = {};
  for (const field of TRACKED_FIELDS) {
    if (row[field] !== undefined) snapshot[field] = row[field] ?? null;
  }
  return snapshot;
}

/**
 * Ambil IP & User-Agent pengunjung dari header request (di belakang proxy
 * Vercel/hosting). Hanya dipakai untuk keperluan audit — tidak mempengaruhi
 * redirect kartu sama sekali.
 */
export function getRequestMeta(req: Request): { ip: string | null; userAgent: string | null } {
  const fwd = req.headers.get("x-forwarded-for");
  const ip =
    (fwd ? fwd.split(",")[0].trim() : null) ||
    req.headers.get("x-real-ip") ||
    req.headers.get("cf-connecting-ip") ||
    null;
  const userAgent = req.headers.get("user-agent");
  return {
    ip: ip ? ip.slice(0, 60) : null,
    userAgent: userAgent ? userAgent.slice(0, 300) : null,
  };
}

/**
 * Simpan satu baris riwayat perubahan kartu. Sengaja "best effort":
 * kalau tabel audit belum dimigrate, kegagalan tidak boleh mematahkan
 * alur utama aktivasi / edit kartu.
 *
 * Juga tahan-banting: kalau kolom actor_ip / actor_user_agent belum ada
 * (migration belum jalan), otomatis fallback insert tanpa kolom itu.
 */
export async function logCardChange(
  supabase: SupabaseClient,
  params: {
    cardId: string;
    action: string;
    actor: string;
    oldValues?: Snapshot;
    newValues?: Snapshot;
    ip?: string | null;
    userAgent?: string | null;
  }
) {
  const base = {
    card_id: params.cardId.toUpperCase(),
    action: params.action,
    actor: params.actor,
    old_values: params.oldValues ?? null,
    new_values: params.newValues ?? null,
  };

  try {
    const { error } = await supabase.from("card_audit_log").insert({
      ...base,
      actor_ip: params.ip ?? null,
      actor_user_agent: params.userAgent ?? null,
    });
    if (!error) return;

    // Kolom IP/UA belum ada → coba lagi tanpa kolom tersebut.
    if (error.message?.includes("actor_ip") || error.message?.includes("actor_user_agent") || (error as any)?.code === "42703") {
      const retry = await supabase.from("card_audit_log").insert(base);
      if (retry.error) console.warn("card_audit_log insert skipped:", retry.error.message);
      return;
    }
    console.warn("card_audit_log insert skipped:", error.message);
  } catch (err) {
    console.warn("card_audit_log insert failed:", err);
  }
}
