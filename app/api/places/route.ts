import { NextRequest, NextResponse } from "next/server";

// Proxy ke Google Places Autocomplete API. Sengaja dibuat lewat server
// (bukan dipanggil langsung dari browser) supaya GOOGLE_PLACES_API_KEY
// tidak pernah kelihatan di kode frontend / network tab browser user.

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("query");
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "GOOGLE_PLACES_API_KEY belum diset di server." },
      { status: 500 }
    );
  }
  if (!query || query.trim().length < 3) {
    return NextResponse.json({ suggestions: [] });
  }

  const url = new URL(
    "https://maps.googleapis.com/maps/api/place/autocomplete/json"
  );
  url.searchParams.set("input", query);
  url.searchParams.set("types", "establishment");
  url.searchParams.set("language", "id");
  // Bias + batasi hasil ke negara target (default Indonesia) supaya listing
  // spam / bisnis asing tidak nyasar muncul saat cari nama bisnis lokal.
  const country = (process.env.GOOGLE_PLACES_COUNTRY || "id").toLowerCase();
  url.searchParams.set("components", `country:${country}`);
  url.searchParams.set("region", country);
  url.searchParams.set("key", apiKey);

  const res = await fetch(url.toString());
  const data = await res.json();

  if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
    console.error("Google Places error:", data.status, data.error_message);
    return NextResponse.json(
      { error: "Gagal mengambil saran nama bisnis." },
      { status: 502 }
    );
  }

  const suggestions = (data.predictions || []).map((p: any) => ({
    place_id: p.place_id,
    description: p.description,
  }));

  return NextResponse.json({ suggestions });
}
