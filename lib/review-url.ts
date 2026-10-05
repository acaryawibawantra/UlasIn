// Utilitas validasi & pembentukan URL Google Review.
//
// KENAPA ADA DAFTAR BLOKIR:
// Link "share" Google Maps (mis. https://maps.app.goo.gl/XXXX) mengarah ke
// halaman TEMPAT, BUKAN form tulis ulasan. Link seperti itu bisa tersimpan
// tak sengaja sebagai google_review_url (paste saat aktivasi/edit), sehingga
// pelanggan mendarat di alamat/tempat yang salah.
//
// Kebijakan:
// - Saat aktivasi / edit: URL yang cocok daftar blokir DITOLAK.
// - Saat runtime (kartu sudah aktif & terlanjur tersimpan): URL blokir
//   diabaikan, otomatis dialihkan ke URL writereview berbasis place_id.

export const BLOCKED_MAPS_URL_CODES = [
  // https://maps.app.goo.gl/ViXKDRa6HUTMBr7x8
  "ViXKDRa6HUTMBr7x8",
] as const;

export function buildPlaceReviewUrl(placeId: string): string {
  return `https://search.google.com/local/writereview?placeid=${encodeURIComponent(placeId)}`;
}

export function isBlockedReviewUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const normalized = url.trim().toLowerCase();
  if (!normalized) return false;
  return BLOCKED_MAPS_URL_CODES.some((code) => normalized.includes(code.toLowerCase()));
}

/**
 * URL review yang aman dipakai:
 * - Pakai directUrl kalau ada & TIDAK diblokir.
 * - Kalau directUrl kosong/diblokir, bangun dari place_id.
 * - Kalau keduanya tidak ada, kembalikan string kosong.
 */
export function resolveReviewUrl(
  placeId: string | null | undefined,
  directUrl: string | null | undefined
): string {
  if (directUrl && !isBlockedReviewUrl(directUrl)) return directUrl;
  if (placeId) return buildPlaceReviewUrl(placeId);
  return "";
}
