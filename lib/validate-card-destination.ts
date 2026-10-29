import { BLOCKED_DESTINATION_MESSAGE, hasBlockedDestination } from "./blocked-destinations";

type Destination = {
  business_name?: string | null;
  place_id?: string | null;
  google_review_url?: string | null;
};

// Jangan percaya nama dari browser: Place ID bisa diberi label bisnis lain.
// Untuk tujuan baru, validasi nama/alamat resmi Google dan konsistensi link.
export async function validateCardDestination(
  destination: Destination,
  verifyPlace: boolean
): Promise<{ error: string; status: number } | null> {
  if (hasBlockedDestination(destination.business_name, destination.place_id, destination.google_review_url)) {
    return { error: BLOCKED_DESTINATION_MESSAGE, status: 400 };
  }
  if (!verifyPlace) return null;

  let url: URL;
  try {
    url = new URL(destination.google_review_url || "");
  } catch {
    return { error: "Link ulasan tidak valid. Pilih bisnis dari saran Google.", status: 400 };
  }
  const urlPlaceId = url.searchParams.get("placeid");
  if (url.protocol !== "https:" || url.hostname !== "search.google.com" ||
      url.pathname !== "/local/writereview" || url.username || url.password || url.port ||
      !urlPlaceId || (destination.place_id && destination.place_id !== urlPlaceId)) {
    return {
      error: "Pilih bisnis dari saran Google atau gunakan link https://search.google.com/local/writereview?placeid=... yang sesuai. Link pendek tidak dapat diverifikasi.",
      status: 400,
    };
  }
  if (hasBlockedDestination(urlPlaceId)) return { error: BLOCKED_DESTINATION_MESSAGE, status: 400 };

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return { error: "Verifikasi lokasi belum tersedia. Hubungi admin.", status: 503 };
  const detailsUrl = new URL("https://maps.googleapis.com/maps/api/place/details/json");
  detailsUrl.searchParams.set("place_id", urlPlaceId);
  detailsUrl.searchParams.set("fields", "name,formatted_address,place_id");
  detailsUrl.searchParams.set("language", "id");
  detailsUrl.searchParams.set("key", apiKey);
  try {
    const response = await fetch(detailsUrl, { cache: "no-store", signal: AbortSignal.timeout(8000) });
    const data = await response.json();
    if (!response.ok || data.status !== "OK" || !data.result?.name || data.result.place_id !== urlPlaceId) {
      return { error: "Lokasi Google belum dapat diverifikasi. Pilih ulang bisnis atau coba lagi nanti.", status: 503 };
    }
    if (hasBlockedDestination(data.result.name, data.result.formatted_address)) {
      return { error: BLOCKED_DESTINATION_MESSAGE, status: 400 };
    }
    return null;
  } catch {
    return { error: "Verifikasi lokasi gagal. Coba lagi nanti.", status: 503 };
  }
}
