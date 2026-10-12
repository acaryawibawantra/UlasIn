import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { getCompanySession } from "@/lib/company-auth";

export async function GET() {
  const session = await getCompanySession();
  if (!session) {
    return NextResponse.json({ error: "Belum login." }, { status: 401 });
  }

  try {
    const supabase = getSupabaseServerClient();

    const { data: cards, error } = await supabase
      .from("cards")
      .select(
        "card_id, business_name, place_id, google_review_url, is_active, rating_guard, created_at, activated_at, tap_count, last_tap_at, prod_card_ready, prod_nfc_installed, prod_ready_sell"
      )
      .eq("batch_label", session.companyName)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("company cards fetch err:", error.message);
      return NextResponse.json({ error: "Gagal memuat data kartu." }, { status: 500 });
    }

    const list = cards || [];
    const totalCards = list.length;
    const activeCards = list.filter((c) => c.is_active).length;
    const totalTaps = list.reduce((sum, c) => sum + (c.tap_count || 0), 0);
    const guardOnCards = list.filter((c) => c.rating_guard).length;

    return NextResponse.json({
      ok: true,
      companyName: session.companyName,
      cards: list,
      stats: {
        totalCards,
        activeCards,
        inactiveCards: totalCards - activeCards,
        totalTaps,
        guardOnCards,
      },
    });
  } catch (err) {
    console.error("company cards err:", err);
    return NextResponse.json({ error: "Terjadi kesalahan server." }, { status: 500 });
  }
}
