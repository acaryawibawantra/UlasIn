import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { getClientSession } from "@/lib/client-auth";

export async function GET() {
  const session = await getClientSession();
  if (!session) {
    return NextResponse.json({ error: "Belum login." }, { status: 401 });
  }

  try {
    const supabase = getSupabaseServerClient();

    const { data: client, error: cErr } = await supabase
      .from("clients")
      .select(
        "slug, business_name, status, template_key, logo_url, cover_mobile_url, tagline, operating_hours, wifi_ssid, wifi_password, google_place_id, google_review_url, theme_accent, theme_bg, address, instagram_url, whatsapp_url, feature_flags, wifi_zones"
      )
      .eq("slug", session.clientSlug)
      .maybeSingle();

    if (cErr || !client) {
      return NextResponse.json({ error: "Data bisnis tidak ditemukan." }, { status: 404 });
    }

    const [{ data: categories }, { data: items }] = await Promise.all([
      supabase
        .from("menu_categories")
        .select("*")
        .eq("client_slug", session.clientSlug)
        .order("sort_order", { ascending: true }),
      supabase
        .from("menu_items")
        .select("*")
        .eq("client_slug", session.clientSlug)
        .order("sort_order", { ascending: true }),
    ]);

    const itemList = items || [];
    return NextResponse.json({
      ok: true,
      email: session.email,
      client,
      categories: categories || [],
      items: itemList,
      stats: {
        totalCategories: (categories || []).length,
        totalItems: itemList.length,
        activeItems: itemList.filter((i: any) => i.active).length,
        featuredItems: itemList.filter((i: any) => i.is_featured).length,
      },
    });
  } catch (err) {
    console.error("client me err:", err);
    return NextResponse.json({ error: "Terjadi kesalahan server." }, { status: 500 });
  }
}
