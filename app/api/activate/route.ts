import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { logCardChange, pickTrackedFields, getRequestMeta } from "@/lib/card-audit";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { cardId, placeId, businessName, pin, gmapsLink } = body || {};

  if (!cardId || !businessName || !pin) {
    return NextResponse.json({ error: "Data nama bisnis & PIN tidak lengkap." }, { status: 400 });
  }

  // Strictly 4-digit numeric PIN
  if (!/^\d{4}$/.test(pin)) {
    return NextResponse.json({ error: "PIN harus 4 digit angka." }, { status: 400 });
  }

  // Determine Google Review URL
  let googleReviewUrl = "";
  let finalPlaceId = placeId || null;

  if (gmapsLink && gmapsLink.trim().length > 0) {
    googleReviewUrl = gmapsLink.trim();
  } else if (placeId) {
    googleReviewUrl = `https://search.google.com/local/writereview?placeid=${encodeURIComponent(placeId)}`;
  } else {
    return NextResponse.json({ error: "Pilih nama bisnis dari saran Google atau masukkan Link Google Maps Review." }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();

  // Check card existence & activation status
  const { data: existing, error: fetchError } = await supabase
    .from("cards")
    .select("card_id, business_name, place_id, google_review_url, is_active")
    .eq("card_id", cardId.toUpperCase())
    .maybeSingle();

  if (fetchError) {
    console.error(fetchError.message);
    return NextResponse.json({ error: "Gagal memeriksa kartu." }, { status: 500 });
  }
  if (!existing) {
    return NextResponse.json({ error: "Kartu tidak ditemukan." }, { status: 404 });
  }
  if (existing.is_active) {
    return NextResponse.json(
      { error: "Kartu ini sudah aktif. Gunakan halaman edit untuk mengubah data." },
      { status: 409 }
    );
  }

  const pinHash = await bcrypt.hash(pin, 10);

  const { error: updateError } = await supabase
    .from("cards")
    .update({
      business_name: businessName,
      place_id: finalPlaceId,
      google_review_url: googleReviewUrl,
      pin_hash: pinHash,
      is_active: true,
      activated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      pin_failed_attempts: 0,
      pin_locked_until: null,
    })
    .eq("card_id", cardId.toUpperCase());

  if (updateError) {
    console.error(updateError.message);
    return NextResponse.json({ error: "Gagal menyimpan aktivasi." }, { status: 500 });
  }

  await logCardChange(supabase, {
    cardId,
    action: "activate",
    actor: "activation",
    oldValues: pickTrackedFields(existing),
    newValues: pickTrackedFields({
      business_name: businessName,
      place_id: finalPlaceId,
      google_review_url: googleReviewUrl,
      is_active: true,
    }),
    ...getRequestMeta(req),
  });

  return NextResponse.json({ ok: true, googleReviewUrl });
}
