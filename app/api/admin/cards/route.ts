import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServer";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { secretKey } = body || {};
    const adminSecret = process.env.ADMIN_SECRET_KEY || "ratey-admin-secret-2026";

    if (!secretKey || secretKey !== adminSecret) {
      return NextResponse.json({ error: "Akses ditolak." }, { status: 401 });
    }

    const supabase = getSupabaseServerClient();

    // 1. Fetch data Cards (Ratey Direct)
    const { data: cards, error: cardsError } = await supabase
      .from("cards")
      .select("*")
      .order("created_at", { ascending: false });

    if (cardsError) {
      console.error("Error fetching cards:", cardsError.message);
      return NextResponse.json({ error: "Gagal mengambil data kartu." }, { status: 500 });
    }

    const totalCount = cards?.length || 0;
    const activeCount = cards?.filter((c) => c.is_active).length || 0;
    const inactiveCount = totalCount - activeCount;

    // 1b. Fetch keluhan guard (rating 1-3) — join nama bisnis dari tabel cards.
    // Kalau tabel card_feedback belum dibuat (SQL belum dijalankan), skip graceful.
    const { data: feedback, error: feedbackError } = await supabase
      .from("card_feedback")
      .select("id, card_id, rating, message, customer_name, customer_phone, created_at, cards(business_name)")
      .order("created_at", { ascending: false })
      .limit(200);

    if (feedbackError) {
      console.warn("card_feedback fetch skipped:", feedbackError.message);
    }

    // 2. Fetch data Table QRs (Custom Meja Cafe)
    const { data: tableQrs, error: tableQrsError } = await supabase
      .from("table_qrs")
      .select("*")
      .order("client_slug", { ascending: true })
      .order("table_num", { ascending: true });

    if (tableQrsError) {
      console.error("Error fetching table_qrs:", tableQrsError.message);
      // Jangan fail total — tetap kembalikan cards, tableQrs kosong
      console.warn("table_qrs fetch skipped (belum migrate tabelnya?)");
    }

    // Group tableQrs by client_slug untuk summary stats
    type TableQrRow = NonNullable<typeof tableQrs>[number];
    const clientGroups: Record<string, TableQrRow[]> = {};
    for (const t of (tableQrs || []) as TableQrRow[]) {
      if (!clientGroups[t.client_slug]) clientGroups[t.client_slug] = [];
      clientGroups[t.client_slug].push(t);
    }

    // 3. Fetch data CLIENTS (Master Multi-Client Template)
    const { data: clients, error: clientsError } = await supabase
      .from("clients")
      .select("*")
      .order("created_at", { ascending: false });

    if (clientsError) {
      console.error("Error fetching clients:", clientsError.message);
      console.warn("clients fetch skipped (belum migrate tabel clients?)");
    }
    type ClientRow = NonNullable<typeof clients>[number];
    const clientsList = (clients || []) as ClientRow[];
    const totalActiveClients = clientsList.filter((c) => c.status === "active").length;

    return NextResponse.json({
      ok: true,
      cards: cards || [],
      feedback: feedbackError ? [] : feedback || [],
      stats: {
        totalCount,
        activeCount,
        inactiveCount,
      },
      tableQrs: tableQrs || [],
      tableQrStats: {
        totalTables: tableQrs?.length || 0,
        totalClients: Object.keys(clientGroups).length,
        clientGroups,
      },
      clients: clientsList,
      clientStats: {
        totalClients: clientsList.length,
        totalActiveClients,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: "Terjadi kesalahan server." }, { status: 500 });
  }
}
