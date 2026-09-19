import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { getClientSession } from "@/lib/client-auth";

/*
 * API ACTION PORTAL CLIENT (/kelola)
 * Auth: session cookie ratey_client_session (HMAC).
 * KEAMANAN: client_slug SELALU diambil dari session (server-side),
 * TIDAK PERNAH dari body request — client tidak bisa menyentuh data client lain.
 */
export async function POST(req: NextRequest) {
  const session = await getClientSession();
  if (!session) {
    return NextResponse.json({ error: "Sesi berakhir. Silakan login ulang." }, { status: 401 });
  }

  try {
    const body = await req.json();
    const {
      action,
      // Category
      categoryId,
      categoryKey,
      categoryLabel,
      categorySortOrder,
      // Menu item
      menuItemId,
      menuItemName,
      menuItemCategoryKey,
      menuItemPriceLabel,
      menuItemPriceNum,
      menuItemDescription,
      menuItemImageUrl,
      menuItemBadge,
      menuItemIsFeatured,
      menuItemIsActive,
      menuItemSortOrder,
      menuItemSearchKey,
      // Profile (subset yang boleh diedit client)
      wifiSsid,
      wifiPassword,
      operatingHours,
      tagline,
      themeAccent,
      themeBg,
      logoUrl,
      coverMobileUrl,
      featureFlags,
    } = body || {};

    const supabase = getSupabaseServerClient();
    const slug = session.clientSlug; // 🔒 dipaksa dari session

    const catKeySan = (v: unknown) =>
      String(v || "").toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 30);

    /* ── KATEGORI ── */
    if (action === "create_menu_category") {
      const key = catKeySan(categoryKey);
      if (!key || !categoryLabel) {
        return NextResponse.json({ error: "Key dan nama kategori wajib diisi." }, { status: 400 });
      }
      const { error } = await supabase.from("menu_categories").insert({
        client_slug: slug,
        key,
        label: String(categoryLabel).slice(0, 50),
        sort_order: Number(categorySortOrder) || 0,
      });
      if (error) {
        if ((error as any)?.code === "23505")
          return NextResponse.json({ error: `Kategori "${key}" sudah ada.` }, { status: 409 });
        throw new Error(error.message);
      }
      return NextResponse.json({ ok: true, message: "Kategori dibuat." });
    }

    if (action === "update_menu_category") {
      const id = Number(categoryId);
      if (!Number.isFinite(id) || id <= 0) {
        return NextResponse.json({ error: "ID kategori tidak valid." }, { status: 400 });
      }
      const patch: Record<string, unknown> = {};
      if (categoryLabel !== undefined) patch.label = String(categoryLabel).slice(0, 50) || null;
      if (categorySortOrder !== undefined) patch.sort_order = Number(categorySortOrder) || 0;
      const { error } = await supabase
        .from("menu_categories")
        .update(patch)
        .eq("id", id)
        .eq("client_slug", slug); // double guard
      if (error) throw new Error(error.message);
      return NextResponse.json({ ok: true, message: "Kategori diupdate." });
    }

    if (action === "delete_menu_category") {
      const id = Number(categoryId);
      if (!Number.isFinite(id) || id <= 0) {
        return NextResponse.json({ error: "ID kategori tidak valid." }, { status: 400 });
      }
      const { error } = await supabase
        .from("menu_categories")
        .delete()
        .eq("id", id)
        .eq("client_slug", slug); // cascade hapus items
      if (error) throw new Error(error.message);
      return NextResponse.json({ ok: true, message: "Kategori & seluruh menunya dihapus." });
    }

    /* ── MENU ITEM ── */
    if (action === "create_menu_item") {
      if (!menuItemName || !menuItemCategoryKey) {
        return NextResponse.json({ error: "Nama menu dan kategori wajib diisi." }, { status: 400 });
      }
      // Pastikan kategori milik client ini
      const { count: catCount } = await supabase
        .from("menu_categories")
        .select("id", { count: "exact", head: true })
        .eq("client_slug", slug)
        .eq("key", catKeySan(menuItemCategoryKey));
      if ((catCount ?? 0) === 0) {
        return NextResponse.json({ error: "Kategori tidak ditemukan." }, { status: 400 });
      }
      const searchKey =
        (menuItemSearchKey || "").toString().trim().toLowerCase() ||
        String(menuItemName).toLowerCase();
      const { error } = await supabase.from("menu_items").insert({
        client_slug: slug,
        category_key: catKeySan(menuItemCategoryKey),
        name: String(menuItemName).slice(0, 100),
        price_label: String(menuItemPriceLabel || "").slice(0, 15) || null,
        price_num: menuItemPriceNum ? Number(menuItemPriceNum) : null,
        description: menuItemDescription ? String(menuItemDescription).slice(0, 400) : null,
        image_url: menuItemImageUrl ? String(menuItemImageUrl).slice(0, 500) : null,
        badge: menuItemBadge ? String(menuItemBadge).slice(0, 20) : null,
        is_featured: !!menuItemIsFeatured,
        active: menuItemIsActive !== false,
        sort_order: Number(menuItemSortOrder) || 0,
        search_key: searchKey,
      });
      if (error) {
        if ((error as any)?.code === "23503")
          return NextResponse.json({ error: "Kategori tidak valid." }, { status: 400 });
        throw new Error(error.message);
      }
      return NextResponse.json({ ok: true, message: "Menu ditambahkan." });
    }

    if (action === "update_menu_item") {
      const id = Number(menuItemId);
      if (!Number.isFinite(id) || id <= 0) {
        return NextResponse.json({ error: "ID menu tidak valid." }, { status: 400 });
      }
      const patch: Record<string, unknown> = {};
      if (menuItemCategoryKey !== undefined) patch.category_key = catKeySan(menuItemCategoryKey);
      if (menuItemName !== undefined) patch.name = String(menuItemName).slice(0, 100) || null;
      if (menuItemPriceLabel !== undefined) patch.price_label = String(menuItemPriceLabel).slice(0, 15) || null;
      if (menuItemPriceNum !== undefined) patch.price_num = menuItemPriceNum === null || menuItemPriceNum === "" ? null : Number(menuItemPriceNum);
      if (menuItemDescription !== undefined) patch.description = menuItemDescription ? String(menuItemDescription).slice(0, 400) : null;
      if (menuItemImageUrl !== undefined) patch.image_url = menuItemImageUrl ? String(menuItemImageUrl).slice(0, 500) : null;
      if (menuItemBadge !== undefined) patch.badge = menuItemBadge ? String(menuItemBadge).slice(0, 20) : null;
      if (menuItemIsFeatured !== undefined) patch.is_featured = !!menuItemIsFeatured;
      if (menuItemIsActive !== undefined) patch.active = !!menuItemIsActive;
      if (menuItemSortOrder !== undefined) patch.sort_order = Number(menuItemSortOrder) || 0;
      if (menuItemSearchKey !== undefined)
        patch.search_key = menuItemSearchKey ? String(menuItemSearchKey).toLowerCase() : null;

      const { error } = await supabase
        .from("menu_items")
        .update(patch)
        .eq("id", id)
        .eq("client_slug", slug);
      if (error) {
        if ((error as any)?.code === "23503")
          return NextResponse.json({ error: "Kategori tidak valid." }, { status: 400 });
        throw new Error(error.message);
      }
      return NextResponse.json({ ok: true, message: "Menu diupdate." });
    }

    if (action === "delete_menu_item") {
      const id = Number(menuItemId);
      if (!Number.isFinite(id) || id <= 0) {
        return NextResponse.json({ error: "ID menu tidak valid." }, { status: 400 });
      }
      const { error } = await supabase
        .from("menu_items")
        .delete()
        .eq("id", id)
        .eq("client_slug", slug);
      if (error) throw new Error(error.message);
      return NextResponse.json({ ok: true, message: "Menu dihapus." });
    }

    /* ── PROFIL BISNIS (subset aman — BUKAN slug/status/template/place) ── */
    if (action === "update_profile") {
      const patch: Record<string, unknown> = {};
      if (wifiSsid !== undefined) patch.wifi_ssid = wifiSsid ? String(wifiSsid).slice(0, 60) : null;
      if (wifiPassword !== undefined) patch.wifi_password = wifiPassword ? String(wifiPassword).slice(0, 80) : null;
      if (operatingHours !== undefined) patch.operating_hours = operatingHours ? String(operatingHours).slice(0, 100) : null;
      if (tagline !== undefined) patch.tagline = tagline ? String(tagline).slice(0, 120) : null;
      if (themeAccent !== undefined) patch.theme_accent = /^#[0-9a-fA-F]{6}$/.test(String(themeAccent)) ? themeAccent : undefined;
      if (themeBg !== undefined) patch.theme_bg = /^#[0-9a-fA-F]{6}$/.test(String(themeBg)) ? themeBg : undefined;
      if (logoUrl !== undefined) patch.logo_url = logoUrl ? String(logoUrl).slice(0, 500) : null;
      if (coverMobileUrl !== undefined) patch.cover_mobile_url = coverMobileUrl ? String(coverMobileUrl).slice(0, 500) : null;

      // Feature flags: whitelist key + tipe boolean, merge partial dengan nilai existing
      if (featureFlags && typeof featureFlags === "object" && !Array.isArray(featureFlags)) {
        const ALLOWED_FLAGS = ["waiter_call", "review", "wifi"];
        const { data: cur } = await supabase
          .from("clients")
          .select("feature_flags")
          .eq("slug", slug)
          .maybeSingle();
        const merged: Record<string, boolean> = {
          waiter_call: true,
          review: true,
          wifi: true,
          ...(cur?.feature_flags || {}),
        };
        for (const k of ALLOWED_FLAGS) {
          if (typeof (featureFlags as Record<string, unknown>)[k] === "boolean") {
            merged[k] = (featureFlags as Record<string, boolean>)[k];
          }
        }
        patch.feature_flags = merged;
      }

      // buang key undefined (validasi hex gagal)
      Object.keys(patch).forEach((k) => patch[k] === undefined && delete patch[k]);

      const { error } = await supabase.from("clients").update(patch).eq("slug", slug);
      if (error) throw new Error(error.message);
      return NextResponse.json({ ok: true, message: "Pengaturan disimpan." });
    }

    return NextResponse.json({ error: `Aksi "${action}" tidak dikenal.` }, { status: 400 });
  } catch (err) {
    console.error("client action err:", err);
    return NextResponse.json({ error: "Terjadi kesalahan server." }, { status: 500 });
  }
}
