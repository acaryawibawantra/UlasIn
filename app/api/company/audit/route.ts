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

    if (!cardId) {
      return NextResponse.json({ error: "Card ID wajib diisi." }, { status: 400 });
    }

    const cardIdUpper = cardId.toUpperCase();
    const supabase = getSupabaseServerClient();

    // Verifikasi kartu milik perusahaan ini.
    const { data: card } = await supabase
      .from("cards")
      .select("card_id, batch_label")
      .eq("card_id", cardIdUpper)
      .maybeSingle();

    if (!card || card.batch_label !== session.companyName) {
      return NextResponse.json(
        { error: "Kartu ini bukan milik perusahaan Anda." },
        { status: 403 }
      );
    }

    const { data, error } = await supabase
      .from("card_audit_log")
      .select("*")
      .eq("card_id", cardIdUpper)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      if (error.message.includes("does not exist") || (error as any)?.code === "42P01") {
        return NextResponse.json({ ok: true, logs: [], migrated: false });
      }
      console.error("company audit err:", error.message);
      return NextResponse.json({ error: "Gagal memuat riwayat." }, { status: 500 });
    }

    return NextResponse.json({ ok: true, logs: data || [], migrated: true });
  } catch (err) {
    console.error("company audit catch:", err);
    return NextResponse.json({ error: "Terjadi kesalahan server." }, { status: 500 });
  }
}
