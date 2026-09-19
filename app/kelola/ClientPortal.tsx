"use client";

import { useCallback, useEffect, useState } from "react";

/* ─────────────────────────────────────────────
   Types (mirror response /api/client/me)
   ───────────────────────────────────────────── */
type ClientData = {
  slug: string;
  business_name: string;
  status: string;
  template_key: string;
  logo_url: string | null;
  cover_mobile_url: string | null;
  tagline: string | null;
  operating_hours: string | null;
  wifi_ssid: string | null;
  wifi_password: string | null;
  google_place_id: string | null;
  google_review_url: string | null;
  theme_accent: string | null;
  theme_bg: string | null;
  address: string | null;
  instagram_url: string | null;
  whatsapp_url: string | null;
};

type CategoryRow = { id: number; client_slug: string; key: string; label: string; sort_order: number };
type ItemRow = {
  id: number;
  client_slug: string;
  category_key: string;
  name: string;
  price_label: string | null;
  price_num: number | null;
  description: string | null;
  image_url: string | null;
  badge: string | null;
  is_featured: boolean;
  active: boolean;
  sort_order: number;
  search_key: string | null;
};

type Stats = { totalCategories: number; totalItems: number; activeItems: number; featuredItems: number };

const emptyCategoryForm = { key: "", label: "", sort_order: "" };
const emptyItemForm = {
  name: "",
  category_key: "",
  price_label: "",
  price_num: "",
  description: "",
  image_url: "",
  badge: "",
  is_featured: false,
  active: true,
  sort_order: "",
  search_key: "",
};
type CategoryForm = typeof emptyCategoryForm;
type ItemForm = typeof emptyItemForm;

/* Compress client-side sebelum upload (hemat storage + loading cepat) */
async function compressImageFile(file: File, maxDim: number): Promise<File> {
  if (file.type === "image/gif" || file.size < 150 * 1024) return file;
  try {
    const img = document.createElement("img");
    const objUrl = URL.createObjectURL(file);
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("decode"));
      img.src = objUrl;
    });
    URL.revokeObjectURL(objUrl);
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    if (scale >= 1 && file.size < 400 * 1024) return file;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const isPng = file.type === "image/png";
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, isPng ? "image/png" : "image/jpeg", 0.85)
    );
    if (!blob) return file;
    const baseName = file.name.replace(/\.[^.]+$/, "").slice(0, 40) || "image";
    return new File([blob], `${baseName}.${isPng ? "png" : "jpg"}`, {
      type: isPng ? "image/png" : "image/jpeg",
    });
  } catch {
    return file;
  }
}

export default function ClientPortal() {
  /* ── State ── */
  const [email, setEmail] = useState("");
  const [client, setClient] = useState<ClientData | null>(null);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [stats, setStats] = useState<Stats>({ totalCategories: 0, totalItems: 0, activeItems: 0, featuredItems: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);
  const [tab, setTab] = useState<"menu" | "settings">("menu");

  const [search, setSearch] = useState("");
  const [activeCat, setActiveCat] = useState<string>("all");

  const [catModal, setCatModal] = useState<{ mode: "create" | "edit"; category?: CategoryRow } | null>(null);
  const [catForm, setCatForm] = useState<CategoryForm>(emptyCategoryForm);
  const [itemModal, setItemModal] = useState<{ mode: "create" | "edit"; item?: ItemRow } | null>(null);
  const [itemForm, setItemForm] = useState<ItemForm>(emptyItemForm);
  const [uploadTarget, setUploadTarget] = useState<string | null>(null);
  const [profileForm, setProfileForm] = useState({
    wifi_ssid: "",
    wifi_password: "",
    operating_hours: "",
    tagline: "",
    logo_url: "",
    cover_mobile_url: "",
  });

  /* ── Helpers ── */
  const showToast = (kind: "ok" | "err", msg: string) => {
    setToast({ kind, msg });
    setTimeout(() => setToast(null), 3500);
  };

  const loadAll = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/client/me", { cache: "no-store" });
      if (res.status === 401) {
        window.location.href = "/kelola";
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Gagal memuat data.");
      setEmail(data.email || "");
      setClient(data.client);
      setCategories(data.categories || []);
      setItems(data.items || []);
      setStats(data.stats || stats);
      setProfileForm({
        wifi_ssid: data.client?.wifi_ssid || "",
        wifi_password: data.client?.wifi_password || "",
        operating_hours: data.client?.operating_hours || "",
        tagline: data.client?.tagline || "",
        logo_url: data.client?.logo_url || "",
        cover_mobile_url: data.client?.cover_mobile_url || "",
      });
    } catch (err) {
      showToast("err", err instanceof Error ? err.message : "Gagal memuat data.");
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  async function callAction(payload: Record<string, unknown>): Promise<boolean> {
    setIsSaving(true);
    try {
      const res = await fetch("/api/client/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Aksi gagal.");
      showToast("ok", data?.message || "Berhasil.");
      return true;
    } catch (err) {
      showToast("err", err instanceof Error ? err.message : "Aksi gagal.");
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/client/logout", { method: "POST" });
    window.location.href = "/kelola";
  }

  /* ── Modal sync ── */
  useEffect(() => {
    if (catModal?.mode === "edit" && catModal.category) {
      setCatForm({ key: catModal.category.key, label: catModal.category.label, sort_order: String(catModal.category.sort_order ?? 0) });
    } else if (catModal?.mode === "create") {
      setCatForm(emptyCategoryForm);
    }
  }, [catModal]);

  useEffect(() => {
    if (itemModal?.mode === "edit" && itemModal.item) {
      const it = itemModal.item;
      setItemForm({
        name: it.name,
        category_key: it.category_key,
        price_label: it.price_label || "",
        price_num: it.price_num != null ? String(it.price_num) : "",
        description: it.description || "",
        image_url: it.image_url || "",
        badge: it.badge || "",
        is_featured: !!it.is_featured,
        active: !!it.active,
        sort_order: String(it.sort_order ?? 0),
        search_key: it.search_key || "",
      });
    } else if (itemModal?.mode === "create") {
      setItemForm({ ...emptyItemForm, category_key: activeCat !== "all" ? activeCat : "" });
    }
  }, [itemModal]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Handlers ── */
  async function handleCatSubmit() {
    if (!catModal) return;
    if (!catForm.label.trim()) return showToast("err", "Nama kategori wajib diisi.");
    const ok = await callAction({
      action: catModal.mode === "create" ? "create_menu_category" : "update_menu_category",
      categoryId: catModal.category?.id,
      categoryKey: catForm.key,
      categoryLabel: catForm.label.trim(),
      categorySortOrder: catForm.sort_order,
    });
    if (ok) {
      setCatModal(null);
      await loadAll();
    }
  }

  async function handleCatDelete(cat: CategoryRow) {
    const count = items.filter((i) => i.category_key === cat.key).length;
    const msg =
      count > 0
        ? `Hapus kategori "${cat.label}"?\n\n${count} menu di dalamnya akan ikut TERHAPUS permanen!`
        : `Hapus kategori "${cat.label}"?`;
    if (!window.confirm(msg)) return;
    const ok = await callAction({ action: "delete_menu_category", categoryId: cat.id });
    if (ok) {
      if (activeCat === cat.key) setActiveCat("all");
      await loadAll();
    }
  }

  async function handleItemSubmit() {
    if (!itemModal) return;
    if (!itemForm.name.trim()) return showToast("err", "Nama menu wajib diisi.");
    if (!itemForm.category_key) return showToast("err", "Pilih kategori dulu.");
    if (!itemForm.price_label.trim()) return showToast("err", "Harga (label) wajib diisi. Contoh: 28K");
    const ok = await callAction({
      action: itemModal.mode === "create" ? "create_menu_item" : "update_menu_item",
      menuItemId: itemModal.item?.id,
      menuItemName: itemForm.name.trim(),
      menuItemCategoryKey: itemForm.category_key,
      menuItemPriceLabel: itemForm.price_label.trim(),
      menuItemPriceNum: itemForm.price_num,
      menuItemDescription: itemForm.description.trim() || null,
      menuItemImageUrl: itemForm.image_url.trim() || null,
      menuItemBadge: itemForm.badge.trim() || null,
      menuItemIsFeatured: itemForm.is_featured,
      menuItemIsActive: itemForm.active,
      menuItemSortOrder: itemForm.sort_order,
      menuItemSearchKey: itemForm.search_key.trim() || null,
    });
    if (ok) {
      setItemModal(null);
      await loadAll();
    }
  }

  async function handleItemDelete(item: ItemRow) {
    if (!window.confirm(`Hapus menu "${item.name}"?`)) return;
    const ok = await callAction({ action: "delete_menu_item", menuItemId: item.id });
    if (ok) await loadAll();
  }

  async function handleUpload(file: File, scope: string, setUrl: (v: string) => void) {
    if (!file.type.startsWith("image/")) return showToast("err", "File harus gambar.");
    setUploadTarget(scope);
    try {
      const maxDim = scope === "client_logo" ? 800 : scope === "client_cover" ? 1600 : 1200;
      const processed = await compressImageFile(file, maxDim);
      const fd = new FormData();
      fd.append("file", processed);
      fd.append("scope", scope);
      const res = await fetch("/api/client/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setUrl(data.url);
      showToast("ok", "Foto terupload.");
    } catch (err) {
      showToast("err", err instanceof Error ? err.message : "Upload gagal.");
    } finally {
      setUploadTarget(null);
    }
  }

  async function handleProfileSave() {
    const ok = await callAction({
      action: "update_profile",
      wifiSsid: profileForm.wifi_ssid.trim() || null,
      wifiPassword: profileForm.wifi_password.trim() || null,
      operatingHours: profileForm.operating_hours.trim() || null,
      tagline: profileForm.tagline.trim() || null,
      logoUrl: profileForm.logo_url.trim() || null,
      coverMobileUrl: profileForm.cover_mobile_url.trim() || null,
    });
    if (ok) await loadAll();
  }

  /* ── Reusable upload field ── */
  const uploadField = (cfg: {
    scope: string;
    url: string;
    setUrl: (v: string) => void;
    label: string;
    hint?: string;
  }) => {
    const busy = uploadTarget === cfg.scope;
    return (
      <div
        className="space-y-2"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files?.[0];
          if (f && !busy) handleUpload(f, cfg.scope, cfg.setUrl);
        }}
      >
        <label className="block text-xs font-bold text-[#5C564A] mb-1">{cfg.label}</label>
        <div className="flex items-stretch gap-3">
          <div className="w-20 h-20 rounded-xl border-2 border-dashed border-[#E8E3DA] bg-[#FAF8F5] overflow-hidden flex items-center justify-center shrink-0">
            {cfg.url ? (
              <img src={cfg.url} alt="preview" className="w-full h-full object-cover" />
            ) : (
              <span className="material-symbols-outlined text-[#B5AFA3]">image</span>
            )}
          </div>
          <label
            className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 rounded-xl border-2 border-dashed transition-colors ${
              busy ? "border-[#3C3833] bg-[#3C3833]/5 pointer-events-none" : "border-[#E8E3DA] hover:border-[#3C3833] cursor-pointer"
            }`}
          >
            {busy ? (
              <>
                <span className="material-symbols-outlined text-[#3C3833] animate-spin">progress_activity</span>
                <span className="text-xs font-bold text-[#3C3833]">Mengupload...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[#3C3833]">upload_file</span>
                <span className="text-xs font-bold text-[#3C3833]">📤 Klik / drag foto</span>
                <span className="text-[10px] text-[#8E897C]">JPG · PNG · WEBP · maks 5MB</span>
              </>
            )}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={busy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) handleUpload(f, cfg.scope, cfg.setUrl);
              }}
            />
          </label>
        </div>
        {cfg.url && (
          <button
            type="button"
            onClick={() => cfg.setUrl("")}
            className="text-[10px] font-bold text-red-500 hover:text-red-600 cursor-pointer"
          >
            Hapus foto
          </button>
        )}
        {cfg.hint && <p className="text-[10px] text-[#8E897C] leading-relaxed">{cfg.hint}</p>}
      </div>
    );
  };

  /* ── Loading screen ── */
  if (isLoading && !client) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center">
        <div className="text-center">
          <span className="material-symbols-outlined text-4xl text-[#B5AFA3] animate-spin inline-block">progress_activity</span>
          <p className="text-sm text-[#8E897C] mt-3">Memuat portal Anda...</p>
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-sm text-[#8E897C]">Data bisnis tidak ditemukan.</p>
          <button onClick={handleLogout} className="mt-4 text-xs font-bold text-red-500 cursor-pointer">
            Logout
          </button>
        </div>
      </div>
    );
  }

  const liveUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/${client.slug}/01`;
  const filteredItems = items.filter((it) => {
    const matchCat = activeCat === "all" || it.category_key === activeCat;
    const q = search.trim().toLowerCase();
    const matchSearch =
      !q ||
      it.name.toLowerCase().includes(q) ||
      (it.description || "").toLowerCase().includes(q) ||
      (it.search_key || "").toLowerCase().includes(q);
    return matchCat && matchSearch;
  });

  return (
    <div className="min-h-screen bg-[#FAF8F5] pb-16">
      {/* ═══ HEADER ═══ */}
      <header className="bg-white border-b border-[#E8E3DA] sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#FAF8F5] border border-[#E8E3DA] overflow-hidden flex items-center justify-center shrink-0">
              {client.logo_url ? (
                <img src={client.logo_url} alt="logo" className="w-full h-full object-contain" />
              ) : (
                <span className="material-symbols-outlined text-[#8E897C]">storefront</span>
              )}
            </div>
            <div className="min-w-0">
              <p className="font-bold text-sm text-[#3C3833] truncate">{client.business_name}</p>
              <p className="text-[10px] text-[#8E897C] truncate">{email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <a
              href={liveUrl}
              target="_blank"
              rel="noreferrer"
              className="hidden sm:flex items-center gap-1 py-2 px-3 rounded-xl bg-[#EFF6FF] text-[#1E40AF] border border-[#BFDBFE] text-[11px] font-bold hover:bg-[#DBEAFE]"
            >
              <span className="material-symbols-outlined text-[14px]">open_in_new</span>
              Lihat Halaman
            </a>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1 py-2 px-3 rounded-xl bg-[#FAF8F5] text-[#8E897C] border border-[#E8E3DA] text-[11px] font-bold hover:bg-red-50 hover:text-red-500 hover:border-red-100 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[14px]">logout</span>
              Keluar
            </button>
          </div>
        </div>
        {/* Tabs */}
        <div className="max-w-6xl mx-auto px-4 pb-2 flex gap-2">
          <button
            onClick={() => setTab("menu")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              tab === "menu" ? "bg-[#3C3833] text-white" : "bg-[#FAF8F5] text-[#5C564A] border border-[#E8E3DA]"
            }`}
          >
            🍽️ Kelola Menu
          </button>
          <button
            onClick={() => setTab("settings")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              tab === "settings" ? "bg-[#3C3833] text-white" : "bg-[#FAF8F5] text-[#5C564A] border border-[#E8E3DA]"
            }`}
          >
            ⚙️ Pengaturan
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-5">
        {/* ═══ TAB: MENU ═══ */}
        {tab === "menu" && (
          <>
            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white border border-[#E8E3DA] rounded-xl p-4">
                <p className="text-[10px] uppercase text-[#8E897C] font-bold mb-1">Kategori</p>
                <p className="text-xl font-bold text-[#3C3833]">{stats.totalCategories}</p>
              </div>
              <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-xl p-4">
                <p className="text-[10px] uppercase text-[#166534] font-bold mb-1">Menu</p>
                <p className="text-xl font-bold text-[#166534]">{stats.totalItems}</p>
              </div>
              <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-xl p-4">
                <p className="text-[10px] uppercase text-[#1E40AF] font-bold mb-1">Aktif</p>
                <p className="text-xl font-bold text-[#1E40AF]">{stats.activeItems}</p>
              </div>
              <div className="bg-[#FFF7ED] border border-[#FED7AA] rounded-xl p-4">
                <p className="text-[10px] uppercase text-[#C2410C] font-bold mb-1">⭐ Featured</p>
                <p className="text-xl font-bold text-[#C2410C]">{stats.featuredItems}</p>
              </div>
            </div>

            {/* Action bar */}
            <div className="flex flex-col sm:flex-row gap-3 bg-white border border-[#E8E3DA] rounded-xl p-4">
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setCatModal({ mode: "create" })}
                  className="bg-[#FAF8F5] text-[#3C3833] border border-[#E8E3DA] hover:bg-[#F0EBE3] font-bold text-xs py-2.5 px-4 rounded-xl cursor-pointer"
                >
                  ➕ Kategori
                </button>
                <button
                  onClick={() => setItemModal({ mode: "create" })}
                  disabled={categories.length === 0}
                  className="bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 font-bold text-xs py-2.5 px-4 rounded-xl disabled:opacity-50 cursor-pointer"
                  title={categories.length === 0 ? "Buat kategori dulu" : ""}
                >
                  ➕ Menu Item
                </button>
              </div>
              <div className="relative sm:ml-auto sm:max-w-xs w-full">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#B5AFA3] text-[18px]">search</span>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cari menu..."
                  className="w-full bg-[#FAF8F5] border border-[#E8E3DA] rounded-xl pl-10 pr-4 py-2.5 text-xs font-bold text-[#3C3833] placeholder:text-[#B5AFA3] focus:outline-none focus:border-[#3C3833]"
                />
              </div>
            </div>

            {/* 2 col: kategori + items */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Kategori */}
              <div className="lg:col-span-4 xl:col-span-3">
                <div className="bg-white border border-[#E8E3DA] rounded-2xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-[#E8E3DA] flex items-center justify-between">
                    <h3 className="font-bold text-sm text-[#3C3833]">Kategori</h3>
                    <button
                      onClick={() => setCatModal({ mode: "create" })}
                      className="p-1.5 rounded-lg bg-[#FAF8F5] hover:bg-[#F0EBE3] cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px] text-[#3C3833]">add</span>
                    </button>
                  </div>
                  {categories.length === 0 ? (
                    <div className="px-4 py-10 text-center">
                      <p className="text-xs text-[#8E897C]">Belum ada kategori.<br />Klik ➕ untuk membuat.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-[#F0EBE3] max-h-[60vh] overflow-y-auto">
                      {categories.map((cat) => {
                        const n = items.filter((i) => i.category_key === cat.key).length;
                        return (
                          <div
                            key={cat.id}
                            className={`group px-4 py-3 flex items-center justify-between gap-2 cursor-pointer ${
                              activeCat === cat.key ? "bg-[#FAF8F5]" : "hover:bg-[#FAF8F5]/60"
                            }`}
                            onClick={() => setActiveCat(cat.key)}
                          >
                            <div className="min-w-0">
                              <p className="font-bold text-sm text-[#3C3833] truncate">{cat.label}</p>
                              <p className="text-[10px] text-[#8E897C]">{n} menu</p>
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={(e) => { e.stopPropagation(); setCatModal({ mode: "edit", category: cat }); }}
                                className="p-1.5 rounded-lg bg-[#FAF8F5] hover:bg-[#F0EBE3] cursor-pointer"
                              >
                                <span className="material-symbols-outlined text-[14px] text-[#5C564A]">edit</span>
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleCatDelete(cat); }}
                                className="p-1.5 rounded-lg bg-[#FAF8F5] hover:bg-red-50 cursor-pointer"
                              >
                                <span className="material-symbols-outlined text-[14px] text-red-500">delete</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Items */}
              <div className="lg:col-span-8 xl:col-span-9 space-y-3">
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  <button
                    onClick={() => setActiveCat("all")}
                    className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer ${
                      activeCat === "all" ? "bg-[#3C3833] text-white" : "bg-white text-[#3C3833] border border-[#E8E3DA]"
                    }`}
                  >
                    Semua ({items.length})
                  </button>
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setActiveCat(cat.key)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer ${
                        activeCat === cat.key ? "bg-[#3C3833] text-white" : "bg-white text-[#3C3833] border border-[#E8E3DA]"
                      }`}
                    >
                      {cat.label} ({items.filter((i) => i.category_key === cat.key).length})
                    </button>
                  ))}
                </div>

                {filteredItems.length === 0 ? (
                  <div className="bg-white border-2 border-dashed border-[#E8E3DA] rounded-2xl p-10 text-center">
                    <p className="font-bold text-[#3C3833]">{items.length === 0 ? "Belum ada menu" : "Tidak ada hasil"}</p>
                    <p className="text-xs text-[#8E897C] mt-1">
                      {items.length === 0 ? "Klik ➕ Menu Item untuk menambah menu pertama Anda." : "Coba kata kunci lain."}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {filteredItems
                      .slice()
                      .sort((a, b) => {
                        if (!!b.is_featured !== !!a.is_featured) return (b.is_featured ? 1 : 0) - (a.is_featured ? 1 : 0);
                        return (a.sort_order ?? 999) - (b.sort_order ?? 999);
                      })
                      .map((item) => {
                        const catLabel = categories.find((c) => c.key === item.category_key)?.label || item.category_key;
                        return (
                          <div
                            key={item.id}
                            className={`group bg-white border rounded-2xl p-4 flex gap-3 hover:border-[#3C3833]/30 transition-all ${
                              !item.active ? "border-red-100 bg-red-50/40 opacity-75" : "border-[#E8E3DA]"
                            }`}
                          >
                            <div className="w-20 h-20 shrink-0 rounded-xl bg-[#FAF8F5] border border-[#E8E3DA] overflow-hidden flex items-center justify-center">
                              {item.image_url ? (
                                <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" loading="lazy" />
                              ) : (
                                <span className="material-symbols-outlined text-[#B5AFA3]">restaurant</span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <h4 className="font-bold text-sm text-[#3C3833] truncate">{item.name}</h4>
                                    {item.is_featured && (
                                      <span className="px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[9px] font-bold">⭐ FEATURED</span>
                                    )}
                                    {item.badge && (
                                      <span className="px-1.5 py-0.5 rounded-full bg-[#F0EBE3] text-[#5C564A] text-[9px] font-bold">{item.badge}</span>
                                    )}
                                    {!item.active && (
                                      <span className="px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 text-[9px] font-bold">NON-AKTIF</span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                    <span className="px-2 py-0.5 rounded-md bg-[#FAF8F5] text-[#5C564A] text-[10px] font-bold">{catLabel}</span>
                                    <span className="text-[#3C3833] font-bold text-sm font-mono">{item.price_label}</span>
                                  </div>
                                  {item.description && (
                                    <p className="text-[11px] text-[#8E897C] mt-1 line-clamp-1">{item.description}</p>
                                  )}
                                </div>
                                <div className="flex flex-col gap-1 shrink-0 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                  <button
                                    onClick={() => setItemModal({ mode: "edit", item })}
                                    className="p-1.5 rounded-lg bg-[#FAF8F5] hover:bg-[#F0EBE3] cursor-pointer"
                                  >
                                    <span className="material-symbols-outlined text-[14px] text-[#5C564A]">edit</span>
                                  </button>
                                  <button
                                    onClick={() => handleItemDelete(item)}
                                    className="p-1.5 rounded-lg bg-[#FAF8F5] hover:bg-red-50 cursor-pointer"
                                  >
                                    <span className="material-symbols-outlined text-[14px] text-red-500">delete</span>
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* ═══ TAB: SETTINGS ═══ */}
        {tab === "settings" && (
          <div className="max-w-2xl space-y-5">
            <div className="bg-white border border-[#E8E3DA] rounded-2xl p-6 space-y-5">
              <h3 className="font-bold text-[#3C3833]">Informasi Tamu</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#5C564A] mb-1.5">Nama WiFi (SSID)</label>
                  <input
                    value={profileForm.wifi_ssid}
                    onChange={(e) => setProfileForm({ ...profileForm, wifi_ssid: e.target.value })}
                    placeholder="Tammmu_Guest"
                    className="w-full bg-[#FAF8F5] border border-[#E8E3DA] rounded-xl px-4 py-2.5 text-sm font-bold text-[#3C3833] focus:outline-none focus:border-[#3C3833]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#5C564A] mb-1.5">Password WiFi</label>
                  <input
                    value={profileForm.wifi_password}
                    onChange={(e) => setProfileForm({ ...profileForm, wifi_password: e.target.value })}
                    placeholder="password wifi tamu"
                    className="w-full bg-[#FAF8F5] border border-[#E8E3DA] rounded-xl px-4 py-2.5 text-sm font-bold text-[#3C3833] focus:outline-none focus:border-[#3C3833]"
                  />
                  <p className="text-[10px] text-[#8E897C] mt-1">Tamu bisa copy password 1 klik dari halaman menu.</p>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-[#5C564A] mb-1.5">Jam Operasional</label>
                  <input
                    value={profileForm.operating_hours}
                    onChange={(e) => setProfileForm({ ...profileForm, operating_hours: e.target.value })}
                    placeholder="Senin - Minggu · 08:00 - 22:00"
                    className="w-full bg-[#FAF8F5] border border-[#E8E3DA] rounded-xl px-4 py-2.5 text-sm font-bold text-[#3C3833] focus:outline-none focus:border-[#3C3833]"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-[#5C564A] mb-1.5">Tagline</label>
                  <input
                    value={profileForm.tagline}
                    onChange={(e) => setProfileForm({ ...profileForm, tagline: e.target.value })}
                    placeholder="ONE MORE, PLEASE."
                    className="w-full bg-[#FAF8F5] border border-[#E8E3DA] rounded-xl px-4 py-2.5 text-sm font-bold text-[#3C3833] focus:outline-none focus:border-[#3C3833]"
                  />
                </div>
              </div>
            </div>

            <div className="bg-white border border-[#E8E3DA] rounded-2xl p-6 space-y-5">
              <h3 className="font-bold text-[#3C3833]">Branding</h3>
              {uploadField({
                scope: "client_logo",
                url: profileForm.logo_url,
                setUrl: (v) => setProfileForm({ ...profileForm, logo_url: v }),
                label: "Logo",
                hint: "Disarankan PNG transparan, minimal 512x512px.",
              })}
              {uploadField({
                scope: "client_cover",
                url: profileForm.cover_mobile_url,
                setUrl: (v) => setProfileForm({ ...profileForm, cover_mobile_url: v }),
                label: "Cover Mobile (banner atas halaman)",
                hint: "Rekomendasi portrait 9:16.",
              })}
            </div>

            <button
              onClick={handleProfileSave}
              disabled={isSaving}
              className="w-full bg-[#3C3833] text-white font-bold text-sm py-3.5 rounded-xl hover:bg-black transition-colors disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer"
            >
              {isSaving ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>
                  <span>Menyimpan...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[16px]">save</span>
                  <span>Simpan Pengaturan</span>
                </>
              )}
            </button>
            <p className="text-center text-[10px] text-[#8E897C]">
              Perubahan langsung tampil di halaman menu Anda — tanpa perlu approval.
            </p>
          </div>
        )}
      </main>

      {/* ═══ MODAL KATEGORI ═══ */}
      {catModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full border border-[#E8E3DA] shadow-2xl overflow-hidden">
            <div className="px-6 py-5 border-b border-[#E8E3DA]">
              <h3 className="font-bold text-lg text-[#3C3833]">
                {catModal.mode === "create" ? "Kategori Baru" : "Edit Kategori"}
              </h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#5C564A] mb-1.5">Nama Kategori *</label>
                <input
                  value={catForm.label}
                  onChange={(e) => setCatForm({ ...catForm, label: e.target.value })}
                  placeholder="contoh: Minuman Dingin"
                  className="w-full bg-[#FAF8F5] border border-[#E8E3DA] rounded-xl px-4 py-2.5 text-sm font-bold text-[#3C3833] focus:outline-none focus:border-[#3C3833]"
                />
              </div>
              {catModal.mode === "create" && (
                <div>
                  <label className="block text-xs font-bold text-[#5C564A] mb-1.5">Key (otomatis dari nama)</label>
                  <input
                    value={catForm.key}
                    onChange={(e) => setCatForm({ ...catForm, key: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 30) })}
                    placeholder="minuman_dingin"
                    className="w-full bg-[#FAF8F5] border border-[#E8E3DA] rounded-xl px-4 py-2.5 text-sm font-mono text-[#3C3833] focus:outline-none focus:border-[#3C3833]"
                    onBlur={() => {
                      if (!catForm.key && catForm.label)
                        setCatForm({ ...catForm, key: catForm.label.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_-]/g, "").slice(0, 30) });
                    }}
                  />
                </div>
              )}
              <div>
                <label className="block text-xs font-bold text-[#5C564A] mb-1.5">Urutan</label>
                <input
                  type="number"
                  value={catForm.sort_order}
                  onChange={(e) => setCatForm({ ...catForm, sort_order: e.target.value })}
                  className="w-full bg-[#FAF8F5] border border-[#E8E3DA] rounded-xl px-4 py-2.5 text-sm font-bold text-[#3C3833] focus:outline-none focus:border-[#3C3833]"
                />
              </div>
            </div>
            <div className="p-6 pt-4 border-t border-[#E8E3DA] flex justify-end gap-3">
              <button
                onClick={() => setCatModal(null)}
                className="px-5 py-2.5 border border-[#E8E3DA] rounded-xl text-sm font-bold text-[#5C564A] hover:bg-[#FAF8F5] cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleCatSubmit}
                disabled={isSaving}
                className="px-6 py-2.5 bg-[#3C3833] text-white rounded-xl text-sm font-bold hover:bg-black disabled:opacity-60 cursor-pointer"
              >
                {isSaving ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODAL MENU ITEM ═══ */}
      {itemModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-start sm:items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full border border-[#E8E3DA] shadow-2xl overflow-hidden my-6">
            <div className="px-6 py-5 border-b border-[#E8E3DA]">
              <h3 className="font-bold text-lg text-[#3C3833]">
                {itemModal.mode === "create" ? "Tambah Menu" : "Edit Menu"}
              </h3>
            </div>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-[#5C564A] mb-1.5">Nama Menu *</label>
                  <input
                    value={itemForm.name}
                    onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                    placeholder="contoh: Es Kopi Susu"
                    className="w-full bg-[#FAF8F5] border border-[#E8E3DA] rounded-xl px-4 py-2.5 text-sm font-bold text-[#3C3833] focus:outline-none focus:border-[#3C3833]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#5C564A] mb-1.5">Kategori *</label>
                  <select
                    value={itemForm.category_key}
                    onChange={(e) => setItemForm({ ...itemForm, category_key: e.target.value })}
                    className="w-full bg-[#FAF8F5] border border-[#E8E3DA] rounded-xl px-4 py-2.5 text-sm font-bold text-[#3C3833] focus:outline-none focus:border-[#3C3833]"
                  >
                    <option value="">-- Pilih --</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.key}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#5C564A] mb-1.5">Harga Label *</label>
                  <input
                    value={itemForm.price_label}
                    onChange={(e) => setItemForm({ ...itemForm, price_label: e.target.value })}
                    placeholder="28K / Rp 25.000"
                    className="w-full bg-[#FAF8F5] border border-[#E8E3DA] rounded-xl px-4 py-2.5 text-sm font-mono font-bold text-[#3C3833] focus:outline-none focus:border-[#3C3833]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#5C564A] mb-1.5">Harga Angka (opsional)</label>
                  <input
                    value={itemForm.price_num}
                    onChange={(e) => setItemForm({ ...itemForm, price_num: e.target.value.replace(/[^0-9]/g, "") })}
                    placeholder="28000"
                    className="w-full bg-[#FAF8F5] border border-[#E8E3DA] rounded-xl px-4 py-2.5 text-sm font-mono font-bold text-[#3C3833] focus:outline-none focus:border-[#3C3833]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#5C564A] mb-1.5">Badge (opsional)</label>
                  <input
                    value={itemForm.badge}
                    onChange={(e) => setItemForm({ ...itemForm, badge: e.target.value })}
                    placeholder="Bestseller / New"
                    className="w-full bg-[#FAF8F5] border border-[#E8E3DA] rounded-xl px-4 py-2.5 text-sm font-bold text-[#3C3833] focus:outline-none focus:border-[#3C3833]"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-[#5C564A] mb-1.5">Deskripsi</label>
                  <textarea
                    value={itemForm.description}
                    onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })}
                    rows={2}
                    placeholder="Komposisi / catatan singkat"
                    className="w-full bg-[#FAF8F5] border border-[#E8E3DA] rounded-xl px-4 py-2.5 text-sm font-bold text-[#3C3833] focus:outline-none focus:border-[#3C3833] resize-none"
                  />
                </div>
                <div className="sm:col-span-2">
                  {uploadField({
                    scope: "menu_item",
                    url: itemForm.image_url,
                    setUrl: (v) => setItemForm({ ...itemForm, image_url: v }),
                    label: "Foto Menu",
                    hint: "Rasio 1:1 (persegi) paling bagus. ⭐ Featured = tampil besar dengan foto.",
                  })}
                </div>
                <div className="sm:col-span-2 grid grid-cols-2 gap-3">
                  <label className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer ${itemForm.is_featured ? "border-amber-400 bg-amber-50/50" : "border-[#E8E3DA]"}`}>
                    <input
                      type="checkbox"
                      checked={itemForm.is_featured}
                      onChange={(e) => setItemForm({ ...itemForm, is_featured: e.target.checked })}
                      className="w-5 h-5 accent-amber-500"
                    />
                    <span className="text-xs font-bold text-[#3C3833]">⭐ Featured (grid foto besar)</span>
                  </label>
                  <label className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer ${itemForm.active ? "border-emerald-400 bg-emerald-50/50" : "border-[#E8E3DA]"}`}>
                    <input
                      type="checkbox"
                      checked={itemForm.active}
                      onChange={(e) => setItemForm({ ...itemForm, active: e.target.checked })}
                      className="w-5 h-5 accent-emerald-500"
                    />
                    <span className="text-xs font-bold text-[#3C3833]">✅ Tampilkan (aktif)</span>
                  </label>
                </div>
              </div>
            </div>
            <div className="p-6 pt-4 border-t border-[#E8E3DA] flex justify-end gap-3 bg-[#FAF8F5]/50">
              <button
                onClick={() => setItemModal(null)}
                className="px-5 py-2.5 border border-[#E8E3DA] rounded-xl text-sm font-bold text-[#5C564A] hover:bg-[#FAF8F5] cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleItemSubmit}
                disabled={isSaving}
                className="px-6 py-2.5 bg-[#3C3833] text-white rounded-xl text-sm font-bold hover:bg-black disabled:opacity-60 cursor-pointer"
              >
                {isSaving ? "Menyimpan..." : itemModal.mode === "create" ? "Tambah Menu" : "Simpan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ TOAST ═══ */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] animate-bounce">
          <div
            className={`flex items-center gap-2 px-5 py-3 rounded-xl shadow-lg border text-sm font-bold ${
              toast.kind === "ok"
                ? "bg-[#F0FDF4] text-[#166534] border-[#BBF7D0]"
                : "bg-red-50 text-red-600 border-red-100"
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">
              {toast.kind === "ok" ? "check_circle" : "error"}
            </span>
            {toast.msg}
          </div>
        </div>
      )}
    </div>
  );
}
