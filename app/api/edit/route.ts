import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { logCardChange, pickTrackedFields, getRequestMeta } from "@/lib/card-audit";

const MAX_PIN_ATTEMPTS = 5;
const PIN_LOCK_MINUTES = 15;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { cardId, pin, newBusinessName, newPlaceId, newGoogleReviewUrl, newPin, ratingGuard, action } = body || {};

  if (!cardId || !pin) {
    return NextResponse.json({ error: "Card ID dan PIN wajib diisi." }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();
  const { data: card, error } = await supabase
    .from("cards")
    .select(
      "card_id, business_name, place_id, google_review_url, pin_hash, is_active, rating_guard, pin_failed_attempts, pin_locked_until"
    )
    .eq("card_id", cardId.toUpperCase())
    .maybeSingle();

  if (error || !card) {
    return NextResponse.json({ error: "Kartu tidak ditemukan." }, { status: 404 });
  }
  if (!card.is_active || !card.pin_hash) {
    return NextResponse.json({ error: "Kartu belum diaktivasi." }, { status: 400 });
  }

  // Rate-limit: setelah beberapa kali PIN salah, kunci sementara.
  if (card.pin_locked_until && new Date(card.pin_locked_until).getTime() > Date.now()) {
    const minutesLeft = Math.ceil(
      (new Date(card.pin_locked_until).getTime() - Date.now()) / 60000
    );
    return NextResponse.json(
      { error: `Terlalu banyak PIN salah. Coba lagi dalam ${minutesLeft} menit.` },
      { status: 429 }
    );
  }

  // Verifikasi PIN lama
  const pinMatch = await bcrypt.compare(pin, card.pin_hash);
  if (!pinMatch) {
    const attempts = (card.pin_failed_attempts || 0) + 1;
    const shouldLock = attempts >= MAX_PIN_ATTEMPTS;
    await supabase
      .from("cards")
      .update({
        pin_failed_attempts: shouldLock ? 0 : attempts,
        pin_locked_until: shouldLock
          ? new Date(Date.now() + PIN_LOCK_MINUTES * 60000).toISOString()
          : card.pin_locked_until,
      })
      .eq("card_id", cardId.toUpperCase());

    if (shouldLock) {
      return NextResponse.json(
        { error: `PIN salah ${MAX_PIN_ATTEMPTS}x. Kartu dikunci ${PIN_LOCK_MINUTES} menit.` },
        { status: 429 }
      );
    }
    return NextResponse.json(
      { error: `PIN yang Anda masukkan salah. Sisa percobaan: ${MAX_PIN_ATTEMPTS - attempts}.` },
      { status: 401 }
    );
  }

  // Aksi khusus: ambil daftar keluhan masuk (Rating Guard) untuk kartu ini
  if (action === "get_feedback") {
    const { data: feedback, error: feedbackError } = await supabase
      .from("card_feedback")
      .select("id, rating, message, customer_name, customer_phone, created_at")
      .eq("card_id", cardId.toUpperCase())
      .order("created_at", { ascending: false })
      .limit(100);

    if (feedbackError) {
      console.error("Gagal ambil keluhan:", feedbackError.message);
      return NextResponse.json({ error: "Gagal memuat keluhan." }, { status: 500 });
    }

    return NextResponse.json({ ok: true, feedback: feedback || [] });
  }

  const updates: Record<string, any> = {};

  // Toggle sistem guard rating (bintang 4-5 -> Google, 1-3 -> keluhan)
  if (typeof ratingGuard === "boolean") {
    updates.rating_guard = ratingGuard;
  }

  if (newBusinessName) {
    updates.business_name = newBusinessName.trim();
  }

  if (newPlaceId) {
    updates.place_id = newPlaceId;
  }

  if (newGoogleReviewUrl && newGoogleReviewUrl.trim().length > 0) {
    updates.google_review_url = newGoogleReviewUrl.trim();
  } else if (newPlaceId) {
    updates.google_review_url = `https://search.google.com/local/writereview?placeid=${encodeURIComponent(
      newPlaceId
    )}`;
  }

  if (newPin) {
    if (!/^\d{4}$/.test(newPin)) {
      return NextResponse.json({ error: "PIN baru harus 4 digit angka." }, { status: 400 });
    }
    updates.pin_hash = await bcrypt.hash(newPin, 10);
  }

  const hasContentChanges = Object.keys(updates).length > 0;
  const hadFailedAttempts = (card.pin_failed_attempts || 0) > 0 || !!card.pin_locked_until;

  if (!hasContentChanges && !hadFailedAttempts) {
    return NextResponse.json({ error: "Tidak ada perubahan yang dikirim." }, { status: 400 });
  }

  if (hasContentChanges) {
    updates.updated_at = new Date().toISOString();
  }
  // PIN sudah benar → buka blokir & reset hitungan percobaan salah.
  if (hadFailedAttempts) {
    updates.pin_failed_attempts = 0;
    updates.pin_locked_until = null;
  }

  const { error: updateError } = await supabase
    .from("cards")
    .update(updates)
    .eq("card_id", cardId.toUpperCase());

  if (updateError) {
    console.error("Gagal update kartu:", updateError.message);
    return NextResponse.json({ error: "Gagal menyimpan perubahan." }, { status: 500 });
  }

  if (hasContentChanges) {
    await logCardChange(supabase, {
      cardId,
      action: "edit",
      actor: "client_pin",
      oldValues: pickTrackedFields(card),
      newValues: pickTrackedFields(updates),
      ...getRequestMeta(req),
    });
  }

  return NextResponse.json({ ok: true, message: "Berhasil memperbarui data kartu." });
}
