import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServer";

// Submit keluhan dari halaman Rating Guard (hanya rating 1-3).
// Public endpoint: dipakai pelanggan yang tap/scan kartu (tanpa login).
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { cardId, rating, message, customerName, customerPhone } = body || {};

    if (!cardId || typeof cardId !== "string") {
      return NextResponse.json({ error: "Card ID tidak valid." }, { status: 400 });
    }

    const ratingNum = Number(rating);
    if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 3) {
      return NextResponse.json({ error: "Rating harus antara 1 sampai 3 bintang." }, { status: 400 });
    }

    const trimmedMessage = String(message || "").trim();
    if (trimmedMessage.length < 10) {
      return NextResponse.json({ error: "Ceritakan keluhan Anda minimal 10 karakter." }, { status: 400 });
    }
    if (trimmedMessage.length > 2000) {
      return NextResponse.json({ error: "Keluhan terlalu panjang (maks 2000 karakter)." }, { status: 400 });
    }

    const trimmedName = String(customerName || "").trim().slice(0, 100);
    const trimmedPhone = String(customerPhone || "").trim().slice(0, 20);
    if (trimmedPhone && !/^[+()\-\s\d]{8,20}$/.test(trimmedPhone)) {
      return NextResponse.json({ error: "Format nomor HP tidak valid." }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();

    // Validasi kartu: harus ada, aktif, dan guard menyala
    const { data: card, error: cardError } = await supabase
      .from("cards")
      .select("card_id, is_active, rating_guard")
      .eq("card_id", cardId.toUpperCase())
      .maybeSingle();

    if (cardError || !card) {
      return NextResponse.json({ error: "Kartu tidak ditemukan." }, { status: 404 });
    }
    if (!card.is_active) {
      return NextResponse.json({ error: "Kartu belum aktif." }, { status: 400 });
    }
    if (!card.rating_guard) {
      return NextResponse.json({ error: "Kartu ini tidak menerima keluhan." }, { status: 400 });
    }

    const { error: insertError } = await supabase.from("card_feedback").insert({
      card_id: card.card_id,
      rating: ratingNum,
      message: trimmedMessage,
      customer_name: trimmedName || null,
      customer_phone: trimmedPhone || null,
    });

    if (insertError) {
      console.error("Gagal simpan keluhan:", insertError.message);
      return NextResponse.json({ error: "Gagal mengirim keluhan. Coba lagi." }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Feedback API error:", err);
    return NextResponse.json({ error: "Terjadi kesalahan server." }, { status: 500 });
  }
}
