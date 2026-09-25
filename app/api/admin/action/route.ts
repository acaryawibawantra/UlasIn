import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { TAMMMU_PRESET_CATEGORIES, TAMMMU_PRESET_ITEMS, TAMMMU_ASSET_BASE } from "@/lib/tammmu-preset-menu";
import { hashPassword } from "@/lib/client-auth";

function generateCardId(length = 6) {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let id = "";
  for (let i = 0; i < length; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

function sanitizeSlug(slug: string): string {
  return slug
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 40);
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const body = await req.json();
    const {
      secretKey,
      action,
      cardId,
      count,
      clientSlug,
      tableNum,
      tableQrId,
      // Client fields
      clientId,
      businessName,
      status,
      logoUrl,
      coverMobileUrl,
      themeAccent,
      themeBg,
      tagline,
      fontHeading,
      operatingHours,
      wifiSsid,
      wifiPassword,
      googlePlaceId,
      googleReviewUrl,
      address,
      instagramUrl,
      whatsappUrl,
      // Template key
      templateKey,
      // Menu Categories fields
      categoryId,
      categoryKey,
      categoryLabel,
      categorySortOrder,
      // Menu Items fields
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
    } = body || {};
    const adminSecret = process.env.ADMIN_SECRET_KEY || "ratey-admin-secret-2026";

    // Support both header authorization and JSON body secretKey
    const providedKey = authHeader ? authHeader.replace("Bearer ", "") : secretKey;

    if (!providedKey || providedKey !== adminSecret) {
      return NextResponse.json({ error: "Akses ditolak. Secret key salah." }, { status: 401 });
    }

    const supabase = getSupabaseServerClient();
    const rawBaseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://ratey.site";
    const baseUrl = rawBaseUrl.trim().replace(/\/+$/, "");

    // ─────────────────────────────────────────────────────────────────────
    // 1. RESET CARD (Set back to unactivated status)
    // ─────────────────────────────────────────────────────────────────────
    if (action === "reset") {
      if (!cardId) {
        return NextResponse.json({ error: "Card ID wajib diisi." }, { status: 400 });
      }

      const { error } = await supabase
        .from("cards")
        .update({
          business_name: null,
          place_id: null,
          google_review_url: null,
          pin_hash: null,
          is_active: false,
          activated_at: null,
        })
        .eq("card_id", cardId.toUpperCase());

      if (error) {
        return NextResponse.json({ error: "Gagal mereset kartu." }, { status: 500 });
      }

      return NextResponse.json({ ok: true, message: `Kartu ${cardId} berhasil di-reset.` });
    }

    // ─────────────────────────────────────────────────────────────────────
    // 1B. TOGGLE RATING GUARD (admin set guard ON/OFF tanpa PIN kartu)
    // ─────────────────────────────────────────────────────────────────────
    if (action === "toggle_guard") {
      if (!cardId) {
        return NextResponse.json({ error: "Card ID wajib diisi." }, { status: 400 });
      }

      const newGuardState = !!body?.ratingGuard;

      const { error } = await supabase
        .from("cards")
        .update({ rating_guard: newGuardState })
        .eq("card_id", cardId.toUpperCase());

      if (error) {
        console.error("toggle_guard error:", error.message);
        return NextResponse.json({ error: "Gagal mengubah guard rating. Pastikan SQL rating_guard sudah dijalankan." }, { status: 500 });
      }

      return NextResponse.json({
        ok: true,
        message: `Guard rating kartu ${cardId} ${newGuardState ? "AKTIF" : "dimatikan"}.`,
      });
    }

    // ─────────────────────────────────────────────────────────────────────
    // 2. DELETE CARD
    // ─────────────────────────────────────────────────────────────────────
    if (action === "delete") {
      if (!cardId) {
        return NextResponse.json({ error: "Card ID wajib diisi." }, { status: 400 });
      }

      const { error } = await supabase
        .from("cards")
        .delete()
        .eq("card_id", cardId.toUpperCase());

      if (error) {
        return NextResponse.json({ error: "Gagal menghapus kartu." }, { status: 500 });
      }

      return NextResponse.json({ ok: true, message: `Kartu ${cardId} berhasil dihapus.` });
    }

    // ─────────────────────────────────────────────────────────────────────
    // 2B. DELETE COMPANY BATCH (semua kartu dalam satu batch perusahaan)
    // ─────────────────────────────────────────────────────────────────────
    if (action === "delete_company_batch") {
      const batch = String(body?.batchLabel || "").trim();
      if (!batch) {
        return NextResponse.json({ error: "Nama perusahaan wajib diisi." }, { status: 400 });
      }

      const { error } = await supabase
        .from("cards")
        .delete()
        .eq("order_type", "khusus")
        .eq("batch_label", batch);

      if (error) {
        console.error("delete_company_batch error:", error.message);
        return NextResponse.json({ error: "Gagal menghapus batch perusahaan." }, { status: 500 });
      }

      return NextResponse.json({
        ok: true,
        message: `Batch perusahaan "${batch}" berhasil dihapus.`,
      });
    }

    // ─────────────────────────────────────────────────────────────────────
    // 3. INSTANT GENERATE CARDS FROM BROWSER
    // ─────────────────────────────────────────────────────────────────────
    if (action === "generate") {
      const cardCount = Math.min(Math.max(Number(count) || 1, 1), 500);
      // Batch Perusahaan: label nama perusahaan + tipe order (khusus=borongan / umum)
      const batchLabel = String(body?.batchLabel || "").trim().slice(0, 60) || null;
      const orderType = body?.orderType === "khusus" ? "khusus" : "umum";
      if (orderType === "khusus" && !batchLabel) {
        return NextResponse.json(
          { error: "Nama perusahaan wajib diisi untuk kartu tipe Perusahaan." },
          { status: 400 }
        );
      }
      const generatedCards: Array<{ card_id: string; url: string; batch_label: string | null; order_type: string }> = [];

      for (let i = 0; i < cardCount; i++) {
        let newId = generateCardId();

        // Ensure uniqueness
        let { data: existing } = await supabase
          .from("cards")
          .select("card_id")
          .eq("card_id", newId)
          .maybeSingle();

        while (existing) {
          newId = generateCardId();
          const check = await supabase
            .from("cards")
            .select("card_id")
            .eq("card_id", newId)
            .maybeSingle();
          existing = check.data;
        }

        const { error } = await supabase
          .from("cards")
          .insert({ card_id: newId, batch_label: batchLabel, order_type: orderType });
        if (error) {
          console.error(`Gagal insert card ${newId}:`, error.message);
          continue;
        }

        generatedCards.push({
          card_id: newId,
          url: `${baseUrl}/c/${newId}`,
          batch_label: batchLabel,
          order_type: orderType,
        });
      }

      return NextResponse.json({
        ok: true,
        message: `Berhasil men-generate ${generatedCards.length} kartu baru${batchLabel ? ` untuk ${batchLabel}` : ""}.`,
        generatedCards,
      });
    }

    // ─────────────────────────────────────────────────────────────────────
    // 4. GENERATE TABLE QR (Custom Meja Cafe) — BATCH INSERT ke DB
    //    Skip existing (client_slug + table_num yang sudah ada tidak overwrite)
    // ─────────────────────────────────────────────────────────────────────
    if (action === "generate_table_qr") {
      const slug = sanitizeSlug(clientSlug || "");
      if (!slug) {
        return NextResponse.json(
          { error: "Client Slug tidak valid (hanya huruf kecil, angka, strip, underscore)." },
          { status: 400 }
        );
      }
      const tableCount = Math.min(Math.max(Number(count) || 1, 1), 500);

      // 1) Fetch existing meja untuk client ini (buat di-skip)
      const { data: existingRows, error: fetchError } = await supabase
        .from("table_qrs")
        .select("table_num")
        .eq("client_slug", slug);

      if (fetchError) {
        console.error("fetch table_qrs error:", fetchError.message);
        return NextResponse.json({ error: "Gagal cek data meja existing." }, { status: 500 });
      }

      const existingSet = new Set((existingRows || []).map((r: any) => r.table_num));
      const newlyCreated: Array<{ id: number; client_slug: string; table_num: string; url: string }> = [];
      let skipped = 0;

      // 2) Loop & upsert (skip existing)
      for (let i = 1; i <= tableCount; i++) {
        const num = String(i).padStart(2, "0");
        if (existingSet.has(num)) { skipped++; continue; }

        const url = `${baseUrl}/${slug}/${num}`;
        const { data: inserted, error: insError } = await supabase
          .from("table_qrs")
          .insert({ client_slug: slug, table_num: num, url })
          .select("id, client_slug, table_num, url")
          .maybeSingle();

        if (insError) {
          // Unique violation (race condition) — skip dengan aman
          if ((insError as any)?.code === "23505") { skipped++; continue; }
          console.error(`insert table_qr error for ${slug}/${num}:`, insError.message);
          continue;
        }
        if (inserted) newlyCreated.push(inserted as any);
      }

      return NextResponse.json({
        ok: true,
        message: `Selesai. Baru dibuat: ${newlyCreated.length}. Di-skip (sudah ada): ${skipped}.`,
        clientSlug: slug,
        newlyCreated,
        skippedCount: skipped,
      });
    }

    // ─────────────────────────────────────────────────────────────────────
    // 5. DELETE SINGLE TABLE QR (by id)
    // ─────────────────────────────────────────────────────────────────────
    if (action === "delete_table_qr") {
      const id = Number(tableQrId);
      if (!Number.isFinite(id) || id <= 0) {
        return NextResponse.json({ error: "ID Table QR tidak valid." }, { status: 400 });
      }
      const { error } = await supabase.from("table_qrs").delete().eq("id", id);
      if (error) {
        console.error("delete_table_qr error:", error.message);
        return NextResponse.json({ error: "Gagal menghapus meja." }, { status: 500 });
      }
      return NextResponse.json({ ok: true, message: `Meja #${id} berhasil dihapus.` });
    }

    // ─────────────────────────────────────────────────────────────────────
    // 6. DELETE ALL TABLE QR BY CLIENT SLUG
    // ─────────────────────────────────────────────────────────────────────
    if (action === "delete_client_table_batch") {
      const slug = sanitizeSlug(clientSlug || "");
      if (!slug) {
        return NextResponse.json({ error: "Client Slug tidak valid." }, { status: 400 });
      }
      const { error } = await supabase.from("table_qrs").delete().eq("client_slug", slug);
      if (error) {
        console.error("delete_client_table_batch error:", error.message);
        return NextResponse.json({ error: "Gagal menghapus batch client." }, { status: 500 });
      }
      return NextResponse.json({ ok: true, message: `Semua meja client "${slug}" berhasil dihapus.` });
    }

    // ─────────────────────────────────────────────────────────────────────
    // 7. CREATE CLIENT (Master Multi-Client)
    // ─────────────────────────────────────────────────────────────────────
    if (action === "create_client") {
      const slug = sanitizeSlug(clientSlug || "");
      if (!slug || !businessName || !String(businessName).trim()) {
        return NextResponse.json(
          { error: "Slug & Business Name wajib diisi & valid." },
          { status: 400 }
        );
      }
      const payload: any = {
        slug,
        business_name: String(businessName).trim(),
        status: status || "active",
        template_key: templateKey || "tammmu_v1",
      };
      if (logoUrl != null) payload.logo_url = logoUrl;
      if (coverMobileUrl != null) payload.cover_mobile_url = coverMobileUrl;
      if (themeAccent != null) payload.theme_accent = themeAccent;
      if (themeBg != null) payload.theme_bg = themeBg;
      if (tagline != null) payload.tagline = tagline;
      if (fontHeading != null) payload.font_heading = fontHeading;
      if (operatingHours != null) payload.operating_hours = operatingHours;
      if (wifiSsid != null) payload.wifi_ssid = wifiSsid;
      if (wifiPassword != null) payload.wifi_password = wifiPassword;
      if (googlePlaceId != null) payload.google_place_id = googlePlaceId;
      if (googleReviewUrl != null) payload.google_review_url = googleReviewUrl;
      if (address != null) payload.address = address;
      if (instagramUrl != null) payload.instagram_url = instagramUrl;
      if (whatsappUrl != null) payload.whatsapp_url = whatsappUrl;

      const { data: row, error: insError } = await supabase
        .from("clients")
        .insert(payload)
        .select("*")
        .maybeSingle();

      if (insError) {
        if ((insError as any)?.code === "23505") {
          return NextResponse.json(
            { error: `Slug "${slug}" sudah terpakai, gunakan slug lain.` },
            { status: 409 }
          );
        }
        console.error("create_client error:", insError.message);
        return NextResponse.json({ error: "Gagal membuat client." }, { status: 500 });
      }

      return NextResponse.json({
        ok: true,
        message: `Client "${slug}" berhasil dibuat.`,
        client: row,
      });
    }

    // ─────────────────────────────────────────────────────────────────────
    // 8. UPDATE CLIENT
    // ─────────────────────────────────────────────────────────────────────
    if (action === "update_client") {
      const slug = sanitizeSlug(clientSlug || "");
      if (!slug) {
        return NextResponse.json({ error: "Client Slug wajib diisi." }, { status: 400 });
      }
      const payload: any = {};
      if (businessName != null) payload.business_name = String(businessName).trim();
      if (status != null) payload.status = status;
      if (templateKey != null) payload.template_key = templateKey;
      if (logoUrl !== undefined) payload.logo_url = logoUrl || null;
      if (coverMobileUrl !== undefined) payload.cover_mobile_url = coverMobileUrl || null;
      if (themeAccent != null) payload.theme_accent = themeAccent;
      if (themeBg != null) payload.theme_bg = themeBg;
      if (tagline !== undefined) payload.tagline = tagline || null;
      if (fontHeading !== undefined) payload.font_heading = fontHeading || null;
      if (operatingHours !== undefined) payload.operating_hours = operatingHours || null;
      if (wifiSsid !== undefined) payload.wifi_ssid = wifiSsid || null;
      if (wifiPassword !== undefined) payload.wifi_password = wifiPassword || null;
      if (googlePlaceId !== undefined) payload.google_place_id = googlePlaceId || null;
      if (googleReviewUrl !== undefined) payload.google_review_url = googleReviewUrl || null;
      if (address !== undefined) payload.address = address || null;
      if (instagramUrl !== undefined) payload.instagram_url = instagramUrl || null;
      if (whatsappUrl !== undefined) payload.whatsapp_url = whatsappUrl || null;

      if (Object.keys(payload).length === 0) {
        return NextResponse.json({ error: "Tidak ada field untuk di-update." }, { status: 400 });
      }

      const { error } = await supabase.from("clients").update(payload).eq("slug", slug);
      if (error) {
        console.error("update_client error:", error.message);
        return NextResponse.json({ error: "Gagal update client." }, { status: 500 });
      }
      return NextResponse.json({
        ok: true,
        message: `Client "${slug}" berhasil di-update.`,
      });
    }

    // ─────────────────────────────────────────────────────────────────────
    // 9. DELETE CLIENT (on delete cascade akan hapus categories, menu, table_qrs)
    // ─────────────────────────────────────────────────────────────────────
    if (action === "delete_client") {
      const slug = sanitizeSlug(clientSlug || "");
      if (!slug) {
        return NextResponse.json({ error: "Client Slug tidak valid." }, { status: 400 });
      }
      const { error } = await supabase.from("clients").delete().eq("slug", slug);
      if (error) {
        console.error("delete_client error:", error.message);
        return NextResponse.json({ error: "Gagal menghapus client." }, { status: 500 });
      }
      return NextResponse.json({
        ok: true,
        message: `Client "${slug}" dan semua data terkait berhasil dihapus.`,
      });
    }

    // ─────────────────────────────────────────────────────────────────────
    // 10B. GET CLIENT MENU (categories + items) — Editor Panel
    // ─────────────────────────────────────────────────────────────────────
    if (action === "get_client_menu") {
      const slug = sanitizeSlug(clientSlug || "");
      if (!slug) {
        return NextResponse.json({ error: "Client Slug tidak valid." }, { status: 400 });
      }
      const [{ data: cats, error: cErr }, { data: items, error: iErr }] = await Promise.all([
        supabase
          .from("menu_categories")
          .select("id, key, label, sort_order")
          .eq("client_slug", slug)
          .order("sort_order", { ascending: true }),
        supabase
          .from("menu_items")
          .select("*")
          .eq("client_slug", slug)
          .order("is_featured", { ascending: false })
          .order("sort_order", { ascending: true, nullsFirst: false })
          .order("name", { ascending: true }),
      ]);
      if (cErr || iErr) {
        console.error("get_client_menu errors:", cErr?.message, iErr?.message);
        // Graceful — return empty jika tabel belum migrate
        return NextResponse.json({
          ok: true,
          categories: [],
          items: [],
          stats: { totalCategories: 0, totalItems: 0, activeItems: 0, featuredItems: 0 },
        });
      }
      const cc = cats || [];
      const ii = items || [];
      const stats = {
        totalCategories: cc.length,
        totalItems: ii.length,
        activeItems: ii.filter((x: any) => x.active).length,
        featuredItems: ii.filter((x: any) => x.is_featured).length,
      };
      return NextResponse.json({ ok: true, categories: cc, items: ii, stats });
    }

    // ─────────────────────────────────────────────────────────────────────
    // 10. CREATE MENU CATEGORY
    // ─────────────────────────────────────────────────────────────────────
    if (action === "create_menu_category") {
      const slug = sanitizeSlug(clientSlug || "");
      const key = String(categoryKey || "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 32);
      const label = String(categoryLabel || "").trim();
      const sortOrder = Number.isFinite(Number(categorySortOrder)) ? Number(categorySortOrder) : 0;
      if (!slug || !key || !label) {
        return NextResponse.json(
          { error: "Client slug, Key kategori, dan Label wajib diisi." },
          { status: 400 }
        );
      }
      const { data: row, error: insErr } = await supabase
        .from("menu_categories")
        .insert({ client_slug: slug, key, label, sort_order: sortOrder })
        .select("*")
        .maybeSingle();
      if (insErr) {
        if ((insErr as any)?.code === "23505") {
          return NextResponse.json(
            { error: `Kategori dengan key "${key}" sudah ada di client ini.` },
            { status: 409 }
          );
        }
        console.error("create_menu_category error:", insErr.message);
        return NextResponse.json({ error: "Gagal membuat kategori." }, { status: 500 });
      }
      return NextResponse.json({ ok: true, message: `Kategori "${label}" dibuat.`, category: row });
    }

    // ─────────────────────────────────────────────────────────────────────
    // 11. UPDATE MENU CATEGORY
    // ─────────────────────────────────────────────────────────────────────
    if (action === "update_menu_category") {
      const id = Number(categoryId);
      if (!Number.isFinite(id) || id <= 0) {
        return NextResponse.json({ error: "ID kategori tidak valid." }, { status: 400 });
      }
      const payload: any = {};
      if (categoryKey !== undefined) {
        const k = String(categoryKey).trim().toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 32);
        if (k) payload.key = k;
      }
      if (categoryLabel !== undefined) {
        const l = String(categoryLabel).trim();
        if (l) payload.label = l;
      }
      if (categorySortOrder !== undefined) {
        if (Number.isFinite(Number(categorySortOrder))) payload.sort_order = Number(categorySortOrder);
      }
      if (Object.keys(payload).length === 0) {
        return NextResponse.json({ error: "Tidak ada field untuk di-update." }, { status: 400 });
      }
      const { error } = await supabase.from("menu_categories").update(payload).eq("id", id);
      if (error) {
        if ((error as any)?.code === "23505") {
          return NextResponse.json(
            { error: `Key kategori "${payload.key}" bentrok dengan kategori lain.` },
            { status: 409 }
          );
        }
        console.error("update_menu_category error:", error.message);
        return NextResponse.json({ error: "Gagal update kategori." }, { status: 500 });
      }
      return NextResponse.json({ ok: true, message: "Kategori diperbarui." });
    }

    // ─────────────────────────────────────────────────────────────────────
    // 12. DELETE MENU CATEGORY (FK cascade ke menu_items)
    // ─────────────────────────────────────────────────────────────────────
    if (action === "delete_menu_category") {
      const id = Number(categoryId);
      if (!Number.isFinite(id) || id <= 0) {
        return NextResponse.json({ error: "ID kategori tidak valid." }, { status: 400 });
      }
      const { error } = await supabase.from("menu_categories").delete().eq("id", id);
      if (error) {
        console.error("delete_menu_category error:", error.message);
        return NextResponse.json({ error: "Gagal menghapus kategori." }, { status: 500 });
      }
      return NextResponse.json({
        ok: true,
        message: "Kategori dan semua item di dalamnya berhasil dihapus (cascade).",
      });
    }

    // ─────────────────────────────────────────────────────────────────────
    // 13. CREATE MENU ITEM
    // ─────────────────────────────────────────────────────────────────────
    if (action === "create_menu_item") {
      const slug = sanitizeSlug(clientSlug || "");
      const catKey = String(menuItemCategoryKey || "").trim();
      const name = String(menuItemName || "").trim();
      const priceLabel = String(menuItemPriceLabel || "").trim();
      if (!slug || !catKey || !name || !priceLabel) {
        return NextResponse.json(
          { error: "Client, Kategori, Nama, dan Harga wajib diisi." },
          { status: 400 }
        );
      }
      const payload: any = {
        client_slug: slug,
        category_key: catKey,
        name,
        price_label: priceLabel,
        active: menuItemIsActive !== false,
        is_featured: !!menuItemIsFeatured,
      };
      if (menuItemPriceNum !== undefined && menuItemPriceNum !== null) {
        const n = Number(menuItemPriceNum);
        payload.price_num = Number.isFinite(n) && n > 0 ? n : null;
      }
      if (menuItemDescription !== undefined) payload.description = menuItemDescription || null;
      if (menuItemImageUrl !== undefined) payload.image_url = menuItemImageUrl || null;
      if (menuItemBadge !== undefined) payload.badge = menuItemBadge || null;
      if (menuItemSortOrder !== undefined) {
        const s = Number(menuItemSortOrder);
        payload.sort_order = Number.isFinite(s) ? s : 0;
      }
      if (menuItemSearchKey !== undefined) payload.search_key = menuItemSearchKey || null;
      else payload.search_key = `${name} ${payload.description || ""} ${catKey}`.toLowerCase();

      const { data: row, error: insErr } = await supabase
        .from("menu_items")
        .insert(payload)
        .select("*")
        .maybeSingle();
      if (insErr) {
        if ((insErr as any)?.code === "23503") {
          return NextResponse.json(
            { error: `Kategori "${catKey}" belum dibuat di client "${slug}".` },
            { status: 400 }
          );
        }
        console.error("create_menu_item error:", insErr.message);
        return NextResponse.json({ error: "Gagal membuat menu item." }, { status: 500 });
      }
      return NextResponse.json({ ok: true, message: `Menu "${name}" dibuat.`, item: row });
    }

    // ─────────────────────────────────────────────────────────────────────
    // 14. UPDATE MENU ITEM
    // ─────────────────────────────────────────────────────────────────────
    if (action === "update_menu_item") {
      const id = Number(menuItemId);
      if (!Number.isFinite(id) || id <= 0) {
        return NextResponse.json({ error: "ID Menu Item tidak valid." }, { status: 400 });
      }
      const payload: any = {};
      if (menuItemCategoryKey !== undefined) {
        const k = String(menuItemCategoryKey).trim();
        if (k) payload.category_key = k;
      }
      if (menuItemName !== undefined) {
        const n = String(menuItemName).trim();
        if (n) payload.name = n;
      }
      if (menuItemPriceLabel !== undefined) {
        const p = String(menuItemPriceLabel).trim();
        if (p) payload.price_label = p;
      }
      if (menuItemPriceNum !== undefined) {
        const n = Number(menuItemPriceNum);
        payload.price_num = Number.isFinite(n) && n > 0 ? n : null;
      }
      if (menuItemDescription !== undefined) payload.description = menuItemDescription || null;
      if (menuItemImageUrl !== undefined) payload.image_url = menuItemImageUrl || null;
      if (menuItemBadge !== undefined) payload.badge = menuItemBadge || null;
      if (menuItemIsFeatured !== undefined) payload.is_featured = !!menuItemIsFeatured;
      if (menuItemIsActive !== undefined) payload.active = !!menuItemIsActive;
      if (menuItemSortOrder !== undefined) {
        const s = Number(menuItemSortOrder);
        payload.sort_order = Number.isFinite(s) ? s : 0;
      }
      if (menuItemSearchKey !== undefined) payload.search_key = menuItemSearchKey || null;

      if (Object.keys(payload).length === 0) {
        return NextResponse.json({ error: "Tidak ada field untuk di-update." }, { status: 400 });
      }
      const { error } = await supabase.from("menu_items").update(payload).eq("id", id);
      if (error) {
        if ((error as any)?.code === "23503") {
          return NextResponse.json(
            { error: `Kategori "${payload.category_key}" tidak ditemukan di client ini.` },
            { status: 400 }
          );
        }
        console.error("update_menu_item error:", error.message);
        return NextResponse.json({ error: "Gagal update menu item." }, { status: 500 });
      }
      return NextResponse.json({ ok: true, message: "Menu item diperbarui." });
    }

    // ─────────────────────────────────────────────────────────────────────
    // 15. DELETE MENU ITEM
    // ─────────────────────────────────────────────────────────────────────
    if (action === "delete_menu_item") {
      const id = Number(menuItemId);
      if (!Number.isFinite(id) || id <= 0) {
        return NextResponse.json({ error: "ID Menu Item tidak valid." }, { status: 400 });
      }
      const { error } = await supabase.from("menu_items").delete().eq("id", id);
      if (error) {
        console.error("delete_menu_item error:", error.message);
        return NextResponse.json({ error: "Gagal menghapus menu item." }, { status: 500 });
      }
      return NextResponse.json({ ok: true, message: "Menu item dihapus." });
    }

    // ─────────────────────────────────────────────────────────────────────
    // 16. IMPORT PRESET MENU TAMMMU (bulk insert categories + 30 items)
    // ─────────────────────────────────────────────────────────────────────
    if (action === "import_preset_menu_tammmu") {
      const slug = sanitizeSlug(clientSlug || "");
      if (!slug) {
        return NextResponse.json({ error: "Client Slug tidak valid." }, { status: 400 });
      }
      let catInserted = 0;
      let catSkipped = 0;
      for (const pc of TAMMMU_PRESET_CATEGORIES) {
        const { error: err } = await supabase
          .from("menu_categories")
          .insert({ client_slug: slug, key: pc.key, label: pc.label, sort_order: pc.sort_order });
        if (err) {
          if ((err as any)?.code === "23505") catSkipped++;
          else console.error("import preset category err:", err.message);
        } else catInserted++;
      }
      let itemInserted = 0;
      let itemSkipped = 0;
      for (const pi of TAMMMU_PRESET_ITEMS) {
        // Skip duplicate berdasarkan nama + category_key dalam client ini
        const { count, error: cntErr } = await supabase
          .from("menu_items")
          .select("*", { count: "exact", head: true })
          .eq("client_slug", slug)
          .eq("name", pi.name)
          .eq("category_key", pi.category_key);
        if (cntErr || (count ?? 0) > 0) {
          itemSkipped++;
          continue;
        }
        // Resolver aset legacy: path lokal /tammmu/* (folder public, sudah dimigrasi)
        // → URL Supabase Storage menu-assets/tammmu/menu/<nama-file>
        const resolvedImage = pi.image_url?.startsWith("/tammmu/")
          ? `${TAMMMU_ASSET_BASE}/${pi.image_url.split("/").pop()}`
          : pi.image_url;
        const payload: any = {
          client_slug: slug,
          category_key: pi.category_key,
          name: pi.name,
          price_label: pi.price_label,
          price_num: pi.price_num,
          description: pi.description,
          image_url: resolvedImage,
          badge: pi.badge,
          is_featured: pi.is_featured,
          sort_order: pi.sort_order,
          search_key: pi.search_key,
          active: true,
        };
        const { error: iErr } = await supabase.from("menu_items").insert(payload);
        if (iErr) {
          if ((iErr as any)?.code === "23503") {
            // Category missing (shouldn't happen)
            itemSkipped++;
          } else {
            console.error("import preset item err:", iErr.message);
            itemSkipped++;
          }
        } else itemInserted++;
      }
      return NextResponse.json({
        ok: true,
        message: `Import Tammmu Preset selesai. Kategori dibuat: ${catInserted}, skip: ${catSkipped}. Item dibuat: ${itemInserted}, skip: ${itemSkipped}.`,
        summary: { catInserted, catSkipped, itemInserted, itemSkipped },
      });
    }

    /* ─────────────────────────────────────────────────────────────────────
    12. CLIENT ACCESS MANAGEMENT (Portal /kelola — akun login client)
    ───────────────────────────────────────────────────────────────────── */
    if (action === "list_client_users") {
      const slug = sanitizeSlug(clientSlug || "");
      if (!slug) return NextResponse.json({ error: "Client Slug wajib." }, { status: 400 });
      const { data, error } = await supabase
        .from("client_users")
        .select("id, client_slug, email, is_active, last_login_at, created_at")
        .eq("client_slug", slug)
        .order("created_at", { ascending: true });
      if (error) {
        // Tabel belum ada (belum migrate) → return empty dengan flag
        if (error.message.includes("does not exist") || (error as any)?.code === "42P01") {
          return NextResponse.json({ ok: true, users: [], migrated: false });
        }
        console.error("list client users err:", error.message);
        return NextResponse.json({ error: "Gagal memuat daftar akun." }, { status: 500 });
      }
      return NextResponse.json({ ok: true, users: data || [], migrated: true });
    }

    if (action === "create_client_user") {
      const slug = sanitizeSlug(clientSlug || "");
      const email = String(body?.clientUserEmail || "").trim().toLowerCase();
      const password = String(body?.clientUserPassword || "");
      if (!slug || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return NextResponse.json({ error: "Email tidak valid." }, { status: 400 });
      }
      if (password.length < 6) {
        return NextResponse.json({ error: "Password minimal 6 karakter." }, { status: 400 });
      }
      const passwordHash = await hashPassword(password);
      const { error } = await supabase.from("client_users").insert({
        client_slug: slug,
        email,
        password_hash: passwordHash,
        is_active: true,
      });
      if (error) {
        if ((error as any)?.code === "23505")
          return NextResponse.json({ error: `Email ${email} sudah terdaftar untuk client ini.` }, { status: 409 });
        if (error.message.includes("does not exist") || (error as any)?.code === "42P01")
          return NextResponse.json(
            { error: "Tabel client_users belum ada. Jalankan SQL migration terbaru." },
            { status: 400 }
          );
        throw new Error(error.message);
      }
      return NextResponse.json({ ok: true, message: `Akun ${email} dibuat.` });
    }

    if (action === "reset_client_user_password") {
      const id = Number(body?.clientUserId);
      const password = String(body?.clientUserPassword || "");
      if (!Number.isFinite(id) || id <= 0)
        return NextResponse.json({ error: "ID akun tidak valid." }, { status: 400 });
      if (password.length < 6)
        return NextResponse.json({ error: "Password minimal 6 karakter." }, { status: 400 });
      const passwordHash = await hashPassword(password);
      const { error } = await supabase.from("client_users").update({ password_hash: passwordHash }).eq("id", id);
      if (error) throw new Error(error.message);
      return NextResponse.json({ ok: true, message: "Password direset." });
    }

    if (action === "delete_client_user") {
      const id = Number(body?.clientUserId);
      if (!Number.isFinite(id) || id <= 0)
        return NextResponse.json({ error: "ID akun tidak valid." }, { status: 400 });
      const { error } = await supabase.from("client_users").delete().eq("id", id);
      if (error) throw new Error(error.message);
      return NextResponse.json({ ok: true, message: "Akun dihapus." });
    }

    return NextResponse.json({ error: "Aksi tidak valid." }, { status: 400 });
  } catch (err) {
    console.error("admin/action error:", err);
    return NextResponse.json({ error: "Terjadi kesalahan server." }, { status: 500 });
  }
}
