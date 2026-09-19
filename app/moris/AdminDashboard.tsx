"use client";

import { useState, useEffect } from "react";
import QRCode from "qrcode";

type CardData = {
  card_id: string;
  business_name: string | null;
  place_id: string | null;
  google_review_url: string | null;
  is_active: boolean;
  created_at: string;
  activated_at: string | null;
};

type TableQrData = {
  id: number;
  client_slug: string;
  table_num: string;
  url: string;
  created_at: string;
};

type GeneratedCardItem = {
  card_id: string;
  url: string;
  qrDataUrl?: string;
};

type GeneratedTableItem = {
  id?: number;
  tableNum: string;
  url: string;
  qrDataUrl: string;
};

type ClientData = {
  id: number;
  slug: string;
  business_name: string;
  status: string;
  template_key: string;
  logo_url?: string | null;
  cover_mobile_url?: string | null;
  theme_accent?: string | null;
  theme_bg?: string | null;
  tagline?: string | null;
  font_heading?: string | null;
  operating_hours?: string | null;
  wifi_ssid?: string | null;
  wifi_password?: string | null;
  google_place_id?: string | null;
  google_review_url?: string | null;
  address?: string | null;
  instagram_url?: string | null;
  whatsapp_url?: string | null;
  created_at: string;
};

type ClientFormState = {
  slug: string;
  business_name: string;
  status: string;
  template_key: string;
  logo_url: string;
  cover_mobile_url: string;
  theme_accent: string;
  theme_bg: string;
  tagline: string;
  operating_hours: string;
  wifi_ssid: string;
  wifi_password: string;
  google_place_id: string;
  google_review_url: string;
  address: string;
  instagram_url: string;
  whatsapp_url: string;
};

const emptyClientForm: ClientFormState = {
  slug: "",
  business_name: "",
  status: "active",
  template_key: "tammmu_v1",
  logo_url: "",
  cover_mobile_url: "",
  theme_accent: "#3C3833",
  theme_bg: "#FAF8F5",
  tagline: "",
  operating_hours: "",
  wifi_ssid: "",
  wifi_password: "",
  google_place_id: "",
  google_review_url: "",
  address: "",
  instagram_url: "",
  whatsapp_url: "",
};

/* ─── Menu Editor Types ─── */
type MenuCategoryRow = {
  id: number;
  key: string;
  label: string;
  sort_order: number;
};
type MenuItemRow = {
  id: number;
  client_slug: string;
  category_key: string;
  name: string;
  price_label: string;
  price_num: number | null;
  description: string | null;
  image_url: string | null;
  badge: string | null;
  is_featured: boolean;
  active: boolean;
  sort_order: number | null;
  search_key: string | null;
};
type CategoryFormState = {
  key: string;
  label: string;
  sort_order: string;
};
type MenuItemFormState = {
  name: string;
  category_key: string;
  price_label: string;
  price_num: string;
  description: string;
  image_url: string;
  badge: string;
  is_featured: boolean;
  active: boolean;
  sort_order: string;
  search_key: string;
};
const emptyCategoryForm: CategoryFormState = { key: "", label: "", sort_order: "0" };
const emptyMenuItemForm: MenuItemFormState = {
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

/* Compress & resize image client-side sebelum upload (hemat storage + loading cepat).
   GIF (animated) & file kecil di-skip apa adanya. PNG dipertahankan PNG (jaga transparansi logo). */
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
    const ext = isPng ? "png" : "jpg";
    const baseName = file.name.replace(/\.[^.]+$/, "").slice(0, 40) || "image";
    return new File([blob], `${baseName}.${ext}`, { type: isPng ? "image/png" : "image/jpeg" });
  } catch {
    return file;
  }
}

export default function AdminDashboard({
  secretKey,
  onLogout,
}: {
  secretKey: string;
  onLogout: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"standard" | "custom_tables" | "clients_templates">("standard");

  const [cards, setCards] = useState<CardData[]>([]);
  const [stats, setStats] = useState({ totalCount: 0, activeCount: 0, inactiveCount: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "inactive">("all");

  // Table QRs (Custom) Persistent State
  const [tableQrs, setTableQrs] = useState<TableQrData[]>([]);
  const [tableQrStats, setTableQrStats] = useState({ totalTables: 0, totalClients: 0 });
  const [tableQrClientFilter, setTableQrClientFilter] = useState<string>("all");
  const [customClientSlugMode, setCustomClientSlugMode] = useState<"dropdown" | "custom">("dropdown");

  // Clients (Multi-Template All-In-One)
  const [clients, setClients] = useState<ClientData[]>([]);
  const [clientStats, setClientStats] = useState({ totalClients: 0, totalActiveClients: 0 });
  const [clientModal, setClientModal] = useState<
    | { mode: "create"; initial?: Partial<ClientFormState> }
    | { mode: "edit"; client: ClientData }
    | null
  >(null);
  const [isClientSubmitting, setIsClientSubmitting] = useState(false);
  const [clientFormValue, setClientFormValue] = useState<ClientFormState>(emptyClientForm);

  useEffect(() => {
    if (!clientModal) {
      setClientFormValue(emptyClientForm);
      return;
    }
    if (clientModal.mode === "create") {
      setClientFormValue({ ...emptyClientForm, ...(clientModal.initial || {}) });
    } else if (clientModal.mode === "edit") {
      const c = clientModal.client;
      setClientFormValue({
        slug: c.slug,
        business_name: c.business_name,
        status: c.status,
        template_key: c.template_key,
        logo_url: c.logo_url || "",
        cover_mobile_url: c.cover_mobile_url || "",
        theme_accent: c.theme_accent || emptyClientForm.theme_accent,
        theme_bg: c.theme_bg || emptyClientForm.theme_bg,
        tagline: c.tagline || "",
        operating_hours: c.operating_hours || "",
        wifi_ssid: c.wifi_ssid || "",
        wifi_password: c.wifi_password || "",
        google_place_id: c.google_place_id || "",
        google_review_url: c.google_review_url || "",
        address: c.address || "",
        instagram_url: c.instagram_url || "",
        whatsapp_url: c.whatsapp_url || "",
      });
    }
  }, [clientModal]);

  // ── Menu Editor States ──
  const [menuEditorClient, setMenuEditorClient] = useState<ClientData | null>(null);
  const [menuCategories, setMenuCategories] = useState<MenuCategoryRow[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItemRow[]>([]);
  const [menuStats, setMenuStats] = useState({
    totalCategories: 0,
    totalItems: 0,
    activeItems: 0,
    featuredItems: 0,
  });
  const [isMenuLoading, setIsMenuLoading] = useState(false);
  const [menuActiveCategoryKey, setMenuActiveCategoryKey] = useState<string>("all");
  const [menuSearch, setMenuSearch] = useState("");
  const [isImportingMenu, setIsImportingMenu] = useState(false);
  const [isMenuSubmitting, setIsMenuSubmitting] = useState(false);
  const [uploadTarget, setUploadTarget] = useState<string | null>(null);

  // Category Modal
  const [categoryModal, setCategoryModal] = useState<
    | { mode: "create"; initial?: Partial<CategoryFormState> }
    | { mode: "edit"; category: MenuCategoryRow }
    | null
  >(null);
  const [categoryFormValue, setCategoryFormValue] = useState<CategoryFormState>(emptyCategoryForm);

  useEffect(() => {
    if (!categoryModal) {
      setCategoryFormValue(emptyCategoryForm);
      return;
    }
    if (categoryModal.mode === "create") {
      setCategoryFormValue({ ...emptyCategoryForm, ...(categoryModal.initial || {}) });
    } else {
      const c = categoryModal.category;
      setCategoryFormValue({
        key: c.key,
        label: c.label,
        sort_order: String(c.sort_order || 0),
      });
    }
  }, [categoryModal]);

  // Menu Item Modal
  const [menuItemModal, setMenuItemModal] = useState<
    | { mode: "create"; initial?: Partial<MenuItemFormState> }
    | { mode: "edit"; item: MenuItemRow }
    | null
  >(null);
  const [menuItemFormValue, setMenuItemFormValue] = useState<MenuItemFormState>(emptyMenuItemForm);

  useEffect(() => {
    if (!menuItemModal) {
      setMenuItemFormValue(emptyMenuItemForm);
      return;
    }
    if (menuItemModal.mode === "create") {
      const def = { ...emptyMenuItemForm };
      if (menuActiveCategoryKey !== "all") def.category_key = menuActiveCategoryKey;
      setMenuItemFormValue({ ...def, ...(menuItemModal.initial || {}) });
    } else {
      const it = menuItemModal.item;
      setMenuItemFormValue({
        name: it.name,
        category_key: it.category_key,
        price_label: it.price_label,
        price_num: it.price_num != null ? String(it.price_num) : "",
        description: it.description || "",
        image_url: it.image_url || "",
        badge: it.badge || "",
        is_featured: !!it.is_featured,
        active: !!it.active,
        sort_order: it.sort_order != null ? String(it.sort_order) : "",
        search_key: it.search_key || "",
      });
    }
  }, [menuItemModal, menuActiveCategoryKey]);

  // Modal / Action states
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [tableActionLoadingId, setTableActionLoadingId] = useState<number | string | null>(null);
  const [confirmModal, setConfirmModal] = useState<
    | { type: "reset" | "delete"; cardId: string }
    | { type: "delete_table"; tableId: number; tableNum: string }
    | { type: "delete_client_batch"; clientSlug: string }
    | { type: "delete_client"; clientSlug: string; clientName: string }
    | { type: "delete_menu_category"; id: number; label: string }
    | { type: "delete_menu_item"; id: number; name: string }
    | { type: "import_menu_preset"; clientSlug: string; clientName: string }
    | null
  >(null);

  // Instant Generate Cards Modal (Standard)
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [generateCount, setGenerateCount] = useState(5);
  const [isGenerating, setIsGenerating] = useState(false);
  const [newGeneratedCards, setNewGeneratedCards] = useState<GeneratedCardItem[]>([]);

  // Custom Table QR Generator States
  const [customClientSlug, setCustomClientSlug] = useState("tammmu");
  const [tableGenerateCount, setTableGenerateCount] = useState(1);
  const [isGeneratingTables, setIsGeneratingTables] = useState(false);
  const [generatedTables, setGeneratedTables] = useState<GeneratedTableItem[]>([]);

  // QR Preview Modal & Copy feedback states
  const [copiedCardId, setCopiedCardId] = useState<string | null>(null);
  const [copiedTableNum, setCopiedTableNum] = useState<string | null>(null);
  const [qrPreviewModal, setQrPreviewModal] = useState<{
    cardId: string;
    url: string;
    qrDataUrl: string;
  } | null>(null);
  const [tableQrPreview, setTableQrPreview] = useState<{
    tableNum: string;
    clientSlug: string;
    url: string;
    qrDataUrl: string;
  } | null>(null);

  useEffect(() => {
    fetchCards();
  }, []);

  async function fetchCards() {
    setIsLoading(true);
    setErrorMsg("");
    try {
      const res = await fetch("/api/admin/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secretKey }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "Gagal memuat data admin.");
        return;
      }

      setCards(data.cards || []);
      setStats(data.stats || { totalCount: 0, activeCount: 0, inactiveCount: 0 });
      setTableQrs(data.tableQrs || []);
      setTableQrStats({
        totalTables: data.tableQrStats?.totalTables || 0,
        totalClients: data.tableQrStats?.totalClients || 0,
      });
      setClients(data.clients || []);
      setClientStats({
        totalClients: data.clientStats?.totalClients || 0,
        totalActiveClients: data.clientStats?.totalActiveClients || 0,
      });
      if (data.clients?.length > 0 && customClientSlugMode === "dropdown" && !customClientSlug) {
        setCustomClientSlug(data.clients[0].slug);
      }
    } catch (err) {
      setErrorMsg("Terjadi kesalahan koneksi server.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCardAction(type: "reset" | "delete", cardId: string) {
    setActionLoadingId(cardId);
    try {
      const res = await fetch("/api/admin/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secretKey, action: type, cardId }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || `Gagal ${type} kartu.`);
        return;
      }

      fetchCards();
      setConfirmModal(null);
    } catch (err) {
      alert("Terjadi kesalahan koneksi.");
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleTableQrDelete(tableId: number) {
    setTableActionLoadingId(tableId);
    try {
      const res = await fetch("/api/admin/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secretKey, action: "delete_table_qr", tableQrId: tableId }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error || "Gagal menghapus meja."); return; }
      fetchCards();
      setConfirmModal(null);
    } catch (err) {
      alert("Terjadi kesalahan koneksi.");
    } finally {
      setTableActionLoadingId(null);
    }
  }

  async function handleClientBatchDelete(clientSlug: string) {
    setTableActionLoadingId(`client:${clientSlug}`);
    try {
      const res = await fetch("/api/admin/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secretKey, action: "delete_client_table_batch", clientSlug }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error || "Gagal menghapus batch client."); return; }
      if (tableQrClientFilter === clientSlug) setTableQrClientFilter("all");
      fetchCards();
      setConfirmModal(null);
    } catch (err) {
      alert("Terjadi kesalahan koneksi.");
    } finally {
      setTableActionLoadingId(null);
    }
  }

  async function handleClientDelete(clientSlug: string) {
    setActionLoadingId(`client-del-${clientSlug}`);
    try {
      const res = await fetch("/api/admin/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secretKey, action: "delete_client", clientSlug }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Gagal menghapus client.");
        return;
      }
      if (customClientSlug === clientSlug) setCustomClientSlug(clients[0]?.slug || "tammmu");
      if (tableQrClientFilter === clientSlug) setTableQrClientFilter("all");
      fetchCards();
      setConfirmModal(null);
    } catch (err) {
      alert("Terjadi kesalahan koneksi.");
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleClientFormSubmit(
    mode: "create" | "edit",
    form: ClientFormState,
    slugOriginal?: string
  ): Promise<string | null> {
    setIsClientSubmitting(true);
    try {
      const action = mode === "create" ? "create_client" : "update_client";
      const payload: any = {
        secretKey,
        action,
        clientSlug: slugOriginal || form.slug,
        businessName: form.business_name,
        status: form.status,
        templateKey: form.template_key,
        logoUrl: form.logo_url || null,
        coverMobileUrl: form.cover_mobile_url || null,
        themeAccent: form.theme_accent,
        themeBg: form.theme_bg,
        tagline: form.tagline || null,
        operatingHours: form.operating_hours || null,
        wifiSsid: form.wifi_ssid || null,
        wifiPassword: form.wifi_password || null,
        googlePlaceId: form.google_place_id || null,
        googleReviewUrl: form.google_review_url || null,
        address: form.address || null,
        instagramUrl: form.instagram_url || null,
        whatsappUrl: form.whatsapp_url || null,
      };
      const res = await fetch("/api/admin/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || `Gagal ${mode === "create" ? "membuat" : "update"} client.`);
        return data.error || "error";
      }
      fetchCards();
      setClientModal(null);
      return null;
    } catch (err) {
      alert("Terjadi kesalahan koneksi.");
      return "connection";
    } finally {
      setIsClientSubmitting(false);
    }
  }

  /* ═══════════════════════════════════════════════════
     IMAGE UPLOAD (Supabase Storage bucket "menu-assets")
     ═══════════════════════════════════════════════════ */

  async function handleImageUpload(
    file: File,
    scope: string,
    folder: string,
    setUrl: (v: string) => void
  ) {
    if (!file.type.startsWith("image/")) {
      alert("File harus berupa gambar (JPG / PNG / WEBP / GIF).");
      return;
    }
    setUploadTarget(scope);
    try {
      const maxDim = scope === "client_logo" ? 800 : scope === "client_cover" ? 1600 : 1200;
      const processed = await compressImageFile(file, maxDim);
      const fd = new FormData();
      fd.append("file", processed);
      fd.append("scope", scope);
      fd.append("folder", folder);
      fd.append("secretKey", secretKey);
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setUrl(data.url as string);
    } catch (err) {
      alert(`Upload gagal: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setUploadTarget(null);
    }
  }

  /* Reusable upload field: preview + drag&drop + input URL manual */
  const renderUploadField = (cfg: {
    scope: string;
    folder: string;
    url: string;
    setUrl: (v: string) => void;
    label: string;
    placeholder: string;
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
          if (f && !busy) handleImageUpload(f, cfg.scope, cfg.folder, cfg.setUrl);
        }}
      >
        <label className="block text-xs font-bold text-primary mb-1.5">{cfg.label}</label>
        <div className="flex items-stretch gap-3">
          {/* Preview */}
          <div className="w-20 h-20 rounded-xl border-2 border-dashed border-outline-variant bg-surface overflow-hidden flex items-center justify-center shrink-0">
            {cfg.url ? (
              <img
                src={cfg.url}
                alt="preview"
                className="w-full h-full object-cover"
                onError={(e) => ((e.target as HTMLImageElement).style.opacity = "0.2")}
              />
            ) : (
              <span className="material-symbols-outlined text-text-muted">image</span>
            )}
          </div>
          {/* Upload zone */}
          <label
            className={`flex-1 flex flex-col items-center justify-center gap-1 py-3.5 rounded-xl border-2 border-dashed transition-colors ${
              busy
                ? "border-primary bg-primary/[0.04] pointer-events-none"
                : "border-outline-variant hover:border-primary hover:bg-primary/[0.03] cursor-pointer"
            }`}
          >
            {busy ? (
              <>
                <span className="material-symbols-outlined text-primary animate-spin">progress_activity</span>
                <span className="text-xs font-bold text-primary">Mengupload & compress...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-primary">upload_file</span>
                <span className="text-xs font-bold text-primary">📤 Klik / drag foto ke sini</span>
                <span className="text-[10px] text-text-muted">JPG · PNG · WEBP · GIF · maks 5MB</span>
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
                if (f) handleImageUpload(f, cfg.scope, cfg.folder, cfg.setUrl);
              }}
            />
          </label>
        </div>
        {/* URL manual (opsional) */}
        <div className="flex items-center gap-2">
          <input
            type="url"
            value={cfg.url}
            onChange={(e) => cfg.setUrl(e.target.value)}
            placeholder={cfg.placeholder}
            disabled={busy}
            className="flex-1 bg-surface border border-outline-variant rounded-xl px-3.5 py-2 text-[11px] font-mono text-primary placeholder:text-text-muted focus:outline-none focus:border-primary"
          />
          {cfg.url && (
            <button
              type="button"
              onClick={() => cfg.setUrl("")}
              className="px-3 py-2 rounded-xl bg-surface-container text-text-muted hover:bg-red-50 hover:text-red-500 text-[10px] font-bold shrink-0 cursor-pointer"
            >
              Hapus
            </button>
          )}
        </div>
        {cfg.hint && <p className="text-[10px] text-text-muted leading-relaxed">{cfg.hint}</p>}
      </div>
    );
  };

  /* ═══════════════════════════════════════════════════
     MENU EDITOR HANDLERS
     ═══════════════════════════════════════════════════ */

  async function refreshClientMenu(clientSlug?: string): Promise<void> {
    const slug = clientSlug || menuEditorClient?.slug;
    if (!slug) return;
    setIsMenuLoading(true);
    try {
      const res = await fetch("/api/admin/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secretKey, action: "get_client_menu", clientSlug: slug }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setMenuCategories(data.categories || []);
        setMenuItems(data.items || []);
        setMenuStats({
          totalCategories: data.stats?.totalCategories || 0,
          totalItems: data.stats?.totalItems || 0,
          activeItems: data.stats?.activeItems || 0,
          featuredItems: data.stats?.featuredItems || 0,
        });
      }
    } catch {
      // Graceful
    } finally {
      setIsMenuLoading(false);
    }
  }

  async function handleOpenMenuEditor(client: ClientData) {
    setMenuEditorClient(client);
    setMenuActiveCategoryKey("all");
    setMenuSearch("");
    await refreshClientMenu(client.slug);
  }

  function handleCloseMenuEditor() {
    setMenuEditorClient(null);
    setMenuCategories([]);
    setMenuItems([]);
    setMenuActiveCategoryKey("all");
    setMenuSearch("");
  }

  async function handleImportPresetMenu() {
    if (!menuEditorClient) return;
    setIsImportingMenu(true);
    try {
      const res = await fetch("/api/admin/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          secretKey,
          action: "import_preset_menu_tammmu",
          clientSlug: menuEditorClient.slug,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Gagal import preset menu.");
      } else {
        alert(`✅ ${data.message}`);
        await refreshClientMenu();
      }
    } catch {
      alert("Koneksi error.");
    } finally {
      setIsImportingMenu(false);
    }
  }

  async function handleCategorySubmit(mode: "create" | "edit", form: CategoryFormState) {
    if (!menuEditorClient) return;
    if (!form.key.trim() || !form.label.trim()) {
      alert("Key dan Label kategori wajib diisi.");
      return;
    }
    setIsMenuSubmitting(true);
    try {
      const action = mode === "create" ? "create_menu_category" : "update_menu_category";
      const payload: any = {
        secretKey,
        action,
        clientSlug: menuEditorClient.slug,
        categoryKey: form.key.trim().toLowerCase().replace(/[^a-z0-9_-]/g, ""),
        categoryLabel: form.label.trim(),
        categorySortOrder: Number(form.sort_order) || 0,
      };
      if (mode === "edit" && categoryModal?.mode === "edit") {
        payload.categoryId = categoryModal.category.id;
      }
      const res = await fetch("/api/admin/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || `Gagal ${mode === "create" ? "membuat" : "update"} kategori.`);
      } else {
        setCategoryModal(null);
        await refreshClientMenu();
      }
    } catch {
      alert("Koneksi error.");
    } finally {
      setIsMenuSubmitting(false);
    }
  }

  async function handleCategoryDelete() {
    if (!confirmModal || !("id" in confirmModal && confirmModal.type === "delete_menu_category")) return;
    const { id } = confirmModal;
    try {
      const res = await fetch("/api/admin/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secretKey, action: "delete_menu_category", categoryId: id }),
      });
      const data = await res.json();
      if (!res.ok) alert(data.error || "Gagal hapus kategori.");
      else await refreshClientMenu();
    } catch {
      alert("Koneksi error.");
    } finally {
      setConfirmModal(null);
    }
  }

  async function handleMenuItemSubmit(mode: "create" | "edit", form: MenuItemFormState) {
    if (!menuEditorClient) return;
    if (!form.name.trim() || !form.category_key || !form.price_label.trim()) {
      alert("Nama, Kategori, dan Harga Label wajib diisi.");
      return;
    }
    setIsMenuSubmitting(true);
    try {
      const action = mode === "create" ? "create_menu_item" : "update_menu_item";
      const payload: any = {
        secretKey,
        action,
        clientSlug: menuEditorClient.slug,
        menuItemCategoryKey: form.category_key,
        menuItemName: form.name.trim(),
        menuItemPriceLabel: form.price_label.trim(),
        menuItemPriceNum: form.price_num ? Number(form.price_num.replace(/[^0-9]/g, "")) || null : null,
        menuItemDescription: form.description.trim() || null,
        menuItemImageUrl: form.image_url.trim() || null,
        menuItemBadge: form.badge.trim() || null,
        menuItemIsFeatured: !!form.is_featured,
        menuItemIsActive: form.active !== false,
        menuItemSortOrder: form.sort_order ? Number(form.sort_order) : null,
        menuItemSearchKey: form.search_key.trim() || null,
      };
      if (mode === "edit" && menuItemModal?.mode === "edit") {
        payload.menuItemId = menuItemModal.item.id;
      }
      const res = await fetch("/api/admin/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || `Gagal ${mode === "create" ? "membuat" : "update"} menu item.`);
      } else {
        setMenuItemModal(null);
        await refreshClientMenu();
      }
    } catch {
      alert("Koneksi error.");
    } finally {
      setIsMenuSubmitting(false);
    }
  }

  async function handleMenuItemDelete() {
    if (!confirmModal || !("id" in confirmModal && confirmModal.type === "delete_menu_item")) return;
    const { id } = confirmModal;
    try {
      const res = await fetch("/api/admin/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secretKey, action: "delete_menu_item", menuItemId: id }),
      });
      const data = await res.json();
      if (!res.ok) alert(data.error || "Gagal hapus menu item.");
      else await refreshClientMenu();
    } catch {
      alert("Koneksi error.");
    } finally {
      setConfirmModal(null);
    }
  }

  async function handleGenerateCards(e: React.FormEvent) {
    e.preventDefault();
    setIsGenerating(true);
    setErrorMsg("");
    try {
      const res = await fetch("/api/admin/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secretKey, action: "generate", count: generateCount }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Gagal men-generate kartu.");
        setIsGenerating(false);
        return;
      }

      const generatedList: GeneratedCardItem[] = data.generatedCards || [];

      for (const item of generatedList) {
        try {
          const qrDataUrl = await QRCode.toDataURL(item.url, { width: 600, margin: 2 });
          item.qrDataUrl = qrDataUrl;
        } catch (err) {
          console.error("QR generation error:", err);
        }
      }

      setNewGeneratedCards(generatedList);
      fetchCards();
    } catch (err) {
      alert("Terjadi kesalahan koneksi.");
    } finally {
      setIsGenerating(false);
    }
  }

  // Generate Table QRs for Custom Clients (Tammmu, etc)
  // STEP 1: Call API untuk INSERT ke DB (skip existing, idempotent)
  // STEP 2: Hasil + existing tampilkan di grid dengan QR di-generate on-the-fly di client
  async function handleGenerateTableQRs(clientSlug: string, count: number) {
    setIsGeneratingTables(true);
    setErrorMsg("");
    try {
      const res = await fetch("/api/admin/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          secretKey,
          action: "generate_table_qr",
          clientSlug,
          count,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Gagal generate batch meja.");
        setIsGeneratingTables(false);
        return;
      }

      // Refresh list (persistent) dari DB
      await fetchCards();

      // Tampilkan HASIL BARU SAJA sebagai highlighted GeneratedTableItem (user bisa langsung download)
      const baseUrl = typeof window !== "undefined" ? window.location.origin : "https://ratey.site";
      const slug = clientSlug.toLowerCase().trim();
      const tables: GeneratedTableItem[] = [];

      // 1) Masukkan data BARU dari response API ke generatedTables
      for (const row of data.newlyCreated || []) {
        try {
          const qrDataUrl = await QRCode.toDataURL(row.url, {
            width: 800,
            margin: 2,
            color: { dark: "#26231E", light: "#FAF8F5" },
          });
          tables.push({ id: row.id, tableNum: row.table_num, url: row.url, qrDataUrl });
        } catch (err) {
          console.error("Error generating table QR:", err);
        }
      }

      // 2) Kalau semua di-skip (sudah ada), kasih petunjuk dengan display existing meja untuk client ini
      if (tables.length === 0 && (data.skippedCount || 0) > 0) {
        // Generate QR dari existing list yang sudah di-refresh di state tableQrs
        const existingForClient = tableQrs.filter((t) => t.client_slug === slug);
        for (const row of existingForClient.slice(0, 30)) {
          try {
            const qrDataUrl = await QRCode.toDataURL(row.url, {
              width: 800,
              margin: 2,
              color: { dark: "#26231E", light: "#FAF8F5" },
            });
            tables.push({ id: row.id, tableNum: row.table_num, url: row.url, qrDataUrl });
          } catch { /* ignore */ }
        }
        // Set filter ke client ini biar user lihat semua existing
        setTableQrClientFilter(slug);
      }

      if (data.message) {
        setErrorMsg(`ℹ️ ${data.message}`);
        setTimeout(() => setErrorMsg(""), 5000);
      }

      setGeneratedTables(tables);
      // Auto-switch filter ke client ini
      if (tables.length > 0 && data?.clientSlug) {
        setTableQrClientFilter(data.clientSlug);
      }
    } catch (err) {
      console.error(err);
      alert("Terjadi kesalahan koneksi server.");
    } finally {
      setIsGeneratingTables(false);
    }
  }

  function handleCopyText(text: string, cardId: string) {
    navigator.clipboard.writeText(text);
    setCopiedCardId(cardId);
    setTimeout(() => setCopiedCardId(null), 2000);
  }

  function downloadSingleQr(item: GeneratedCardItem) {
    if (!item.qrDataUrl) return;
    const a = document.createElement("a");
    a.href = item.qrDataUrl;
    a.download = `${item.card_id}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function downloadAllQr() {
    newGeneratedCards.forEach((item, index) => {
      setTimeout(() => {
        downloadSingleQr(item);
      }, index * 200);
    });
  }

  function downloadSingleTableQr(table: GeneratedTableItem, clientSlugOverride?: string) {
    const a = document.createElement("a");
    a.href = table.qrDataUrl;
    const slug = clientSlugOverride || customClientSlug || "custom";
    a.download = `qr-meja-${table.tableNum}-${slug}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function downloadAllTableQrs(overrideList?: GeneratedTableItem[], clientSlugOverride?: string) {
    const list = overrideList || generatedTables;
    const slug = clientSlugOverride || customClientSlug;
    list.forEach((item, index) => {
      setTimeout(() => {
        downloadSingleTableQr(item, slug);
      }, index * 150);
    });
  }

  // Helper: Convert single TableQrData ke GeneratedTableItem (generate QR on the fly)
  async function tableQrDataToItem(row: TableQrData): Promise<GeneratedTableItem> {
    try {
      const qrDataUrl = await QRCode.toDataURL(row.url, {
        width: 800,
        margin: 2,
        color: { dark: "#26231E", light: "#FAF8F5" },
      });
      return { id: row.id, tableNum: row.table_num, url: row.url, qrDataUrl };
    } catch (err) {
      console.error("QR generate error for table", row.table_num, err);
      return { id: row.id, tableNum: row.table_num, url: row.url, qrDataUrl: "" };
    }
  }

  // Filtered Cards
  const filteredCards = cards.filter((c) => {
    const matchesSearch =
      c.card_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.business_name && c.business_name.toLowerCase().includes(searchQuery.toLowerCase()));

    if (filterStatus === "active") return matchesSearch && c.is_active;
    if (filterStatus === "inactive") return matchesSearch && !c.is_active;
    return matchesSearch;
  });

  return (
    <div className="bg-surface text-on-surface antialiased min-h-screen pb-24 md:pb-0 pt-16 md:pt-0 font-sans">
      {/* Web Top Nav (Desktop Header) */}
      <header className="hidden md:flex fixed top-0 w-full z-50 justify-between items-center px-6 h-16 bg-surface-white border-b border-outline-variant">
        <div className="flex items-center space-x-2.5">
          <img src="/ratey-logo.png" alt="Ratey Logo" className="w-9 h-9 md:w-10 md:h-10 object-cover rounded-xl" />
          <span className="text-headline-md font-headline-md font-bold text-primary tracking-tight">
            Ratey Admin
          </span>
        </div>

        <nav className="flex items-center space-x-4">
          <button
            onClick={() => setActiveTab("standard")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeTab === "standard"
                ? "bg-primary text-surface-white shadow-sm"
                : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
              }`}
          >
            💳 Kartu Direct Maps
          </button>
          <button
            onClick={() => setActiveTab("custom_tables")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeTab === "custom_tables"
                ? "bg-primary text-surface-white shadow-sm"
                : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
              }`}
          >
            🏪 Barcode Meja Custom
          </button>
          <button
            onClick={() => setActiveTab("clients_templates")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeTab === "clients_templates"
                ? "bg-primary text-surface-white shadow-sm"
                : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
              }`}
          >
            🏢 Clients & Templates
          </button>
        </nav>

        <div className="flex items-center space-x-4">
          <button
            onClick={onLogout}
            className="flex items-center space-x-2 text-on-surface-variant hover:text-primary transition-colors text-label-bold font-label-bold cursor-pointer"
          >
            <span>Keluar Admin</span>
            <span className="material-symbols-outlined text-sm">logout</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-container-margin md:px-6 pt-6 md:pt-24 pb-stack-lg animate-fade-in">
        {/* Dashboard Header Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-stack-md bg-surface-white p-6 rounded-xl border border-outline-variant shadow-[0_4px_6px_-1px_rgba(0,0,0,0.05)]">
          <div className="flex items-center space-x-4 mb-4 md:mb-0">
            <div className="w-12 h-12 bg-primary text-surface-white rounded-lg flex items-center justify-center">
              <span className="material-symbols-outlined text-2xl">
                {activeTab === "standard" ? "bolt" : activeTab === "custom_tables" ? "qr_code_2" : "storefront"}
              </span>
            </div>
            <div>
              <h1 className="text-headline-md font-headline-md text-primary">
                {activeTab === "standard"
                  ? "Management Kartu Ratey Direct"
                  : activeTab === "custom_tables"
                    ? "Generator Barcode Meja Custom"
                    : "Clients & Templates All-In-One"}
              </h1>
              <p className="text-body-sm font-body-sm text-text-muted mt-0.5">
                {activeTab === "standard"
                  ? "Kelola Kartu NFC & QR Direct Google Reviews"
                  : activeTab === "custom_tables"
                    ? "Generate Batch Barcode Meja untuk Client Cafe & Resto"
                    : "Buat Client Baru + Setting Branding + Menu WiFi Rating (5 menit jadi!)"}
              </p>
            </div>
          </div>

          {/* Mobile Tab Switcher */}
          <div className="flex md:hidden gap-1 overflow-x-auto no-scrollbar pb-1">
            <button
              onClick={() => setActiveTab("standard")}
              className={`shrink-0 py-2 px-3 rounded-lg text-[11px] font-bold border ${activeTab === "standard" ? "bg-primary text-white border-primary" : "bg-white border-outline-variant text-text-muted"
                }`}
            >
              Direct Cards
            </button>
            <button
              onClick={() => setActiveTab("custom_tables")}
              className={`shrink-0 py-2 px-3 rounded-lg text-[11px] font-bold border ${activeTab === "custom_tables" ? "bg-primary text-white border-primary" : "bg-white border-outline-variant text-text-muted"
                }`}
            >
              Barcode Meja
            </button>
            <button
              onClick={() => setActiveTab("clients_templates")}
              className={`shrink-0 py-2 px-3 rounded-lg text-[11px] font-bold border ${activeTab === "clients_templates" ? "bg-primary text-white border-primary" : "bg-white border-outline-variant text-text-muted"
                }`}
            >
              Clients
            </button>
          </div>
        </div>

        {/* TAB 1: STANDARD DIRECT CARDS */}
        {activeTab === "standard" && (
          <div>
            {/* Summary Stats Bento Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter mb-stack-md">
              <div className="bg-surface-white border border-outline-variant rounded-xl p-6 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.05)]">
                <p className="text-label-caps font-label-caps text-text-muted mb-2 uppercase">TOTAL KARTU DIRECT</p>
                <p className="text-headline-lg font-headline-lg text-primary">{stats.totalCount}</p>
              </div>

              <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-xl p-6 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.05)]">
                <p className="text-label-caps font-label-caps text-[#166534] mb-2 uppercase">KARTU AKTIF (TERHUBUNG)</p>
                <p className="text-headline-lg font-headline-lg text-[#166534]">{stats.activeCount}</p>
              </div>

              <div className="bg-[#FEF2F2] border border-[#FCA5A5] rounded-xl p-6 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.05)]">
                <p className="text-label-caps font-label-caps text-[#991B1B] mb-2 uppercase">KARTU BELUM AKTIF</p>
                <p className="text-headline-lg font-headline-lg text-[#991B1B]">{stats.inactiveCount}</p>
              </div>
            </div>

            {/* Quick Action Toolbar */}
            <div className="flex flex-col md:flex-row gap-gutter justify-between items-stretch md:items-center mb-stack-md">
              <button
                onClick={() => {
                  setNewGeneratedCards([]);
                  setShowGenerateModal(true);
                }}
                className="bg-cta-activation text-on-primary font-label-bold text-label-bold px-6 py-3 rounded-xl hover:brightness-110 transition-all flex items-center justify-center space-x-2 shadow-sm cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">add_circle</span>
                <span>+ Generate Batch Kartu Baru</span>
              </button>

              <div className="flex flex-col sm:flex-row gap-gutter">
                <div className="relative flex-1 sm:w-64">
                  <input
                    type="text"
                    placeholder="Cari ID / Nama Bisnis..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-surface-white border border-outline-variant rounded-xl px-4 py-2.5 pl-10 text-body-sm font-body-sm focus:outline-none focus:border-primary transition-colors"
                  />
                  <span className="material-symbols-outlined absolute left-3 top-3 text-text-muted text-lg">search</span>
                </div>

                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as any)}
                  className="bg-surface-white border border-outline-variant rounded-xl px-4 py-2.5 text-body-sm font-body-sm focus:outline-none focus:border-primary transition-colors cursor-pointer"
                >
                  <option value="all">Semua Status</option>
                  <option value="active">Aktif Saja</option>
                  <option value="inactive">Belum Aktif Saja</option>
                </select>
              </div>
            </div>

            {/* Cards Table */}
            <div className="bg-surface-white border border-outline-variant rounded-xl overflow-hidden shadow-[0_4px_6px_-1px_rgba(0,0,0,0.05)]">
              {isLoading ? (
                <div className="p-12 text-center text-text-muted">
                  <span className="material-symbols-outlined text-3xl animate-spin mb-2 block">sync</span>
                  <p className="text-body-sm font-body-sm">Memuat data kartu Ratey...</p>
                </div>
              ) : filteredCards.length === 0 ? (
                <div className="p-12 text-center text-text-muted">
                  <span className="material-symbols-outlined text-4xl text-outline mb-2 block">style</span>
                  <p className="text-body-md font-body-md font-semibold">Tidak Ada Kartu Ditemukan</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-surface-container-low border-b border-outline-variant text-label-caps font-label-caps text-text-muted">
                        <th className="py-3.5 px-4 md:px-6">ID KARTU / NFC LINK</th>
                        <th className="py-3.5 px-4 md:px-6">STATUS</th>
                        <th className="py-3.5 px-4 md:px-6">NAMA BISNIS TERHUBUNG</th>
                        <th className="py-3.5 px-4 md:px-6">TANGGAL</th>
                        <th className="py-3.5 px-4 md:px-6 text-right">AKSI ADMIN</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant text-body-sm font-body-sm">
                      {filteredCards.map((card) => {
                        const nfcUrl = `${typeof window !== "undefined" ? window.location.origin : "https://ratey.site"}/c/${card.card_id}`;
                        const isCopied = copiedCardId === card.card_id;

                        return (
                          <tr key={card.card_id} className="hover:bg-surface-container-lowest/50 transition-colors">
                            <td className="py-4 px-4 md:px-6">
                              <div className="font-bold font-mono text-primary text-body-md">{card.card_id}</div>
                              <div className="flex items-center space-x-2 mt-1">
                                <div className="bg-surface-container-low border border-outline-variant px-2.5 py-1 rounded text-xs font-mono text-on-surface-variant truncate max-w-[200px]">
                                  {nfcUrl}
                                </div>
                                <button
                                  onClick={() => handleCopyText(nfcUrl, card.card_id)}
                                  className="bg-surface-white border border-outline-variant hover:bg-surface-container-low text-primary text-xs font-semibold px-2 py-1 rounded flex items-center space-x-1 cursor-pointer"
                                >
                                  <span className="material-symbols-outlined text-xs">
                                    {isCopied ? "check" : "content_copy"}
                                  </span>
                                  <span>{isCopied ? "Tersalin" : "Salin NFC"}</span>
                                </button>
                              </div>
                            </td>

                            <td className="py-4 px-4 md:px-6">
                              {card.is_active ? (
                                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-[#DCFCE7] text-[#15803D]">
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A] mr-1.5 animate-pulse"></span>
                                  Aktif
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-surface-container-high text-on-surface-variant border border-outline-variant">
                                  <span className="w-1.5 h-1.5 rounded-full bg-outline-variant"></span>
                                  Belum Aktif
                                </span>
                              )}
                            </td>

                            <td className="py-4 px-4 md:px-6">
                              {card.business_name ? (
                                <div>
                                  <p className="font-semibold text-primary">{card.business_name}</p>
                                  {card.google_review_url && (
                                    <a
                                      href={card.google_review_url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-secondary hover:underline text-xs inline-flex items-center mt-0.5 space-x-1"
                                    >
                                      <span>Buka Link Review</span>
                                      <span className="material-symbols-outlined text-xs">open_in_new</span>
                                    </a>
                                  )}
                                </div>
                              ) : (
                                <span className="text-text-muted italic">Menunggu Aktivasi Klien</span>
                              )}
                            </td>

                            <td className="py-4 px-4 md:px-6 text-xs text-text-muted">
                              <div>Dibuat: {new Date(card.created_at).toLocaleDateString("id-ID")}</div>
                              {card.activated_at && (
                                <div className="text-emerald-700 mt-0.5">
                                  Aktif: {new Date(card.activated_at).toLocaleDateString("id-ID")}
                                </div>
                              )}
                            </td>

                            <td className="py-4 px-4 md:px-6 text-right">
                              <div className="flex items-center justify-end space-x-2">
                                <button
                                  onClick={async () => {
                                    const qrDataUrl = await QRCode.toDataURL(nfcUrl, { width: 600, margin: 2 });
                                    setQrPreviewModal({ cardId: card.card_id, url: nfcUrl, qrDataUrl });
                                  }}
                                  className="bg-surface-white border border-outline-variant hover:bg-surface-container-low text-primary text-xs font-semibold px-2.5 py-1.5 rounded-lg flex items-center space-x-1 cursor-pointer"
                                >
                                  <span className="material-symbols-outlined text-sm">qr_code_2</span>
                                  <span>Lihat QR</span>
                                </button>

                                {card.is_active && (
                                  <button
                                    onClick={() => setConfirmModal({ type: "reset", cardId: card.card_id })}
                                    disabled={actionLoadingId === card.card_id}
                                    className="bg-surface-white border border-outline-variant hover:bg-surface-container-low text-on-surface-variant text-xs font-semibold px-2.5 py-1.5 rounded-lg flex items-center space-x-1 cursor-pointer"
                                  >
                                    <span className="material-symbols-outlined text-sm">restart_alt</span>
                                    <span>Reset</span>
                                  </button>
                                )}

                                <button
                                  onClick={() => setConfirmModal({ type: "delete", cardId: card.card_id })}
                                  disabled={actionLoadingId === card.card_id}
                                  className="bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 text-xs font-semibold px-2.5 py-1.5 rounded-lg flex items-center space-x-1 cursor-pointer"
                                >
                                  <span className="material-symbols-outlined text-sm">delete</span>
                                  <span>Hapus</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: CUSTOM TABLETOP HUB BARCODE GENERATOR (Tammmu & Cafe) */}
        {activeTab === "custom_tables" && (() => {
          // ── Computed: Daftar unique client_slug untuk filter dropdown ──
          const clientSlugs = Array.from(new Set(tableQrs.map((t) => t.client_slug))).sort();
          const filterAll = tableQrClientFilter === "all";
          const filteredTableQrs = filterAll
            ? tableQrs
            : tableQrs.filter((t) => t.client_slug === tableQrClientFilter);

          return (
            <div className="space-y-stack-md">
              {/* Stats Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-gutter">
                <div className="bg-surface-white border border-outline-variant rounded-xl p-6 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.05)]">
                  <p className="text-label-caps font-label-caps text-text-muted mb-2 uppercase">TOTAL CLIENT CAFE</p>
                  <p className="text-headline-lg font-headline-lg text-primary">{tableQrStats.totalClients}</p>
                  {clientSlugs.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {clientSlugs.slice(0, 10).map((c) => (
                        <span key={c} className="text-[10px] font-mono px-2.5 py-1 bg-primary/10 text-primary rounded-full border border-primary/20">{c}</span>
                      ))}
                      {clientSlugs.length > 10 && (
                        <span className="text-[10px] text-text-muted px-2.5 py-1">+{clientSlugs.length - 10} lainnya</span>
                      )}
                    </div>
                  )}
                </div>
                <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-xl p-6 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.05)]">
                  <p className="text-label-caps font-label-caps text-[#1E40AF] mb-2 uppercase">TOTAL KODE MEJA TERSIMPAN</p>
                  <p className="text-headline-lg font-headline-lg text-[#1D4ED8]">{tableQrStats.totalTables}</p>
                  {tableQrClientFilter !== "all" && (
                    <p className="text-[11px] text-[#1E40AF]/80 mt-1 font-mono">
                      Ditampilkan {filteredTableQrs.length} meja · client: {tableQrClientFilter}
                    </p>
                  )}
                </div>
              </div>

              {/* Custom Table Config Card */}
              <div className="bg-surface-white border border-outline-variant rounded-xl p-6 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.05)]">
                <h2 className="text-headline-md font-headline-md font-bold text-primary mb-2 flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary">table_restaurant</span>
                  <span>Batch Generator Barcode Meja Custom</span>
                </h2>
                <p className="text-body-sm font-body-sm text-text-muted mb-6">
                  Buat puluhan QR Code Barcode Meja khusus untuk client cafe (seperti Tammmu Coffee). Data <span className="font-semibold text-primary">disimpan ke database</span>, refresh halaman pun hilang.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                  <div className="sm:col-span-1">
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-bold uppercase text-text-muted">Pilih Client Cafe</label>
                      <button
                        onClick={() => {
                          const next = customClientSlugMode === "dropdown" ? "custom" : "dropdown";
                          setCustomClientSlugMode(next);
                          if (next === "dropdown" && clients[0] && !customClientSlug) {
                            setCustomClientSlug(clients[0].slug);
                          }
                        }}
                        className="text-[10px] text-primary hover:text-black font-bold underline decoration-dotted underline-offset-4"
                      >
                        {customClientSlugMode === "dropdown" ? "⚙️ Pakai Custom Slug" : "📋 Pilih dari Clients"}
                      </button>
                    </div>
                    {customClientSlugMode === "dropdown" ? (
                      clients.length === 0 ? (
                        <div className="rounded-xl bg-[#FEF3C7] border border-[#FDE68A] px-4 py-3 text-[11px] text-[#92400E] space-y-1">
                          <p className="font-bold">⚠️ Belum ada Client di Database</p>
                          <p>Buat client dulu di Tab 3 <span className="font-bold">🏢 Clients & Templates</span>, lalu kembali ke sini untuk generate meja!</p>
                        </div>
                      ) : (
                        <select
                          value={customClientSlug}
                          onChange={(e) => setCustomClientSlug(e.target.value)}
                          className="w-full bg-surface-bright border border-outline-variant rounded-xl px-4 py-2.5 text-body-sm font-body-sm font-bold focus:outline-none focus:border-primary"
                        >
                          {clients.map((c) => (
                            <option key={c.slug} value={c.slug}>
                              {c.business_name} ({c.slug}) · {c.status.toUpperCase()}
                            </option>
                          ))}
                        </select>
                      )
                    ) : (
                      <input
                        type="text"
                        value={customClientSlug}
                        onChange={(e) => setCustomClientSlug(e.target.value.toLowerCase().trim())}
                        placeholder="misal: tammmu"
                        className="w-full bg-surface-bright border border-outline-variant rounded-xl px-4 py-2.5 text-body-sm font-body-sm font-mono focus:outline-none focus:border-primary"
                      />
                    )}
                    <p className="text-[11px] text-text-muted mt-1">
                      URL: <span className="font-mono">{typeof window !== "undefined" ? window.location.origin : "https://ratey.site"}/{customClientSlug || "tammmu"}/01</span>
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase text-text-muted mb-1.5">Jumlah Meja</label>
                    <input
                      type="number"
                      min={1}
                      max={500}
                      value={tableGenerateCount}
                      onChange={(e) => setTableGenerateCount(parseInt(e.target.value) || 1)}
                      className="w-full bg-surface-bright border border-outline-variant rounded-xl px-4 py-2.5 text-body-sm font-body-sm font-bold focus:outline-none focus:border-primary"
                    />
                    <p className="text-[11px] text-text-muted mt-1">Meja 01 s/d Meja {String(tableGenerateCount).padStart(2, "0")}</p>
                  </div>

                  <div className="flex flex-col">
                    <label className="block text-xs font-bold uppercase text-text-muted mb-1.5 invisible">Generate</label>
                    <button
                      onClick={() => handleGenerateTableQRs(customClientSlug, tableGenerateCount)}
                      disabled={isGeneratingTables || (customClientSlugMode === "dropdown" && clients.length === 0)}
                      className="w-full bg-primary text-surface-white font-label-bold text-label-bold py-[11px] px-6 rounded-xl hover:bg-black transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm disabled:opacity-50"
                    >
                      <span className={`material-symbols-outlined text-lg ${isGeneratingTables ? "animate-spin" : ""}`}>{isGeneratingTables ? "sync" : "qr_code_scanner"}</span>
                      <span>{isGeneratingTables ? "Saving to DB..." : `🚀 Generate & Simpan ${tableGenerateCount} Meja`}</span>
                    </button>
                    <p className="text-[11px] text-text-muted mt-1 invisible">placeholder</p>
                  </div>
                </div>
              </div>

              {/* Generated RECENTLY Table QRs Section (highlight hasil baru generate) */}
              {generatedTables.length > 0 && (
                <div className="bg-surface-white border-2 border-primary/30 rounded-xl p-6 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.05)]">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-outline-variant">
                    <div>
                      <h3 className="font-bold text-headline-md text-primary flex items-center gap-2">
                        <span className="material-symbols-outlined text-lg text-cta-activation">bolt</span>
                        Hasil Terbaru ({generatedTables.length} Meja)
                      </h3>
                      <p className="text-xs text-text-muted mt-0.5">Berikut kode meja yang baru saja dibuat / ditampilkan dari existing client.</p>
                    </div>

                    <button
                      onClick={() => downloadAllTableQrs(generatedTables, customClientSlug)}
                      className="bg-cta-activation text-on-primary font-bold text-xs px-5 py-2.5 rounded-xl hover:brightness-110 transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer shrink-0"
                    >
                      <span className="material-symbols-outlined text-base">download_for_offline</span>
                      <span>Unduh Semua ({generatedTables.length} PNG)</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {generatedTables.map((item) => {
                      const isCopiedTable = copiedTableNum === `new-${item.tableNum}`;
                      return (
                        <div
                          key={`new-${item.tableNum}-${item.url}`}
                          className="bg-surface-bright border border-outline-variant rounded-2xl p-3.5 flex flex-col items-center text-center hover:border-secondary transition-all shadow-xs"
                        >
                          <div className="w-full aspect-square bg-white border border-outline-variant rounded-xl p-2 mb-2 flex items-center justify-center">
                            <img src={item.qrDataUrl} alt={`QR Meja ${item.tableNum}`} className="w-full h-full object-contain" />
                          </div>

                          <span className="font-bold text-xs text-primary uppercase tracking-wider mb-0.5">Meja {item.tableNum}</span>
                          <p className="text-[10px] text-text-muted font-mono truncate w-full mb-2 select-all">{item.url}</p>

                          {/* Copy Link Button */}
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(item.url);
                              setCopiedTableNum(`new-${item.tableNum}`);
                              setTimeout(() => setCopiedTableNum(null), 2000);
                            }}
                            className={`w-full py-1.5 px-2 mb-1.5 text-[11px] font-bold rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer border ${
                              isCopiedTable
                                ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                                : "bg-surface-white border-outline-variant hover:bg-surface-container text-on-surface-variant"
                            }`}
                          >
                            <span className="material-symbols-outlined text-xs">
                              {isCopiedTable ? "check" : "content_copy"}
                            </span>
                            <span>{isCopiedTable ? "Tersalin ✓" : "Salin Link"}</span>
                          </button>

                          {/* Download Button */}
                          <button
                            onClick={() => downloadSingleTableQr(item, customClientSlug)}
                            className="w-full py-1.5 px-2 bg-surface-white border border-outline-variant hover:bg-surface-container text-primary text-[11px] font-bold rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-xs">download</span>
                            <span>Unduh PNG</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* PERSISTENT TABLE QR LIST (dari Database) */}
              <div className="bg-surface-white border border-outline-variant rounded-xl p-6 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.05)]">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-outline-variant">
                  <div>
                    <h3 className="font-bold text-headline-md text-primary flex items-center gap-2">
                      <span className="material-symbols-outlined text-lg text-secondary">database</span>
                      Daftar Meja Tersimpan (Persistent)
                    </h3>
                    <p className="text-xs text-text-muted mt-0.5">
                      Data dari database — <span className="text-primary font-semibold">tidak hilang meskipun refresh halaman</span>.
                      Total: <span className="font-mono">{filteredTableQrs.length}</span> meja.
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2">
                    {/* Client Filter */}
                    <select
                      value={tableQrClientFilter}
                      onChange={(e) => setTableQrClientFilter(e.target.value)}
                      className="bg-surface-bright border border-outline-variant rounded-xl px-4 py-2 text-xs font-semibold focus:outline-none focus:border-primary transition-colors cursor-pointer"
                    >
                      <option value="all">Semua Client ({tableQrs.length})</option>
                      {clientSlugs.map((s) => (
                        <option key={s} value={s}>
                          {s} ({tableQrs.filter((t) => t.client_slug === s).length})
                        </option>
                      ))}
                    </select>

                    {/* Download All Filtered */}
                    {filteredTableQrs.length > 0 && (
                      <button
                        onClick={async () => {
                          const list: GeneratedTableItem[] = [];
                          for (const row of filteredTableQrs) {
                            list.push(await tableQrDataToItem(row));
                          }
                          const slug = filterAll ? "all-clients" : tableQrClientFilter;
                          downloadAllTableQrs(list, slug);
                        }}
                        className="bg-cta-activation text-on-primary font-bold text-xs px-4 py-2 rounded-xl hover:brightness-110 transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer shrink-0"
                      >
                        <span className="material-symbols-outlined text-sm">download_for_offline</span>
                        <span>Unduh ({filteredTableQrs.length})</span>
                      </button>
                    )}

                    {/* Delete Batch Client */}
                    {!filterAll && (
                      <button
                        onClick={() => setConfirmModal({ type: "delete_client_batch", clientSlug: tableQrClientFilter })}
                        disabled={tableActionLoadingId === `client:${tableQrClientFilter}`}
                        className="bg-red-50 text-red-700 font-bold text-xs px-4 py-2 rounded-xl hover:bg-red-100 transition-colors border border-red-200 flex items-center justify-center gap-2 cursor-pointer shrink-0 disabled:opacity-50"
                      >
                        <span className="material-symbols-outlined text-sm">delete_sweep</span>
                        <span>Hapus Client</span>
                      </button>
                    )}
                  </div>
                </div>

                {filteredTableQrs.length === 0 ? (
                  <div className="p-12 text-center text-text-muted">
                    <span className="material-symbols-outlined text-4xl text-outline mb-2 block">table_bar</span>
                    <p className="text-body-md font-body-md font-semibold">
                      {tableQrs.length === 0 ? "Belum ada meja yang di-generate" : `Client "${tableQrClientFilter}" tidak punya data`}
                    </p>
                    <p className="text-xs text-text-muted mt-1">Gunakan form di atas untuk generate pertama kali.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {filteredTableQrs.map((row) => {
                      const isCopiedTable = copiedTableNum === `db-${row.id}`;
                      const isActionLoading = tableActionLoadingId === row.id;
                      return (
                        <div
                          key={row.id}
                          className="bg-surface-bright border border-outline-variant rounded-2xl p-3.5 flex flex-col items-center text-center hover:border-secondary transition-all shadow-xs"
                        >
                          {/* Client Slug Badge */}
                          <div className="w-full mb-2 flex items-center justify-between">
                            <span className="text-[9px] font-mono px-1.5 py-0.5 bg-primary/10 text-primary rounded border border-primary/20 truncate max-w-[70%]">
                              {row.client_slug}
                            </span>
                            <span className="text-[9px] text-text-muted font-mono">#{row.id}</span>
                          </div>

                          {/* QR Placeholder + Preview on Click */}
                          <button
                            onClick={async () => {
                              const item = await tableQrDataToItem(row);
                              if (item.qrDataUrl) {
                                setTableQrPreview({
                                  tableNum: row.table_num,
                                  clientSlug: row.client_slug,
                                  url: row.url,
                                  qrDataUrl: item.qrDataUrl,
                                });
                              }
                            }}
                            className="w-full aspect-square bg-white border border-outline-variant rounded-xl p-2 mb-2 flex items-center justify-center hover:border-secondary/70 transition-colors cursor-pointer group"
                            title="Klik untuk lihat QR penuh"
                          >
                            <div className="w-full h-full flex flex-col items-center justify-center text-text-muted group-hover:text-primary transition-colors">
                              <span className="material-symbols-outlined text-2xl mb-1">qr_code_2</span>
                              <span className="text-[9px] font-semibold uppercase tracking-wide">Lihat QR</span>
                            </div>
                          </button>

                          <span className="font-bold text-xs text-primary uppercase tracking-wider mb-0.5">Meja {row.table_num}</span>
                          <p className="text-[10px] text-text-muted font-mono truncate w-full mb-2 select-all">{row.url}</p>

                          {/* Copy Link Button */}
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(row.url);
                              setCopiedTableNum(`db-${row.id}`);
                              setTimeout(() => setCopiedTableNum(null), 2000);
                            }}
                            className={`w-full py-1.5 px-2 mb-1.5 text-[11px] font-bold rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer border ${
                              isCopiedTable
                                ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                                : "bg-surface-white border-outline-variant hover:bg-surface-container text-on-surface-variant"
                            }`}
                          >
                            <span className="material-symbols-outlined text-xs">
                              {isCopiedTable ? "check" : "content_copy"}
                            </span>
                            <span>{isCopiedTable ? "Tersalin ✓" : "Salin Link"}</span>
                          </button>

                          <div className="flex gap-1.5 w-full">
                            {/* Download Button */}
                            <button
                              onClick={async () => {
                                const item = await tableQrDataToItem(row);
                                if (item.qrDataUrl) downloadSingleTableQr(item, row.client_slug);
                              }}
                              className="flex-1 py-1.5 px-2 bg-surface-white border border-outline-variant hover:bg-surface-container text-primary text-[11px] font-bold rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-xs">download</span>
                              <span>PNG</span>
                            </button>
                            {/* Delete Button */}
                            <button
                              onClick={() => setConfirmModal({ type: "delete_table", tableId: row.id, tableNum: row.table_num })}
                              disabled={isActionLoading}
                              className="py-1.5 px-2 bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 disabled:opacity-50 text-[11px] font-bold rounded-lg transition-colors flex items-center justify-center cursor-pointer"
                              title="Hapus meja ini"
                            >
                              {isActionLoading ? (
                                <span className="material-symbols-outlined text-xs animate-spin">sync</span>
                              ) : (
                                <span className="material-symbols-outlined text-xs">delete</span>
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* TAB 3: CLIENTS & TEMPLATES ALL-IN-ONE (Multi-Client Ready) */}
        {activeTab === "clients_templates" && (
          <>
            {!menuEditorClient ? (
              /* ─── CLIENT GRID VIEW (Default Tab 3) ─── */
              <div className="space-y-stack-md">
                {/* Summary Stats */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-gutter">
                  <div className="bg-surface-white border border-outline-variant rounded-xl p-6 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.05)]">
                    <p className="text-label-caps font-label-caps text-text-muted mb-2 uppercase">TOTAL CLIENT TERDAFTAR</p>
                    <p className="text-headline-lg font-headline-lg text-primary">{clientStats.totalClients}</p>
                    <p className="text-[11px] text-text-muted mt-2">
                      Template saat ini: <span className="font-bold font-mono text-primary">tammmu_v1</span> (Branding + WiFi + Menu + Rating)
                    </p>
                  </div>
                  <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-xl p-6 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.05)]">
                    <p className="text-label-caps font-label-caps text-[#166534] mb-2 uppercase">CLIENT AKTIF (SIAP JUAL)</p>
                    <p className="text-headline-lg font-headline-lg text-[#166534]">{clientStats.totalActiveClients}</p>
                    <p className="text-[11px] text-[#166534]/80 mt-2">
                      {clientStats.totalClients - clientStats.totalActiveClients} client non-aktif / draft.
                    </p>
                  </div>
                </div>

                {/* Action Bar */}
                <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between bg-surface-white border border-outline-variant rounded-xl p-4 md:p-5 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.05)]">
                  <div>
                    <h2 className="font-bold text-headline-md text-primary flex items-center gap-2 mb-1">
                      <span className="material-symbols-outlined text-secondary">storefront</span>
                      List Clients
                    </h2>
                    <p className="text-body-sm font-body-sm text-text-muted">
                      Setiap client punya branding unik, menu, WiFi, dan URL sendiri. Tambah client baru cuma 5 menit!
                    </p>
                  </div>
                  <button
                    onClick={() => setClientModal({ mode: "create" })}
                    className="bg-primary text-surface-white font-label-bold text-label-bold py-[11px] px-6 rounded-xl hover:bg-black transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm shrink-0"
                  >
                    <span className="material-symbols-outlined text-lg">add</span>
                    <span>✨ Buat Client Baru</span>
                  </button>
                </div>

                {/* List Grid / Empty State */}
            {clients.length === 0 ? (
              <div className="bg-surface-white border-2 border-dashed border-outline-variant rounded-2xl p-10 text-center space-y-4">
                <div className="w-16 h-16 bg-primary/5 rounded-2xl flex items-center justify-center mx-auto">
                  <span className="material-symbols-outlined text-4xl text-primary/50">storefront</span>
                </div>
                <div>
                  <h3 className="font-bold text-lg text-primary mb-1">Belum ada client di database</h3>
                  <p className="text-sm text-text-muted max-w-md mx-auto leading-relaxed">
                    Klik tombol <span className="font-bold">"✨ Buat Client Baru"</span> di atas untuk onboarding client pertama kamu.
                    Sebagai contoh, kamu bisa import client <span className="font-mono font-bold text-primary">"tammmu"</span> (yang sudah hardcode sekarang) ke sistem ini supaya workflow semua client seragam.
                  </p>
                </div>
                <div className="flex justify-center gap-3 pt-2">
                  <button
                    onClick={() => setClientModal({ mode: "create", initial: {
                      slug: "tammmu",
                      business_name: "Tammmu Coffee",
                      status: "active",
                      template_key: "tammmu_v1",
                      logo_url: "https://psmafygvgflmgnganptk.supabase.co/storage/v1/object/public/menu-assets/tammmu/brand/logo-fiks.png",
                      cover_mobile_url: "https://psmafygvgflmgnganptk.supabase.co/storage/v1/object/public/menu-assets/tammmu/brand/cover.png",
                      operating_hours: "08.00 - 22.00",
                      wifi_ssid: "Tammmu_Guest",
                      wifi_password: "tammmu2026",
                      google_place_id: "ChIJacWFN5b71y0REVY5OeZhL70",
                      tagline: "ONE MORE, PLEASE.",
                      theme_accent: "#3C3833",
                      theme_bg: "#FAF8F5",
                    }})}
                    className="bg-[#F3EFEA] text-[#3C3833] font-bold text-xs py-2 px-4 rounded-xl hover:bg-[#EDE8DE] transition-all cursor-pointer"
                  >
                    🚀 Import Tammmu (Contoh Template)
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {clients.map((client) => {
                  const totalTablesClient = tableQrs.filter((t) => t.client_slug === client.slug).length;
                  const baseUrl = typeof window !== "undefined" ? window.location.origin : "https://ratey.site";
                  const liveUrl = `${baseUrl}/${client.slug}/01`;
                  const statusColor =
                    client.status === "active"
                      ? "bg-[#D1FAE5] text-[#065F46] border-[#6EE7B7]"
                      : "bg-[#FEE2E2] text-[#991B1B] border-[#FCA5A5]";
                  return (
                    <div
                      key={client.slug}
                      className="bg-surface-white border border-outline-variant rounded-2xl p-5 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.05)] transition-all hover:border-secondary hover:shadow-md flex flex-col gap-4"
                    >
                      {/* Header: Status Badge + Logo / Initial */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-12 h-12 rounded-xl bg-[#F3EFEA] border border-[#E8E3DA] flex items-center justify-center overflow-hidden shrink-0">
                            {client.logo_url ? (
                              <img
                                src={client.logo_url}
                                alt={client.business_name}
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <span className="material-symbols-outlined text-xl text-[#8E897C]">local_cafe</span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-bold text-primary leading-tight truncate">{client.business_name}</h3>
                            <p className="text-[11px] font-mono text-text-muted mt-0.5 truncate">/{client.slug}</p>
                          </div>
                        </div>
                        <span className={`shrink-0 text-[10px] px-2.5 py-1 rounded-full uppercase font-bold border ${statusColor}`}>
                          {client.status}
                        </span>
                      </div>

                      {/* Meta Info */}
                      <div className="grid grid-cols-2 gap-2 text-[11px] text-text-muted">
                        <div className="flex items-center gap-1.5 bg-surface-bright px-2.5 py-1.5 rounded-lg border border-outline-variant/60">
                          <span className="material-symbols-outlined text-[14px] text-primary/70">table_restaurant</span>
                          <span className="font-mono font-bold">{totalTablesClient} Meja</span>
                        </div>
                        <div className="flex items-center gap-1.5 bg-surface-bright px-2.5 py-1.5 rounded-lg border border-outline-variant/60">
                          <span className="material-symbols-outlined text-[14px] text-primary/70">palette</span>
                          <span className="font-bold truncate">{client.template_key}</span>
                        </div>
                      </div>

                      <div className="space-y-1.5 text-[11px] text-text-muted">
                        {client.wifi_ssid && (
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-[14px] text-primary/70">wifi</span>
                            <span className="truncate font-mono">{client.wifi_ssid}</span>
                          </div>
                        )}
                        {client.google_place_id && (
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-[14px] text-amber-500">star</span>
                            <span className="text-primary font-bold truncate">Rating Google ✓</span>
                          </div>
                        )}
                      </div>

                      {/* Action Buttons Row */}
                      <div className="grid grid-cols-3 gap-2 pt-1 border-t border-outline-variant/60">
                        <a
                          href={liveUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-1.5 py-2 rounded-xl bg-primary/5 text-primary border border-primary/10 hover:bg-primary/10 text-[11px] font-bold transition-colors cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[14px]">visibility</span>
                          <span>Preview</span>
                        </a>
                        <button
                          onClick={() => setClientModal({ mode: "edit", client })}
                          className="flex items-center justify-center gap-1.5 py-2 rounded-xl bg-[#F3EFEA] text-[#3C3833] border border-[#E3DCD2] hover:bg-[#EDE8DE] text-[11px] font-bold transition-colors cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[14px]">edit</span>
                          <span>Edit</span>
                        </button>
                        <button
                          onClick={() => handleOpenMenuEditor(client)}
                          className="flex items-center justify-center gap-1.5 py-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 text-[11px] font-bold transition-colors cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[14px]">menu_book</span>
                          <span>Edit Menu</span>
                        </button>
                        <button
                          onClick={() => {
                            setCustomClientSlug(client.slug);
                            setCustomClientSlugMode("dropdown");
                            setActiveTab("custom_tables");
                          }}
                          className="flex items-center justify-center gap-1.5 py-2 rounded-xl bg-[#EFF6FF] text-[#1E40AF] border border-[#BFDBFE] hover:bg-[#DBEAFE] text-[11px] font-bold transition-colors cursor-pointer col-span-2"
                        >
                          <span className="material-symbols-outlined text-[14px]">qr_code_scanner</span>
                          <span>Generate Meja</span>
                        </button>
                        <button
                          onClick={() =>
                            setConfirmModal({
                              type: "delete_client",
                              clientSlug: client.slug,
                              clientName: client.business_name,
                            })
                          }
                          className="flex items-center justify-center gap-1.5 py-2 rounded-xl bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 text-[11px] font-bold transition-colors cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[14px]">delete</span>
                          <span>Hapus</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* ─── FULL WIDTH PANEL MENU EDITOR ─── */
          <div className="space-y-stack-md">
            {/* ── Header Breadcrumb + Bento Stats ── */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    onClick={handleCloseMenuEditor}
                    className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-surface-white border border-outline-variant hover:bg-surface-container text-primary text-xs font-bold transition-colors cursor-pointer shrink-0"
                  >
                    <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                    <span>Kembali</span>
                  </button>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="font-bold text-headline-md text-primary truncate">{menuEditorClient.business_name}</h2>
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#F3EFEA] text-[#3C3833] border border-[#E8E3DA] text-[10px] font-bold font-mono">
                        /{menuEditorClient.slug}
                      </span>
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                        menuEditorClient.status === "active"
                          ? "bg-[#D1FAE5] text-[#065F46] border-[#6EE7B7]"
                          : "bg-[#FEE2E2] text-[#991B1B] border-[#FCA5A5]"
                      }`}>
                        {menuEditorClient.status === "active" ? "AKTIF" : "DRAFT"}
                      </span>
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/5 text-primary border border-primary/10 text-[10px] font-bold font-mono">
                        template: {menuEditorClient.template_key}
                      </span>
                    </div>
                    <p className="text-body-sm font-body-sm text-text-muted mt-1">
                      Editor Menu — Kelola kategori & item, lalu nanti muncul di halaman <code className="bg-surface px-1.5 py-0.5 rounded text-[11px]">/{menuEditorClient.slug}/[no-meja]</code>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <a
                    href={`${typeof window !== "undefined" ? window.location.origin : ""}/${menuEditorClient.slug}/01`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-1.5 py-2 px-4 rounded-xl bg-[#EFF6FF] text-[#1E40AF] border border-[#BFDBFE] hover:bg-[#DBEAFE] text-xs font-bold transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                    <span>Preview Live</span>
                  </a>
                  <button
                    onClick={() => {
                      setCustomClientSlug(menuEditorClient.slug);
                      setCustomClientSlugMode("dropdown");
                      setActiveTab("custom_tables");
                    }}
                    className="flex items-center justify-center gap-1.5 py-2 px-4 rounded-xl bg-[#FFF7ED] text-[#C2410C] border border-[#FED7AA] hover:bg-[#FFEDD5] text-xs font-bold transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[14px]">qr_code_scanner</span>
                    <span>Generate Meja</span>
                  </button>
                </div>
              </div>

              {/* 4 Bento Stats Menu */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-surface-white border border-outline-variant rounded-xl p-4 shadow-sm">
                  <p className="text-[10px] font-label-caps uppercase text-text-muted mb-1">Total Kategori</p>
                  <p className="text-headline-md font-headline-md text-primary">{menuStats.totalCategories}</p>
                </div>
                <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-xl p-4 shadow-sm">
                  <p className="text-[10px] font-label-caps uppercase text-[#166534] mb-1">Total Menu Item</p>
                  <p className="text-headline-md font-headline-md text-[#166534]">{menuStats.totalItems}</p>
                </div>
                <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-xl p-4 shadow-sm">
                  <p className="text-[10px] font-label-caps uppercase text-[#1E40AF] mb-1">Item Aktif</p>
                  <p className="text-headline-md font-headline-md text-[#1E40AF]">{menuStats.activeItems}</p>
                </div>
                <div className="bg-[#FFF7ED] border border-[#FED7AA] rounded-xl p-4 shadow-sm">
                  <p className="text-[10px] font-label-caps uppercase text-[#C2410C] mb-1">⭐ Featured</p>
                  <p className="text-headline-md font-headline-md text-[#C2410C]">{menuStats.featuredItems}</p>
                </div>
              </div>
            </div>

            {/* ── Action Bar Row ── */}
            <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between bg-surface-white border border-outline-variant rounded-xl p-4 md:p-5 shadow-sm">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleImportPresetMenu}
                  disabled={isImportingMenu}
                  className="bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold text-xs py-2.5 px-5 rounded-xl hover:from-orange-600 hover:to-amber-600 transition-all disabled:opacity-60 flex items-center justify-center gap-2 shadow-sm cursor-pointer shrink-0"
                >
                  {isImportingMenu ? (
                    <>
                      <span className="material-symbols-outlined text-[15px] animate-spin">progress_activity</span>
                      <span>Importing 30+ Menu...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[15px]">local_fire_department</span>
                      <span>🔥 Import Preset Tammmu (30 Menu)</span>
                    </>
                  )}
                </button>
                <button
                  onClick={() => setCategoryModal({ mode: "create" })}
                  className="bg-[#F3EFEA] text-[#3C3833] border border-[#E3DCD2] hover:bg-[#EDE8DE] font-bold text-xs py-2.5 px-4 rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                >
                  <span className="material-symbols-outlined text-[14px]">add</span>
                  <span>➕ Buat Kategori</span>
                </button>
                <button
                  onClick={() => setMenuItemModal({ mode: "create" })}
                  disabled={menuCategories.length === 0}
                  className="bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 font-bold text-xs py-2.5 px-4 rounded-xl transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shrink-0"
                  title={menuCategories.length === 0 ? "Buat kategori terlebih dahulu" : ""}
                >
                  <span className="material-symbols-outlined text-[14px]">restaurant_menu</span>
                  <span>➕ Tambah Menu Item</span>
                </button>
              </div>
              <div className="relative lg:max-w-sm lg:w-full">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted text-[18px]">search</span>
                <input
                  type="text"
                  value={menuSearch}
                  onChange={(e) => setMenuSearch(e.target.value)}
                  placeholder="Cari menu: kopi, nasi, toast..."
                  className="w-full bg-surface border border-outline-variant rounded-xl pl-10 pr-4 py-2.5 text-xs font-bold text-primary placeholder:text-text-muted focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            {/* ── 2-COL LAYOUT: Left = Categories List | Right = Menu Items Grid ── */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* ═══ LEFT 30%: CATEGORIES LIST ═══ */}
              <div className="lg:col-span-4 xl:col-span-3 space-y-3">
                <div className="bg-surface-white border border-outline-variant rounded-2xl shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant">
                    <h3 className="font-bold text-label-lg text-primary flex items-center gap-2">
                      <span className="material-symbols-outlined text-secondary text-[18px]">category</span>
                      <span>Kategori</span>
                      <span className="text-[10px] font-bold bg-surface-container px-2 py-0.5 rounded-full text-text-muted">
                        {menuCategories.length}
                      </span>
                    </h3>
                    <button
                      onClick={() => setCategoryModal({ mode: "create" })}
                      className="p-1.5 rounded-lg bg-[#F3EFEA] text-[#3C3833] hover:bg-[#EDE8DE] transition-colors cursor-pointer"
                      title="Buat Kategori Baru"
                    >
                      <span className="material-symbols-outlined text-[16px]">add</span>
                    </button>
                  </div>
                  {isMenuLoading ? (
                    <div className="px-5 py-10 text-center">
                      <span className="material-symbols-outlined text-2xl text-text-muted animate-spin inline-block">progress_activity</span>
                      <p className="text-xs text-text-muted mt-2">Loading menu...</p>
                    </div>
                  ) : menuCategories.length === 0 ? (
                    <div className="px-5 py-10 text-center space-y-2">
                      <div className="w-12 h-12 bg-primary/5 rounded-xl flex items-center justify-center mx-auto">
                        <span className="material-symbols-outlined text-2xl text-primary/40">menu_book</span>
                      </div>
                      <h4 className="font-bold text-sm text-primary">Belum ada kategori</h4>
                      <p className="text-[11px] text-text-muted leading-relaxed">
                        Klik tombol <span className="font-bold">"🔥 Import Preset Tammmu"</span> di atas untuk otomatis buat 3 kategori + 30 menu item, atau buat manual.
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-outline-variant/60 max-h-[60vh] overflow-y-auto">
                      {menuCategories
                        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
                        .map((cat) => {
                          const itemsInCat = menuItems.filter((it) => it.category_key === cat.key).length;
                          const isActive = menuActiveCategoryKey === cat.key;
                          return (
                            <div
                              key={cat.id}
                              className={`group px-5 py-3.5 flex items-center justify-between gap-3 transition-colors cursor-default ${
                                isActive ? "bg-primary/[0.04]" : "hover:bg-surface-container/60"
                              }`}
                              onClick={() => setMenuActiveCategoryKey(cat.key)}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div
                                  className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                                    isActive ? "bg-primary text-white" : "bg-[#F3EFEA] text-[#5C564A]"
                                  }`}
                                >
                                  <span className="material-symbols-outlined text-[16px]">restaurant</span>
                                </div>
                                <div className="min-w-0">
                                  <p className={`font-bold text-sm truncate ${isActive ? "text-primary" : "text-primary"}`}>
                                    {cat.label}
                                  </p>
                                  <p className="text-[10px] font-mono text-text-muted truncate">key: {cat.key}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                    itemsInCat > 0
                                      ? "bg-primary/5 text-primary border border-primary/10"
                                      : "bg-surface-container text-text-muted"
                                  }`}
                                >
                                  {itemsInCat} item
                                </span>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setCategoryModal({ mode: "edit", category: cat });
                                  }}
                                  className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 bg-surface-container hover:bg-[#F3EFEA] text-[#5C564A] transition-all cursor-pointer"
                                  title="Edit Kategori"
                                >
                                  <span className="material-symbols-outlined text-[14px]">edit</span>
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setConfirmModal({
                                      type: "delete_menu_category",
                                      id: cat.id,
                                      label: cat.label,
                                    });
                                  }}
                                  className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 bg-surface-container hover:bg-red-50 text-red-500 transition-all cursor-pointer"
                                  title="Hapus Kategori"
                                >
                                  <span className="material-symbols-outlined text-[14px]">delete</span>
                                </button>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              </div>

              {/* ═══ RIGHT 70%: MENU ITEMS GRID / LIST ═══ */}
              <div className="lg:col-span-8 xl:col-span-9 space-y-4">
                {/* Category Pills Filter */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                  <button
                    onClick={() => setMenuActiveCategoryKey("all")}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                      menuActiveCategoryKey === "all"
                        ? "bg-primary text-white shadow-sm"
                        : "bg-surface-white text-primary border border-outline-variant hover:bg-surface-container"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[14px]">all_inclusive</span>
                    <span>Semua ({menuItems.length})</span>
                  </button>
                  {menuCategories
                    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
                    .map((cat) => {
                      const count = menuItems.filter((it) => it.category_key === cat.key).length;
                      const active = menuActiveCategoryKey === cat.key;
                      return (
                        <button
                          key={cat.id}
                          onClick={() => setMenuActiveCategoryKey(cat.key)}
                          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                            active
                              ? "bg-primary text-white shadow-sm"
                              : "bg-surface-white text-primary border border-outline-variant hover:bg-surface-container"
                          }`}
                        >
                          <span>{cat.label}</span>
                          <span
                            className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                              active ? "bg-white/20 text-white" : "bg-primary/5 text-primary"
                            }`}
                          >
                            {count}
                          </span>
                        </button>
                      );
                    })}
                </div>

                {/* Menu Items Grid */}
                {isMenuLoading ? (
                  <div className="bg-surface-white border border-outline-variant rounded-2xl p-12 text-center">
                    <span className="material-symbols-outlined text-3xl text-text-muted animate-spin inline-block">progress_activity</span>
                    <p className="text-sm text-text-muted mt-3">Memuat menu items...</p>
                  </div>
                ) : (() => {
                  const filteredItems = menuItems.filter((it) => {
                    const matchCat = menuActiveCategoryKey === "all" || it.category_key === menuActiveCategoryKey;
                    const q = menuSearch.trim().toLowerCase();
                    const matchSearch =
                      !q ||
                      it.name.toLowerCase().includes(q) ||
                      (it.description || "").toLowerCase().includes(q) ||
                      (it.search_key || "").toLowerCase().includes(q) ||
                      (it.badge || "").toLowerCase().includes(q);
                    return matchCat && matchSearch;
                  });
                  if (filteredItems.length === 0) {
                    return (
                      <div className="bg-surface-white border-2 border-dashed border-outline-variant rounded-2xl p-10 text-center space-y-3">
                        <div className="w-14 h-14 bg-primary/5 rounded-2xl flex items-center justify-center mx-auto">
                          <span className="material-symbols-outlined text-3xl text-primary/40">search_off</span>
                        </div>
                        <h4 className="font-bold text-lg text-primary">
                          {menuItems.length === 0 ? "Belum ada menu item" : "Tidak ada menu yang cocok"}
                        </h4>
                        <p className="text-sm text-text-muted max-w-md mx-auto leading-relaxed">
                          {menuItems.length === 0
                            ? "Klik 🔥 Import Preset Tammmu untuk menambahkan 30+ menu otomatis, atau klik ➕ Tambah Menu Item untuk bikin manual."
                            : `Coba cari keyword lain atau hapus filter kategori. Total ${menuItems.length} item di database.`}
                        </p>
                      </div>
                    );
                  }
                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {filteredItems
                        .sort((a, b) => {
                          if (!!b.is_featured !== !!a.is_featured) return (b.is_featured ? 1 : 0) - (a.is_featured ? 1 : 0);
                          return (a.sort_order ?? 999) - (b.sort_order ?? 999);
                        })
                        .map((item) => {
                          const catLabel =
                            menuCategories.find((c) => c.key === item.category_key)?.label || item.category_key;
                          return (
                            <div
                              key={item.id}
                              className={`group bg-surface-white border rounded-2xl shadow-sm p-4 flex gap-3 transition-all hover:border-secondary hover:shadow-md ${
                                !item.active ? "border-red-200 bg-red-50/40 opacity-75" : "border-outline-variant"
                              }`}
                            >
                              {/* Thumbnail Foto */}
                              <div className="w-20 h-20 shrink-0 rounded-xl bg-[#F3EFEA] border border-[#E8E3DA] overflow-hidden flex items-center justify-center">
                                {item.image_url ? (
                                  <img
                                    src={item.image_url}
                                    alt={item.name}
                                    className="w-full h-full object-cover"
                                    loading="lazy"
                                  />
                                ) : (
                                  <span className="material-symbols-outlined text-2xl text-[#8E897C]">restaurant</span>
                                )}
                              </div>
                              {/* Info */}
                              <div className="flex-1 min-w-0 flex flex-col">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <h4 className="font-bold text-sm text-primary leading-tight truncate">
                                        {item.name}
                                      </h4>
                                      {item.is_featured && (
                                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200 text-[9px] font-bold shrink-0">
                                          <span className="material-symbols-outlined text-[10px]">star</span>
                                          <span>FEATURED</span>
                                        </span>
                                      )}
                                      {item.badge && (
                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-secondary/10 text-secondary border border-secondary/20 text-[9px] font-bold shrink-0">
                                          {item.badge}
                                        </span>
                                      )}
                                      {!item.active && (
                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 border border-red-200 text-[9px] font-bold shrink-0">
                                          NON-AKTIF
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                      <span className="inline-block px-2 py-0.5 rounded-md bg-[#F3EFEA] text-[#5C564A] text-[10px] font-bold">
                                        {catLabel}
                                      </span>
                                      <span className="text-primary font-bold text-sm font-mono">
                                        {item.price_label}
                                      </span>
                                      {item.price_num != null && (
                                        <span className="text-[10px] font-mono text-text-muted">
                                          (Rp {item.price_num.toLocaleString("id-ID")})
                                        </span>
                                      )}
                                    </div>
                                    {item.description && (
                                      <p className="text-[11px] text-text-muted mt-1.5 line-clamp-2 leading-relaxed">
                                        {item.description}
                                      </p>
                                    )}
                                  </div>
                                  {/* Actions */}
                                  <div className="flex flex-col gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                      onClick={() =>
                                        setMenuItemModal({ mode: "edit", item })
                                      }
                                      className="p-1.5 rounded-lg bg-surface-container hover:bg-[#F3EFEA] text-[#5C564A] transition-colors cursor-pointer"
                                      title="Edit Menu Item"
                                    >
                                      <span className="material-symbols-outlined text-[14px]">edit</span>
                                    </button>
                                    <button
                                      onClick={() =>
                                        setConfirmModal({
                                          type: "delete_menu_item",
                                          id: item.id,
                                          name: item.name,
                                        })
                                      }
                                      className="p-1.5 rounded-lg bg-surface-container hover:bg-red-50 text-red-500 transition-colors cursor-pointer"
                                      title="Hapus Menu Item"
                                    >
                                      <span className="material-symbols-outlined text-[14px]">delete</span>
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        )}
          </>
        )}
      </main>

      {/* MODAL 1: BATCH GENERATE CARDS (STANDARD) */}
      {showGenerateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface-white rounded-2xl max-w-md w-full p-6 border border-outline-variant shadow-2xl animate-scale-up">
            <h3 className="text-headline-md font-headline-md font-bold text-primary mb-2 flex items-center space-x-2">
              <span className="material-symbols-outlined text-cta-activation">add_circle</span>
              <span>Generate Batch Kartu Ratey</span>
            </h3>

            {newGeneratedCards.length === 0 ? (
              <form onSubmit={handleGenerateCards} className="space-y-4">
                <p className="text-body-sm font-body-sm text-text-muted">
                  Sistem akan membuat ID acak 6 Karakter (misal: <code>3CDRHR</code>) yang siap dipakai klien.
                </p>

                <div>
                  <label className="block text-label-bold font-label-bold text-primary mb-1.5">Jumlah Kartu Ditambahkan</label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={generateCount}
                    onChange={(e) => setGenerateCount(parseInt(e.target.value) || 1)}
                    className="w-full bg-surface border border-outline-variant rounded-xl px-4 py-2.5 text-body-md font-bold text-primary focus:outline-none focus:border-primary"
                  />
                </div>

                <div className="flex justify-end space-x-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowGenerateModal(false)}
                    className="px-4 py-2.5 border border-outline-variant rounded-xl text-on-surface-variant hover:bg-surface-container text-label-bold font-label-bold cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isGenerating}
                    className="px-6 py-2.5 bg-cta-activation text-on-primary rounded-xl font-label-bold text-label-bold hover:brightness-110 transition-all cursor-pointer flex items-center space-x-2"
                  >
                    <span>{isGenerating ? "Proses..." : "Generate Kartu"}</span>
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="p-3 bg-[#DCFCE7] text-[#15803D] rounded-xl text-xs font-bold flex items-center justify-between">
                  <span>✓ Berhasil Generate {newGeneratedCards.length} Kartu Baru</span>
                  <button
                    onClick={downloadAllQr}
                    className="bg-[#15803D] text-white px-3 py-1 rounded-lg text-xs hover:bg-[#166534] transition-all cursor-pointer flex items-center space-x-1"
                  >
                    <span className="material-symbols-outlined text-xs">download</span>
                    <span>Download Semua QR</span>
                  </button>
                </div>

                <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                  {newGeneratedCards.map((item) => (
                    <div key={item.card_id} className="p-2.5 bg-surface border border-outline-variant rounded-xl flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold font-mono text-primary text-sm block">{item.card_id}</span>
                        <span className="text-text-muted font-mono text-[10px]">{item.url}</span>
                      </div>
                      <button
                        onClick={() => downloadSingleQr(item)}
                        className="p-1.5 bg-surface-white border border-outline-variant hover:bg-surface-container rounded-lg text-primary cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-sm">download</span>
                      </button>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => setShowGenerateModal(false)}
                  className="w-full py-2.5 bg-primary text-surface-white font-label-bold rounded-xl text-label-bold hover:bg-black transition-all cursor-pointer"
                >
                  Selesai
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 2: QR CODE PREVIEW */}
      {qrPreviewModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface-white rounded-2xl max-w-sm w-full p-6 border border-outline-variant shadow-2xl text-center animate-scale-up">
            <h3 className="font-bold text-headline-md text-primary mb-1">Barcode QR Kartu</h3>
            <p className="text-xs font-mono text-secondary mb-4">ID: {qrPreviewModal.cardId}</p>

            <div className="bg-white border border-outline-variant p-4 rounded-xl inline-block mb-4">
              <img src={qrPreviewModal.qrDataUrl} alt="QR Code" className="w-56 h-56 mx-auto" />
            </div>

            <p className="text-xs text-text-muted font-mono bg-surface-bright p-2 rounded-lg mb-4 truncate select-all">
              {qrPreviewModal.url}
            </p>

            <div className="flex gap-2">
              <button
                onClick={() => downloadSingleQr({ card_id: qrPreviewModal.cardId, url: qrPreviewModal.url, qrDataUrl: qrPreviewModal.qrDataUrl })}
                className="flex-1 py-2.5 bg-primary text-white rounded-xl text-xs font-bold hover:bg-black transition-colors flex items-center justify-center space-x-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">download</span>
                <span>Unduh PNG</span>
              </button>
              <button
                onClick={() => setQrPreviewModal(null)}
                className="py-2.5 px-4 bg-surface-container border border-outline-variant rounded-xl text-xs font-bold hover:bg-surface-container-high transition-colors cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: CONFIRM RESET / DELETE (CARD + TABLE + CLIENT BATCH + CLIENT) */}
      {confirmModal && (() => {
        // ── Variant-specific render helpers ──
        const isCardReset = confirmModal.type === "reset";
        const isCardDelete = confirmModal.type === "delete";
        const isTableDelete = confirmModal.type === "delete_table";
        const isClientBatch = confirmModal.type === "delete_client_batch";
        const isClientDelete = confirmModal.type === "delete_client";
        const isCatDelete = confirmModal.type === "delete_menu_category";
        const isItemDelete = confirmModal.type === "delete_menu_item";

        const colorDanger = "bg-red-100 text-red-600";
        const colorWarn = "bg-amber-100 text-amber-700";

        let headerColor = colorWarn;
        let icon = "warning";
        let title = "Konfirmasi";
        let description = "";
        let confirmLabel = "Ya, Lanjut";
        let confirmBtnClass = "bg-amber-600 hover:bg-amber-700";
        let confirmAction: (() => void) | null = null;

        if (isCardReset && "cardId" in confirmModal) {
          headerColor = colorWarn;
          icon = "restart_alt";
          title = "Reset Kartu Ini?";
          description = `Status kartu ${confirmModal.cardId} akan dikembalikan ke 'Belum Aktif' dan data bisnis akan dikosongkan.`;
          confirmLabel = "Ya, Reset";
          confirmBtnClass = "bg-amber-600 hover:bg-amber-700";
          confirmAction = () => handleCardAction("reset", confirmModal.cardId);
        } else if (isCardDelete && "cardId" in confirmModal) {
          headerColor = colorDanger;
          icon = "delete_forever";
          title = "Hapus Kartu Ini?";
          description = `Kartu ${confirmModal.cardId} akan dihapus secara permanen dari database.`;
          confirmLabel = "Ya, Hapus";
          confirmBtnClass = "bg-red-600 hover:bg-red-700";
          confirmAction = () => handleCardAction("delete", confirmModal.cardId);
        } else if (isTableDelete && "tableId" in confirmModal) {
          headerColor = colorDanger;
          icon = "delete";
          title = "Hapus Meja Ini?";
          description = `Kode QR Meja ${confirmModal.tableNum} akan dihapus permanen dari database.`;
          confirmLabel = "Ya, Hapus Meja";
          confirmBtnClass = "bg-red-600 hover:bg-red-700";
          confirmAction = () => handleTableQrDelete(confirmModal.tableId);
        } else if (isClientBatch && "clientSlug" in confirmModal) {
          headerColor = colorDanger;
          icon = "delete_sweep";
          title = "Hapus Semua Meja Client Ini?";
          const count = tableQrs.filter((t) => t.client_slug === confirmModal.clientSlug).length;
          description = `Semua ${count} meja untuk client "${confirmModal.clientSlug}" akan dihapus permanen. (Data client di tabel CLIENTS tidak dihapus).`;
          confirmLabel = "Ya, Hapus Meja";
          confirmBtnClass = "bg-red-600 hover:bg-red-700";
          confirmAction = () => handleClientBatchDelete(confirmModal.clientSlug);
        } else if (isClientDelete && "clientSlug" in confirmModal) {
          headerColor = colorDanger;
          icon = "delete_forever";
          title = "HAPUS Client Ini (SEMUA DATA)?";
          const count = tableQrs.filter((t) => t.client_slug === confirmModal.clientSlug).length;
          description = `Client "${confirmModal.clientName}" (slug: ${confirmModal.clientSlug}) dan SEMUA data terkait (${count} meja, menu, kategori) akan dihapus SECARA PERMANEN dari database. TIDAK BISA DIKEMBALIKAN!`;
          confirmLabel = "Ya, Hapus Client & Semua Data";
          confirmBtnClass = "bg-red-700 hover:bg-red-800";
          confirmAction = () => handleClientDelete(confirmModal.clientSlug);
        } else if (isCatDelete && "id" in confirmModal) {
          headerColor = colorDanger;
          icon = "category";
          title = "Hapus Kategori Ini?";
          const totalInCat = menuItems.filter((it) =>
            menuCategories.find((c) => c.id === confirmModal.id)?.key === it.category_key
          ).length;
          description = `Kategori "${confirmModal.label}" akan dihapus. Semua ${totalInCat} menu item di dalamnya AKAN TERHAPUS CASCADE (auto-delete) dari database!`;
          confirmLabel = "Ya, Hapus Kategori + Isinya";
          confirmBtnClass = "bg-red-600 hover:bg-red-700";
          confirmAction = () => handleCategoryDelete();
        } else if (isItemDelete && "id" in confirmModal) {
          headerColor = colorDanger;
          icon = "restaurant";
          title = "Hapus Menu Item Ini?";
          description = `Menu "${confirmModal.name}" akan dihapus permanen dari database.`;
          confirmLabel = "Ya, Hapus Item Menu";
          confirmBtnClass = "bg-red-600 hover:bg-red-700";
          confirmAction = () => handleMenuItemDelete();
        }

        return (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-surface-white rounded-2xl max-w-sm w-full p-6 border border-outline-variant shadow-2xl animate-scale-up text-center">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 ${headerColor}`}>
                <span className="material-symbols-outlined text-2xl">{icon}</span>
              </div>
              <h3 className="font-bold text-headline-md text-primary mb-1">{title}</h3>
              <p className="text-body-sm font-body-sm text-text-muted mb-6">{description}</p>

              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmModal(null)}
                  className="flex-1 py-2.5 border border-outline-variant rounded-xl text-on-surface-variant font-label-bold text-label-bold hover:bg-surface-container cursor-pointer"
                >
                  Batal
                </button>
                <button
                  onClick={() => confirmAction && confirmAction()}
                  className={`flex-1 py-2.5 text-white rounded-xl font-label-bold text-label-bold cursor-pointer ${confirmBtnClass}`}
                >
                  {confirmLabel}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL 4: TABLE QR PREVIEW */}
      {tableQrPreview && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface-white rounded-2xl max-w-sm w-full p-6 border border-outline-variant shadow-2xl text-center animate-scale-up">
            <h3 className="font-bold text-headline-md text-primary mb-1">Barcode QR Meja</h3>
            <p className="text-xs font-mono text-secondary mb-4">
              Client: {tableQrPreview.clientSlug} · Meja {tableQrPreview.tableNum}
            </p>

            <div className="bg-white border border-outline-variant p-4 rounded-xl inline-block mb-4">
              <img src={tableQrPreview.qrDataUrl} alt="QR Code Table" className="w-56 h-56 mx-auto" />
            </div>

            <p className="text-xs text-text-muted font-mono bg-surface-bright p-2 rounded-lg mb-4 truncate select-all">
              {tableQrPreview.url}
            </p>

            <div className="flex gap-2">
              <button
                onClick={() =>
                  downloadSingleTableQr(
                    {
                      tableNum: tableQrPreview.tableNum,
                      url: tableQrPreview.url,
                      qrDataUrl: tableQrPreview.qrDataUrl,
                    },
                    tableQrPreview.clientSlug
                  )
                }
                className="flex-1 py-2.5 bg-primary text-white rounded-xl text-xs font-bold hover:bg-black transition-colors flex items-center justify-center gap-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">download</span>
                <span>Unduh PNG</span>
              </button>
              <button
                onClick={() => setTableQrPreview(null)}
                className="py-2.5 px-4 bg-surface-container border border-outline-variant rounded-xl text-xs font-bold hover:bg-surface-container-high transition-colors cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: CLIENT CREATE / EDIT FORM */}
      {clientModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-start sm:items-center justify-center p-4 overflow-y-auto">
          <div className="bg-surface-white rounded-2xl max-w-2xl w-full my-8 border border-outline-variant shadow-2xl animate-scale-up flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-6 pb-4 border-b border-outline-variant">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary-container text-primary flex items-center justify-center">
                    <span className="material-symbols-outlined">storefront</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-headline-md text-primary">
                      {clientModal.mode === "create" ? "✨ Buat Client Baru" : "✏️ Edit Client"}
                    </h3>
                    <p className="text-body-sm font-body-sm text-text-muted">
                      {clientModal.mode === "create"
                        ? "Isi data client untuk template all-in-one (menu + wifi + rating)"
                        : `Update data ${clientFormValue.business_name || "client"}`}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setClientModal(null)}
                  disabled={isClientSubmitting}
                  className="w-9 h-9 rounded-lg hover:bg-surface-container flex items-center justify-center disabled:opacity-50 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-text-muted">close</span>
                </button>
              </div>
            </div>

            {/* Modal Body (Scrollable) */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* SECTION 1: DATA DASAR */}
              <div>
                <h4 className="text-xs font-bold text-secondary uppercase tracking-wider mb-3 flex items-center gap-2">
                  <span className="w-1 h-4 bg-secondary rounded-full" />
                  Data Dasar
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-on-surface-variant mb-1.5">
                      Slug URL <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="text"
                      value={clientFormValue.slug}
                      onChange={(e) =>
                        setClientFormValue({
                          ...clientFormValue,
                          slug: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 40),
                        })
                      }
                      placeholder="contoh: tammmu, kopi-ken"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-outline-variant bg-surface text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-mono text-sm disabled:opacity-60"
                      disabled={clientModal.mode === "edit" || isClientSubmitting}
                    />
                    <p className="text-[11px] text-text-muted mt-1">Hanya huruf kecil, angka, -, _ (maks 40 char)</p>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-on-surface-variant mb-1.5">
                      Nama Bisnis <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="text"
                      value={clientFormValue.business_name}
                      onChange={(e) => setClientFormValue({ ...clientFormValue, business_name: e.target.value })}
                      placeholder="Contoh: Tammmu Coffee & Eatery"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-outline-variant bg-surface text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-sm disabled:opacity-60"
                      disabled={isClientSubmitting}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-on-surface-variant mb-1.5">Status</label>
                    <select
                      value={clientFormValue.status}
                      onChange={(e) => setClientFormValue({ ...clientFormValue, status: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-outline-variant bg-surface text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-sm cursor-pointer disabled:opacity-60"
                      disabled={isClientSubmitting}
                    >
                      <option value="active">🟢 Aktif</option>
                      <option value="draft">📝 Draft</option>
                      <option value="inactive">⚪ Nonaktif</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-on-surface-variant mb-1.5">Template</label>
                    <select
                      value={clientFormValue.template_key}
                      onChange={(e) => setClientFormValue({ ...clientFormValue, template_key: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-outline-variant bg-surface text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-sm cursor-pointer disabled:opacity-60"
                      disabled={isClientSubmitting}
                    >
                      <option value="tammmu_v1">Tammmu v1 · Minimalis Warm</option>
                    </select>
                    <p className="text-[11px] text-text-muted mt-1">Template lain menyusul ya!</p>
                  </div>
                </div>
              </div>

              {/* SECTION 2: BRANDING & TEMA */}
              <div>
                <h4 className="text-xs font-bold text-secondary uppercase tracking-wider mb-3 flex items-center gap-2">
                  <span className="w-1 h-4 bg-secondary rounded-full" />
                  Branding & Tema
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-on-surface-variant mb-1.5">Tagline</label>
                    <input
                      type="text"
                      value={clientFormValue.tagline}
                      onChange={(e) => setClientFormValue({ ...clientFormValue, tagline: e.target.value })}
                      placeholder="Contoh: Nongkrong Asik, Makan Enak"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-outline-variant bg-surface text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-sm disabled:opacity-60"
                      disabled={isClientSubmitting}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-on-surface-variant mb-1.5">Jam Operasional</label>
                    <input
                      type="text"
                      value={clientFormValue.operating_hours}
                      onChange={(e) => setClientFormValue({ ...clientFormValue, operating_hours: e.target.value })}
                      placeholder="Contoh: Senin - Minggu · 07:00 - 22:00"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-outline-variant bg-surface text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-sm disabled:opacity-60"
                      disabled={isClientSubmitting}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    {renderUploadField({
                      scope: "client_logo",
                      folder: clientFormValue.slug || "clients",
                      url: clientFormValue.logo_url,
                      setUrl: (v) => setClientFormValue({ ...clientFormValue, logo_url: v }),
                      label: "Logo Bisnis",
                      placeholder: "atau paste URL manual: https://.../logo.png",
                      hint: "Disarankan PNG transparan, minimal 512x512px. Boleh kosong (pakai icon default).",
                    })}
                  </div>
                  <div className="sm:col-span-2">
                    {renderUploadField({
                      scope: "client_cover",
                      folder: clientFormValue.slug || "clients",
                      url: clientFormValue.cover_mobile_url,
                      setUrl: (v) => setClientFormValue({ ...clientFormValue, cover_mobile_url: v }),
                      label: "Cover Mobile (Hero Banner)",
                      placeholder: "atau paste URL manual: https://.../cover.jpg",
                      hint: "Banner atas halaman menu. Rekomendasi portrait 9:16, minimal 1080px tinggi.",
                    })}
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-on-surface-variant mb-1.5">Alamat</label>
                    <textarea
                      value={clientFormValue.address}
                      onChange={(e) => setClientFormValue({ ...clientFormValue, address: e.target.value })}
                      placeholder="Alamat lengkap tempat usaha"
                      rows={2}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-outline-variant bg-surface text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-sm resize-none disabled:opacity-60"
                      disabled={isClientSubmitting}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-on-surface-variant mb-1.5 flex items-center justify-between">
                      <span>Warna Accent</span>
                      <span className="font-mono text-[10px] text-text-muted">{clientFormValue.theme_accent}</span>
                    </label>
                    <div className="flex gap-2 items-center">
                      <input
                        type="color"
                        value={clientFormValue.theme_accent}
                        onChange={(e) => setClientFormValue({ ...clientFormValue, theme_accent: e.target.value })}
                        className="w-12 h-10 rounded-lg border border-outline-variant bg-surface cursor-pointer p-1 disabled:opacity-60"
                        disabled={isClientSubmitting}
                      />
                      <input
                        type="text"
                        value={clientFormValue.theme_accent}
                        onChange={(e) => setClientFormValue({ ...clientFormValue, theme_accent: e.target.value })}
                        className="flex-1 px-3 py-2 rounded-lg border border-outline-variant bg-surface text-on-surface focus:outline-none focus:border-primary text-sm font-mono disabled:opacity-60"
                        disabled={isClientSubmitting}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-on-surface-variant mb-1.5 flex items-center justify-between">
                      <span>Warna Background</span>
                      <span className="font-mono text-[10px] text-text-muted">{clientFormValue.theme_bg}</span>
                    </label>
                    <div className="flex gap-2 items-center">
                      <input
                        type="color"
                        value={clientFormValue.theme_bg}
                        onChange={(e) => setClientFormValue({ ...clientFormValue, theme_bg: e.target.value })}
                        className="w-12 h-10 rounded-lg border border-outline-variant bg-surface cursor-pointer p-1 disabled:opacity-60"
                        disabled={isClientSubmitting}
                      />
                      <input
                        type="text"
                        value={clientFormValue.theme_bg}
                        onChange={(e) => setClientFormValue({ ...clientFormValue, theme_bg: e.target.value })}
                        className="flex-1 px-3 py-2 rounded-lg border border-outline-variant bg-surface text-on-surface focus:outline-none focus:border-primary text-sm font-mono disabled:opacity-60"
                        disabled={isClientSubmitting}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 3: WIFI */}
              <div>
                <h4 className="text-xs font-bold text-secondary uppercase tracking-wider mb-3 flex items-center gap-2">
                  <span className="w-1 h-4 bg-secondary rounded-full" />
                  WiFi
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-on-surface-variant mb-1.5">SSID WiFi</label>
                    <div className="relative">
                      <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted text-lg">wifi</span>
                      <input
                        type="text"
                        value={clientFormValue.wifi_ssid}
                        onChange={(e) => setClientFormValue({ ...clientFormValue, wifi_ssid: e.target.value })}
                        placeholder="Nama jaringan WiFi"
                        className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-outline-variant bg-surface text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-sm disabled:opacity-60"
                        disabled={isClientSubmitting}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-on-surface-variant mb-1.5">Password WiFi</label>
                    <div className="relative">
                      <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted text-lg">key</span>
                      <input
                        type="text"
                        value={clientFormValue.wifi_password}
                        onChange={(e) => setClientFormValue({ ...clientFormValue, wifi_password: e.target.value })}
                        placeholder="Password WiFi"
                        className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-outline-variant bg-surface text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-sm disabled:opacity-60"
                        disabled={isClientSubmitting}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 4: GOOGLE REVIEW & RATING */}
              <div>
                <h4 className="text-xs font-bold text-secondary uppercase tracking-wider mb-3 flex items-center gap-2">
                  <span className="w-1 h-4 bg-secondary rounded-full" />
                  Google Review & Rating
                </h4>
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-on-surface-variant mb-1.5">Google Place ID</label>
                    <div className="relative">
                      <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted text-lg">pin_drop</span>
                      <input
                        type="text"
                        value={clientFormValue.google_place_id}
                        onChange={(e) => setClientFormValue({ ...clientFormValue, google_place_id: e.target.value })}
                        placeholder="ChIJacWFN5b71y0REVY5OeZhL70 (dari Google Maps Places API)"
                        className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-outline-variant bg-surface text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-sm font-mono disabled:opacity-60"
                        disabled={isClientSubmitting}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-on-surface-variant mb-1.5">URL Review Google Maps (Alternatif)</label>
                    <div className="relative">
                      <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted text-lg">rate_review</span>
                      <input
                        type="url"
                        value={clientFormValue.google_review_url}
                        onChange={(e) => setClientFormValue({ ...clientFormValue, google_review_url: e.target.value })}
                        placeholder="https://search.google.com/local/writereview?... (jika tidak pakai Place ID)"
                        className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-outline-variant bg-surface text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-sm font-mono disabled:opacity-60"
                        disabled={isClientSubmitting}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 5: SOSIAL MEDIA */}
              <div>
                <h4 className="text-xs font-bold text-secondary uppercase tracking-wider mb-3 flex items-center gap-2">
                  <span className="w-1 h-4 bg-secondary rounded-full" />
                  Sosial Media & Kontak
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-on-surface-variant mb-1.5">Instagram URL</label>
                    <input
                      type="url"
                      value={clientFormValue.instagram_url}
                      onChange={(e) => setClientFormValue({ ...clientFormValue, instagram_url: e.target.value })}
                      placeholder="https://instagram.com/tammmu.id"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-outline-variant bg-surface text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-sm font-mono disabled:opacity-60"
                      disabled={isClientSubmitting}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-on-surface-variant mb-1.5">WhatsApp URL (WA.ME)</label>
                    <input
                      type="url"
                      value={clientFormValue.whatsapp_url}
                      onChange={(e) => setClientFormValue({ ...clientFormValue, whatsapp_url: e.target.value })}
                      placeholder="https://wa.me/6281234567890"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-outline-variant bg-surface text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-sm font-mono disabled:opacity-60"
                      disabled={isClientSubmitting}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 pt-4 border-t border-outline-variant flex flex-col sm:flex-row gap-3 sm:justify-end">
              <button
                type="button"
                onClick={() => setClientModal(null)}
                disabled={isClientSubmitting}
                className="px-5 py-2.5 border border-outline-variant rounded-xl text-on-surface-variant font-label-bold hover:bg-surface-container transition-all disabled:opacity-50 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!clientFormValue.slug.trim() || !clientFormValue.business_name.trim()) {
                    alert("Slug dan Nama Bisnis wajib diisi!");
                    return;
                  }
                  const slugOrig = clientModal.mode === "edit" ? clientModal.client.slug : undefined;
                  await handleClientFormSubmit(clientModal.mode, clientFormValue, slugOrig);
                }}
                disabled={isClientSubmitting}
                className="px-6 py-2.5 bg-primary text-white rounded-xl font-label-bold hover:bg-black transition-all disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer"
              >
                {isClientSubmitting ? (
                  <>
                    <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-sm">save</span>
                    <span>{clientModal.mode === "create" ? "Buat Client" : "Simpan Perubahan"}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 6: CREATE/EDIT CATEGORY FORM */}
      {categoryModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface-white rounded-2xl max-w-md w-full border border-outline-variant shadow-2xl animate-scale-up overflow-hidden">
            {/* Header */}
            <div className="px-6 py-5 border-b border-outline-variant bg-surface-bright/40">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-[#F3EFEA] text-[#3C3833] border border-[#E8E3DA] flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[22px]">category</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-headline-md text-primary">
                      {categoryModal.mode === "create" ? "Buat Kategori Baru" : "Edit Kategori"}
                    </h3>
                    <p className="text-xs text-text-muted mt-0.5">
                      {categoryModal.mode === "create"
                        ? `Tambahkan kategori baru untuk client ${menuEditorClient?.business_name || ""}`
                        : `Update informasi kategori menu`}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setCategoryModal(null)}
                  disabled={isMenuSubmitting}
                  className="w-9 h-9 rounded-lg hover:bg-surface-container flex items-center justify-center disabled:opacity-50 cursor-pointer shrink-0"
                >
                  <span className="material-symbols-outlined text-text-muted">close</span>
                </button>
              </div>
            </div>

            {/* Body Form */}
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-primary mb-1.5">
                    Key (Slug) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={categoryFormValue.key}
                    onChange={(e) =>
                      setCategoryFormValue({
                        ...categoryFormValue,
                        key: e.target.value
                          .toLowerCase()
                          .replace(/[^a-z0-9_-]/g, "")
                          .slice(0, 30),
                      })
                    }
                    placeholder="contoh: beverages"
                    disabled={categoryModal.mode === "edit" || isMenuSubmitting}
                    className="w-full bg-surface border border-outline-variant rounded-xl px-4 py-2.5 text-sm font-bold text-primary placeholder:text-text-muted focus:outline-none focus:border-primary disabled:bg-surface-container disabled:text-text-muted font-mono"
                  />
                  <p className="text-[10px] text-text-muted mt-1 leading-relaxed">
                    Huruf kecil, tanpa spasi. Contoh: <code>beverages</code>, <code>mains</code>, <code>desserts</code>
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-bold text-primary mb-1.5">
                    Sort Order <span className="text-text-muted font-normal">(urutan tampil)</span>
                  </label>
                  <input
                    type="number"
                    value={categoryFormValue.sort_order}
                    onChange={(e) =>
                      setCategoryFormValue({ ...categoryFormValue, sort_order: e.target.value })
                    }
                    placeholder="0"
                    disabled={isMenuSubmitting}
                    className="w-full bg-surface border border-outline-variant rounded-xl px-4 py-2.5 text-sm font-bold text-primary placeholder:text-text-muted focus:outline-none focus:border-primary disabled:opacity-70"
                  />
                  <p className="text-[10px] text-text-muted mt-1 leading-relaxed">
                    Angka kecil = tampil di atas. Default: 0
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-primary mb-1.5">
                  Label / Nama Kategori <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={categoryFormValue.label}
                  onChange={(e) =>
                    setCategoryFormValue({ ...categoryFormValue, label: e.target.value.slice(0, 50) })
                  }
                  onBlur={() => {
                    if (!categoryFormValue.key.trim() && categoryFormValue.label.trim()) {
                      setCategoryFormValue({
                        ...categoryFormValue,
                        key: categoryFormValue.label
                          .toLowerCase()
                          .replace(/\s+/g, "_")
                          .replace(/[^a-z0-9_-]/g, "")
                          .slice(0, 30),
                      });
                    }
                  }}
                  placeholder="contoh: Coffee & Drinks"
                  disabled={isMenuSubmitting}
                  className="w-full bg-surface border border-outline-variant rounded-xl px-4 py-2.5 text-sm font-bold text-primary placeholder:text-text-muted focus:outline-none focus:border-primary disabled:opacity-70"
                />
                <p className="text-[10px] text-text-muted mt-1 leading-relaxed">
                  Nama kategori yang tampil ke pelanggan (bisa pakai spasi & simbol).
                </p>
              </div>

              <div className="p-3 rounded-xl bg-primary/[0.03] border border-primary/10 space-y-1.5">
                <p className="text-[11px] font-bold text-primary flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[14px]">info</span>
                  <span>Info Penting</span>
                </p>
                <ul className="space-y-1">
                  <li className="text-[10.5px] text-text-muted leading-relaxed">
                    • <span className="font-bold text-primary">Key kategori tidak bisa diubah</span> setelah dibuat (untuk konsistensi relasi DB).
                  </li>
                  <li className="text-[10.5px] text-text-muted leading-relaxed">
                    • Menghapus kategori akan <span className="font-bold text-red-500">OTOMATIS MENGHAPUS SEMUA MENU</span> di dalamnya (Cascade Delete).
                  </li>
                </ul>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 pt-4 border-t border-outline-variant flex flex-col sm:flex-row gap-3 sm:justify-end bg-surface-bright/20">
              <button
                type="button"
                onClick={() => setCategoryModal(null)}
                disabled={isMenuSubmitting}
                className="px-5 py-2.5 border border-outline-variant rounded-xl text-on-surface-variant font-label-bold text-sm hover:bg-surface-container transition-all disabled:opacity-50 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => handleCategorySubmit(categoryModal.mode, categoryFormValue)}
                disabled={isMenuSubmitting}
                className="px-6 py-2.5 bg-primary text-white rounded-xl font-label-bold text-sm hover:bg-black transition-all disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer"
              >
                {isMenuSubmitting ? (
                  <>
                    <span className="material-symbols-outlined animate-spin text-[15px]">progress_activity</span>
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[15px]">save</span>
                    <span>{categoryModal.mode === "create" ? "Buat Kategori" : "Simpan Perubahan"}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 7: CREATE/EDIT MENU ITEM FORM (11 Fields) */}
      {menuItemModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-surface-white rounded-2xl max-w-2xl w-full border border-outline-variant shadow-2xl animate-scale-up overflow-hidden my-6">
            {/* Header */}
            <div className="px-6 py-5 border-b border-outline-variant bg-gradient-to-r from-[#F0FDF4]/60 to-white sticky top-0 z-10">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-xl bg-emerald-100 text-emerald-700 border border-emerald-200 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[22px]">restaurant_menu</span>
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-headline-md text-primary truncate">
                      {menuItemModal.mode === "create" ? "Tambah Menu Item Baru" : "Edit Menu Item"}
                    </h3>
                    <p className="text-xs text-text-muted mt-0.5 truncate">
                      {menuItemModal.mode === "create"
                        ? `Tambahkan item menu baru ke ${menuEditorClient?.business_name || ""}`
                        : `Update detail menu item`}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setMenuItemModal(null)}
                  disabled={isMenuSubmitting}
                  className="w-9 h-9 rounded-lg hover:bg-surface-container flex items-center justify-center disabled:opacity-50 cursor-pointer shrink-0"
                >
                  <span className="material-symbols-outlined text-text-muted">close</span>
                </button>
              </div>
            </div>

            {/* Body Form */}
            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto pr-2">
              {/* ── Section 1: Data Dasar ── */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-5 rounded-full bg-emerald-500" />
                  <h4 className="font-bold text-label-lg text-primary uppercase tracking-wide">Data Dasar</h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-primary mb-1.5">
                      Nama Menu <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={menuItemFormValue.name}
                      onChange={(e) =>
                        setMenuItemFormValue({ ...menuItemFormValue, name: e.target.value.slice(0, 100) })
                      }
                      onBlur={() => {
                        if (!menuItemFormValue.search_key.trim() && menuItemFormValue.name.trim()) {
                          setMenuItemFormValue({
                            ...menuItemFormValue,
                            search_key: menuItemFormValue.name.toLowerCase(),
                          });
                        }
                      }}
                      placeholder="contoh: Es Kopi Susu Gula Aren"
                      disabled={isMenuSubmitting}
                      className="w-full bg-surface border border-outline-variant rounded-xl px-4 py-2.5 text-sm font-bold text-primary placeholder:text-text-muted focus:outline-none focus:border-primary disabled:opacity-70"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-primary mb-1.5">
                      Kategori <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={menuItemFormValue.category_key}
                      onChange={(e) =>
                        setMenuItemFormValue({ ...menuItemFormValue, category_key: e.target.value })
                      }
                      disabled={isMenuSubmitting}
                      className="w-full bg-surface border border-outline-variant rounded-xl px-4 py-2.5 text-sm font-bold text-primary focus:outline-none focus:border-primary disabled:opacity-70 appearance-none cursor-pointer"
                    >
                      <option value="">-- Pilih Kategori --</option>
                      {menuCategories
                        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
                        .map((c) => (
                          <option key={c.id} value={c.key}>
                            {c.label}
                          </option>
                        ))}
                    </select>
                    {menuCategories.length === 0 && (
                      <p className="text-[10px] text-red-500 mt-1 font-bold">
                        ⚠ Belum ada kategori. Buat kategori terlebih dahulu!
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-primary mb-1.5">
                      Sort Order <span className="text-text-muted font-normal">(urutan)</span>
                    </label>
                    <input
                      type="number"
                      value={menuItemFormValue.sort_order}
                      onChange={(e) =>
                        setMenuItemFormValue({ ...menuItemFormValue, sort_order: e.target.value })
                      }
                      placeholder="Featured = 0-9, Text = 20+"
                      disabled={isMenuSubmitting}
                      className="w-full bg-surface border border-outline-variant rounded-xl px-4 py-2.5 text-sm font-bold text-primary placeholder:text-text-muted focus:outline-none focus:border-primary disabled:opacity-70"
                    />
                  </div>
                </div>
              </div>

              {/* ── Section 2: Harga ── */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-5 rounded-full bg-blue-500" />
                  <h4 className="font-bold text-label-lg text-primary uppercase tracking-wide">Harga</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-primary mb-1.5">
                      Label Harga <span className="text-red-500">*</span>{" "}
                      <span className="text-text-muted font-normal">(tampil ke user)</span>
                    </label>
                    <input
                      type="text"
                      value={menuItemFormValue.price_label}
                      onChange={(e) =>
                        setMenuItemFormValue({ ...menuItemFormValue, price_label: e.target.value.slice(0, 15) })
                      }
                      placeholder="contoh: 28K, Rp 25.000, FREE"
                      disabled={isMenuSubmitting}
                      className="w-full bg-surface border border-outline-variant rounded-xl px-4 py-2.5 text-sm font-bold text-primary placeholder:text-text-muted focus:outline-none focus:border-primary disabled:opacity-70 font-mono"
                    />
                    <p className="text-[10px] text-text-muted mt-1">
                      Contoh format: <code>28K</code>, <code>Rp 25k</code>, <code>FREE</code>
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-primary mb-1.5">
                      Harga Angka (Integer){" "}
                      <span className="text-text-muted font-normal">(untuk filter/sort)</span>
                    </label>
                    <input
                      type="text"
                      value={menuItemFormValue.price_num}
                      onChange={(e) =>
                        setMenuItemFormValue({
                          ...menuItemFormValue,
                          price_num: e.target.value.replace(/[^0-9]/g, "").slice(0, 10),
                        })
                      }
                      placeholder="contoh: 28000"
                      disabled={isMenuSubmitting}
                      className="w-full bg-surface border border-outline-variant rounded-xl px-4 py-2.5 text-sm font-bold text-primary placeholder:text-text-muted focus:outline-none focus:border-primary disabled:opacity-70 font-mono"
                    />
                    <p className="text-[10px] text-text-muted mt-1">
                      Hanya angka, tanpa titik/koma. Contoh: <code>28000</code>
                    </p>
                  </div>
                </div>
              </div>

              {/* ── Section 3: Deskripsi & Media ── */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-5 rounded-full bg-purple-500" />
                  <h4 className="font-bold text-label-lg text-primary uppercase tracking-wide">Deskripsi & Foto</h4>
                </div>
                <div>
                  <label className="block text-xs font-bold text-primary mb-1.5">Deskripsi Menu</label>
                  <textarea
                    value={menuItemFormValue.description}
                    onChange={(e) =>
                      setMenuItemFormValue({ ...menuItemFormValue, description: e.target.value.slice(0, 400) })
                    }
                    placeholder="Komposisi, tingkat kepedasan, bahan utama, catatan alergi, dll."
                    rows={3}
                    disabled={isMenuSubmitting}
                    className="w-full bg-surface border border-outline-variant rounded-xl px-4 py-2.5 text-sm font-bold text-primary placeholder:text-text-muted focus:outline-none focus:border-primary disabled:opacity-70 resize-none"
                  />
                  <p className="text-[10px] text-text-muted mt-1 text-right">
                    {menuItemFormValue.description.length}/400 karakter
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-bold text-primary mb-1.5">
                    URL Foto Menu{" "}
                    <span className="text-text-muted font-normal">(https://... .jpg/.png)</span>
                  </label>
                  <input
                    type="url"
                    value={menuItemFormValue.image_url}
                    onChange={(e) =>
                      setMenuItemFormValue({ ...menuItemFormValue, image_url: e.target.value.slice(0, 500) })
                    }
                    placeholder="https://example.com/foto-nasi-goreng.jpg"
                    disabled={isMenuSubmitting}
                    className="w-full bg-surface border border-outline-variant rounded-xl px-4 py-2.5 text-sm font-bold text-primary placeholder:text-text-muted focus:outline-none focus:border-primary disabled:opacity-70 font-mono"
                  />
                  {menuItemFormValue.image_url && (
                    <div className="mt-2 flex items-start gap-3 p-3 rounded-xl bg-surface-container border border-outline-variant">
                      <img
                        src={menuItemFormValue.image_url}
                        alt="Preview"
                        className="w-16 h-16 rounded-lg object-cover border border-outline-variant bg-[#F3EFEA] shrink-0"
                        onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
                      />
                      <div className="text-[10.5px] text-text-muted leading-relaxed">
                        <p className="font-bold text-primary mb-0.5">📸 Preview Foto</p>
                        Jika foto tidak muncul, periksa kembali URL pastikan direct link image (bukan halaman web).
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* ── Section 4: Branding & Badge ── */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-5 rounded-full bg-amber-500" />
                  <h4 className="font-bold text-label-lg text-primary uppercase tracking-wide">Badge & Featured</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-primary mb-1.5">
                      Badge Label{" "}
                      <span className="text-text-muted font-normal">(tampil chip kecil)</span>
                    </label>
                    <input
                      type="text"
                      value={menuItemFormValue.badge}
                      onChange={(e) =>
                        setMenuItemFormValue({ ...menuItemFormValue, badge: e.target.value.slice(0, 20) })
                      }
                      placeholder="contoh: Bestseller, New, Promo, Limited"
                      disabled={isMenuSubmitting}
                      className="w-full bg-surface border border-outline-variant rounded-xl px-4 py-2.5 text-sm font-bold text-primary placeholder:text-text-muted focus:outline-none focus:border-primary disabled:opacity-70"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-primary mb-1.5">
                      Search Key{" "}
                      <span className="text-text-muted font-normal">(keyword pencarian)</span>
                    </label>
                    <input
                      type="text"
                      value={menuItemFormValue.search_key}
                      onChange={(e) =>
                        setMenuItemFormValue({ ...menuItemFormValue, search_key: e.target.value.toLowerCase().slice(0, 100) })
                      }
                      placeholder="auto-dari nama, tambah sinonim: kopi,coffee,susu"
                      disabled={isMenuSubmitting}
                      className="w-full bg-surface border border-outline-variant rounded-xl px-4 py-2.5 text-sm font-bold text-primary placeholder:text-text-muted focus:outline-none focus:border-primary disabled:opacity-70 font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* ── Section 5: Status & Flags ── */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-5 rounded-full bg-secondary" />
                  <h4 className="font-bold text-label-lg text-primary uppercase tracking-wide">Status Menu</h4>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all select-none ${
                    menuItemFormValue.is_featured
                      ? "border-amber-400 bg-amber-50/60"
                      : "border-outline-variant bg-surface hover:border-outline-variant/80"
                  }`}>
                    <input
                      type="checkbox"
                      checked={menuItemFormValue.is_featured}
                      onChange={(e) =>
                        setMenuItemFormValue({ ...menuItemFormValue, is_featured: e.target.checked })
                      }
                      disabled={isMenuSubmitting}
                      className="w-5 h-5 rounded-md accent-amber-500 cursor-pointer shrink-0"
                    />
                    <div>
                      <p className="font-bold text-sm text-primary flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[16px] text-amber-500">star</span>
                        ⭐ Featured
                      </p>
                      <p className="text-[10.5px] text-text-muted leading-relaxed mt-0.5">
                        Tampil di ATAS section (grid 2 kolom BESAR dengan foto). Cocok untuk menu unggulan.
                      </p>
                    </div>
                  </label>
                  <label className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all select-none ${
                    menuItemFormValue.active
                      ? "border-emerald-400 bg-emerald-50/60"
                      : "border-outline-variant bg-surface hover:border-outline-variant/80"
                  }`}>
                    <input
                      type="checkbox"
                      checked={menuItemFormValue.active}
                      onChange={(e) =>
                        setMenuItemFormValue({ ...menuItemFormValue, active: e.target.checked })
                      }
                      disabled={isMenuSubmitting}
                      className="w-5 h-5 rounded-md accent-emerald-500 cursor-pointer shrink-0"
                    />
                    <div>
                      <p className="font-bold text-sm text-primary flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[16px] text-emerald-500">check_circle</span>
                        ✅ Aktif Ditampilkan
                      </p>
                      <p className="text-[10.5px] text-text-muted leading-relaxed mt-0.5">
                        Non-aktifkan (OFF) untuk sembunyikan menu dari pelanggan tanpa hapus data.
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 pt-4 border-t border-outline-variant flex flex-col sm:flex-row gap-3 sm:justify-between sm:items-center bg-surface-bright/30 sticky bottom-0 z-10">
              <p className="text-[10.5px] text-text-muted font-mono order-2 sm:order-1">
                Client: {menuEditorClient?.slug} • Mode: {menuItemModal.mode.toUpperCase()}
              </p>
              <div className="flex gap-3 order-1 sm:order-2">
                <button
                  type="button"
                  onClick={() => setMenuItemModal(null)}
                  disabled={isMenuSubmitting}
                  className="px-5 py-2.5 border border-outline-variant rounded-xl text-on-surface-variant font-label-bold text-sm hover:bg-surface-container transition-all disabled:opacity-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => handleMenuItemSubmit(menuItemModal.mode, menuItemFormValue)}
                  disabled={isMenuSubmitting || menuCategories.length === 0}
                  className="px-6 py-2.5 bg-primary text-white rounded-xl font-label-bold text-sm hover:bg-black transition-all disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                >
                  {isMenuSubmitting ? (
                    <>
                      <span className="material-symbols-outlined animate-spin text-[15px]">progress_activity</span>
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[15px]">save</span>
                      <span>
                        {menuItemModal.mode === "create" ? "Simpan Menu Baru" : "Update Menu"}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
