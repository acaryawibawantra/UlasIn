import { notFound } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import TemplateTammmuV1 from "./template-tammmu-v1";
import { Suspense } from "react";

/* ─── Force dynamic rendering (no cache, always fresh DB data) ─── */
export const dynamic = "force-dynamic";
export const revalidate = 0;

type Params = { client_slug: string; table_num: string };

export default async function ClientTemplatePage({ params }: { params: Promise<Params> | Params }) {
  /* Resolve params */
  const p = await Promise.resolve(params);
  const rawClientSlug = p.client_slug;
  const rawTableNum = p.table_num;

  /* Normalize table num to 2 digits */
  const numericMatch = rawTableNum.match(/\d+/);
  const num = numericMatch ? parseInt(numericMatch[0], 10) : 1;
  const tableNum = String(num).padStart(2, "0");

  const supabase = getSupabaseServerClient();

  /* 1. Fetch Client data (branding, theme, wifi, review, etc) */
  const { data: client, error: clientErr } = await supabase
    .from("clients")
    .select("*")
    .eq("slug", rawClientSlug)
    .maybeSingle();

  if (clientErr || !client) {
    return notFound();
  }

  /* Allow draft/active — inactive still visible but you could gate later */
  if (client.status === "inactive") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF8F5] text-[#3C3833] font-body">
        <div className="text-center px-6 max-w-md">
          <div className="w-16 h-16 rounded-2xl bg-[#F3EFEA] mx-auto mb-4 flex items-center justify-center">
            <span className="material-symbols-outlined text-[#8E897C] text-3xl">visibility_off</span>
          </div>
          <h1 className="font-bold text-lg mb-1">{client.business_name}</h1>
          <p className="text-xs text-[#8E897C]">Halaman ini belum aktif. Silakan hubungi pihak usaha.</p>
        </div>
      </div>
    );
  }

  /* 2. Fetch Menu Categories — graceful if table not migrated yet */
  let categories: { key: string; label: string; sort_order: number }[] = [];
  try {
    const { data: cats, error } = await supabase
      .from("menu_categories")
      .select("key, label, sort_order")
      .eq("client_slug", rawClientSlug)
      .order("sort_order", { ascending: true });
    if (!error && cats) categories = cats;
  } catch {
    /* graceful */
  }

  /* 3. Fetch Menu Items — ordered featured, sort_order, name */
  let items: {
    id: number;
    name: string;
    category_key: string;
    price_label: string;
    price_num: number | null;
    description: string | null;
    image_url: string | null;
    badge: string | null;
    is_featured: boolean;
    search_key: string | null;
  }[] = [];
  try {
    const { data: its, error } = await supabase
      .from("menu_items")
      .select(
        `id, name, category_key, price_label, price_num, description, image_url, badge, is_featured, search_key, active, sort_order`
      )
      .eq("client_slug", rawClientSlug)
      .eq("active", true)
      .order("is_featured", { ascending: false })
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("name", { ascending: true });
    if (!error && its) {
      items = its.map((r: any) => ({
        id: r.id,
        name: r.name,
        category_key: r.category_key,
        price_label: r.price_label,
        price_num: typeof r.price_num === "number" ? r.price_num : null,
        description: r.description || null,
        image_url: r.image_url || null,
        badge: r.badge || null,
        is_featured: !!r.is_featured,
        search_key: r.search_key || null,
      }));
    }
  } catch {
    /* graceful */
  }

  /* 4. If there are items but no explicit categories — derive from items */
  if (categories.length === 0 && items.length > 0) {
    const set = new Map<string, number>();
    let so = 0;
    for (const it of items) {
      if (!set.has(it.category_key)) {
        set.set(it.category_key, so++);
      }
    }
    categories = Array.from(set.entries()).map(([key, sort_order]) => ({
      key,
      label: key.charAt(0).toUpperCase() + key.slice(1).replace(/[_-]/g, " "),
      sort_order,
    }));
  }

  /* 5. Choose template renderer based on client.template_key */
  const template = (client.template_key || "tammmu_v1").toLowerCase();

  /* Zona WiFi: kirim HANYA zona yang cocok dengan nomor meja ini ke browser
     (privasi — password zona lain tidak ikut dalam payload HTML) */
  const matchedZone = (Array.isArray(client.wifi_zones) ? client.wifi_zones : []).find(
    (z: any) => typeof z?.from === "number" && typeof z?.to === "number" && num >= z.from && num <= z.to
  );

  let templateRender: React.ReactNode;
  if (template === "tammmu_v1" || true /* fallback default */) {
    templateRender = (
      <TemplateTammmuV1
        client={{
          slug: client.slug,
          business_name: client.business_name,
          logo_url: client.logo_url,
          cover_mobile_url: client.cover_mobile_url,
          theme_accent: client.theme_accent,
          theme_bg: client.theme_bg,
          tagline: client.tagline,
          operating_hours: client.operating_hours,
          wifi_ssid: client.wifi_ssid,
          wifi_password: client.wifi_password,
          google_place_id: client.google_place_id,
          google_review_url: client.google_review_url,
          address: client.address,
          instagram_url: client.instagram_url,
          whatsapp_url: client.whatsapp_url,
          feature_flags: client.feature_flags,
          wifi_zones: matchedZone ? [matchedZone] : [],
        }}
        categories={categories}
        items={items}
        tableNum={tableNum}
      />
    );
  }

  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center text-xs text-[#8E897C]">
          Loading...
        </div>
      }
    >
      {templateRender}
    </Suspense>
  );
}
