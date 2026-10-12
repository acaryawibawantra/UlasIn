import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { getCompanySession } from "@/lib/company-auth";
import { isBlockedReviewUrl, buildPlaceReviewUrl } from "@/lib/review-url";
import { logCardChange, pickTrackedFields, getRequestMeta } from "@/lib/card-audit";

export async function PATCH(req: NextRequest) {
  const session = await getCompanySession();
  if (!session) {
    return NextResponse.json({ error: "Belum login." }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { cardId } = body || {};

    if (!cardId) {
      return NextResponse.json({ error: "Card ID wajib diisi." }, { status: 400 });
    }

    const cardIdUpper = cardId.toString().toUpperCase();
    const supabase = getSupabaseServerClient();

    const { data: card, error: fetchErr } = await supabase
      .from("cards")
      .select(
        "card_id, batch_label, business_name, place_id, google_review_url, is_active, rating_guard, tap_count"
      )
      .eq("card_id", cardIdUpper)
      .maybeSingle();

    if (fetchErr || !card) {
      return NextResponse.json({ error: "Kartu tidak ditemukan." }, { status: 404 });
    }

    if (card.batch_label !== session.companyName) {
      return NextResponse.json(
        { error: "Kartu ini bukan milik perusahaan Anda." },
        { status: 403 }
      );
    }

    // RESET KARTU: kosongkan semua data & nonaktifkan.
    if (body?.reset === true) {
      const { error: resetErr } = await supabase
        .from("cards")
        .update({
          business_name: null,
          place_id: null,
          google_review_url: null,
          pin_hash: null,
          is_active: false,
          activated_at: null,
          rating_guard: false,
          tap_count: 0,
          last_tap_at: null,
          pin_failed_attempts: 0,
          pin_locked_until: null,
          updated_at: new Date().toISOString(),
        })
        .eq("card_id", cardIdUpper);

      if (resetErr) {
        console.error("company card reset err:", resetErr.message);
        return NextResponse.json({ error: "Gagal mereset kartu." }, { status: 500 });
      }

      await logCardChange(supabase, {
        cardId: cardIdUpper,
        action: "company_reset",
        actor: `company:${session.companyName}`,
        oldValues: pickTrackedFields(card),
        newValues: { business_name: null, google_review_url: null, is_active: false },
        ...getRequestMeta(req),
      });

      return NextResponse.json({ ok: true, message: "Kartu berhasil direset." });
    }

    const updates: Record<string, any> = {};

    if (typeof body.ratingGuard === "boolean") {
      updates.rating_guard = body.ratingGuard;
    }

    if (typeof body.newBusinessName === "string" && body.newBusinessName.trim().length > 0) {
      updates.business_name = body.newBusinessName.trim();
    }

    if (typeof body.newPlaceId === "string" && body.newPlaceId.trim().length > 0) {
      updates.place_id = body.newPlaceId.trim();
      if (!body.newGoogleReviewUrl) {
        updates.google_review_url = buildPlaceReviewUrl(body.newPlaceId.trim());
      }
    }

    if (typeof body.newGoogleReviewUrl === "string" && body.newGoogleReviewUrl.trim().length > 0) {
      const url = body.newGoogleReviewUrl.trim();
      if (isBlockedReviewUrl(url)) {
        return NextResponse.json(
          {
            error:
              "Link Google Maps ini tidak valid (mengarah ke tempat yang salah, bukan form ulasan).",
          },
          { status: 400 }
        );
      }
      updates.google_review_url = url;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Tidak ada perubahan yang dikirim." }, { status: 400 });
    }

    updates.updated_at = new Date().toISOString();

    const { error: updateErr } = await supabase
      .from("cards")
      .update(updates)
      .eq("card_id", cardIdUpper);

    if (updateErr) {
      console.error("company card update err:", updateErr.message);
      return NextResponse.json({ error: "Gagal menyimpan perubahan." }, { status: 500 });
    }

    await logCardChange(supabase, {
      cardId: cardIdUpper,
      action: "company_edit",
      actor: `company:${session.companyName}`,
      oldValues: pickTrackedFields(card),
      newValues: pickTrackedFields(updates),
      ...getRequestMeta(req),
    });

    return NextResponse.json({ ok: true, message: "Berhasil memperbarui kartu." });
  } catch (err) {
    console.error("company card patch err:", err);
    return NextResponse.json({ error: "Terjadi kesalahan server." }, { status: 500 });
  }
}
