import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { getCompanySession } from "@/lib/company-auth";

export async function GET(req: NextRequest) {
  const session = await getCompanySession();
  if (!session) {
    return NextResponse.json({ error: "Belum login." }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const cardId = searchParams.get("cardId");

    const supabase = getSupabaseServerClient();

    let query = supabase
      .from("card_feedback")
      .select(
        "id, card_id, rating, message, customer_name, customer_phone, created_at, cards(business_name, batch_label)"
      )
      .order("created_at", { ascending: false })
      .limit(200);

    if (cardId) {
      query = query.eq("card_id", cardId.toUpperCase());
    }

    const { data, error } = await query;

    if (error) {
      console.warn("company feedback fetch skipped:", error.message);
      return NextResponse.json({ ok: true, feedback: [] });
    }

    const companyName = session.companyName;
    const filtered = (data || []).filter(
      (f: any) => f.cards?.batch_label === companyName
    );

    return NextResponse.json({
      ok: true,
      feedback: filtered,
      total: filtered.length,
    });
  } catch (err) {
    console.error("company feedback err:", err);
    return NextResponse.json({ error: "Terjadi kesalahan server." }, { status: 500 });
  }
}
