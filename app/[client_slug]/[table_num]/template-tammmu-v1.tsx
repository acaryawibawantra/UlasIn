"use client";

import React, { useState, useEffect } from "react";

/* ─── Types for Dinamic Template Data ─── */
type ClientBranding = {
  slug: string;
  business_name: string;
  logo_url?: string | null;
  cover_mobile_url?: string | null;
  theme_accent?: string | null;
  theme_bg?: string | null;
  tagline?: string | null;
  operating_hours?: string | null;
  wifi_ssid?: string | null;
  wifi_password?: string | null;
  google_place_id?: string | null;
  google_review_url?: string | null;
  address?: string | null;
  instagram_url?: string | null;
  whatsapp_url?: string | null;
};

type MenuCategory = {
  key: string;
  label: string;
  sort_order: number;
};

type MenuItem = {
  id: number;
  name: string;
  category_key: string;
  price_label: string;
  price_num?: number | null;
  description?: string | null;
  image_url?: string | null;
  badge?: string | null;
  is_featured: boolean;
  search_key?: string | null;
};

type Props = {
  client: ClientBranding;
  categories: MenuCategory[];
  items: MenuItem[];
  tableNum: string;
};

const DEFAULT_ACCENT = "#3C3833";
const DEFAULT_BG = "#FAF8F5";
const DEFAULT_TEXT_ON_BG = "#3C3833";
const DEFAULT_MUTED = "#8E897C";
const DEFAULT_BORDER = "#E8E3DA";
const DEFAULT_BG_ALT = "#F3EFEA";

function buildGoogleReviewUrl(placeId?: string | null, directUrl?: string | null) {
  if (directUrl) return directUrl;
  if (placeId)
    return `https://search.google.com/local/writereview?placeid=${encodeURIComponent(placeId)}`;
  return "#";
}

function formatPriceNum(num: number | null | undefined): string {
  if (!num) return "";
  return `Rp ${num.toLocaleString("id-ID")}`;
}

/* ─── Main Template Component ─── */
export default function TemplateTammmuV1({ client, categories, items, tableNum }: Props) {
  /* ── Theme constants resolved from client data ── */
  const accent = client.theme_accent || DEFAULT_ACCENT;
  const bg = client.theme_bg || DEFAULT_BG;
  const onBg = DEFAULT_TEXT_ON_BG;
  const muted = DEFAULT_MUTED;
  const border = DEFAULT_BORDER;
  const bgAlt = DEFAULT_BG_ALT;

  /* ── URLs & assets ── */
  const reviewUrl = buildGoogleReviewUrl(client.google_place_id, client.google_review_url);
  const wifiPass = client.wifi_password || "";
  const wifiSsid = client.wifi_ssid || `${client.business_name}_Guest`;
  const hasWifi = !!(wifiPass || client.wifi_ssid);
  const hasReview = reviewUrl !== "#";

  /* ── Build unified product-like items ── */
  const catMap = new Map(categories.map((c) => [c.key, c.label]));
  const products = items.map((m) => {
    const searchBase = `${m.name} ${m.description || ""} ${catMap.get(m.category_key) || ""} ${m.badge || ""}`.toLowerCase();
    return {
      id: String(m.id),
      name: m.name,
      category: m.category_key,
      categoryLabel: catMap.get(m.category_key) || "Menu",
      price: m.price_label,
      priceNum: m.price_num ? formatPriceNum(m.price_num) : m.price_label,
      description: m.description || "",
      image: m.image_url || undefined,
      badge: m.badge || undefined,
      is_featured: m.is_featured,
      searchKey: m.search_key || searchBase,
    };
  });

  /* ── States ── */
  const [isCoverVisible, setIsCoverVisible] = useState(!!client.cover_mobile_url);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedWifi, setCopiedWifi] = useState(false);
  const [waiterCalled, setWaiterCalled] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<(typeof products)[number] | null>(null);

  /* ── Helpers ── */
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2800);
  };

  const dismissCover = () => {
    if (isFadingOut || !isCoverVisible) return;
    setIsFadingOut(true);
    setTimeout(() => setIsCoverVisible(false), 600);
  };

  useEffect(() => {
    const handler = () => {
      if (isCoverVisible && !isFadingOut) dismissCover();
    };
    window.addEventListener("wheel", handler, { passive: true });
    window.addEventListener("touchmove", handler, { passive: true });
    return () => {
      window.removeEventListener("wheel", handler);
      window.removeEventListener("touchmove", handler);
    };
  }, [isCoverVisible, isFadingOut]);

  const handleCopyWifi = () => {
    if (!wifiPass) return;
    const doCopy = () => {
      setCopiedWifi(true);
      showToast(`Sandi WiFi "${wifiPass}" disalin!`);
      setTimeout(() => setCopiedWifi(false), 2000);
    };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(wifiPass).then(doCopy);
    } else {
      const t = document.createElement("input");
      t.value = wifiPass;
      document.body.appendChild(t);
      t.select();
      document.execCommand("copy");
      document.body.removeChild(t);
      doCopy();
    }
  };

  const handleCallWaiter = () => {
    setWaiterCalled(true);
    showToast(`Layanan dipanggil untuk Meja ${tableNum}.`);
    setTimeout(() => setWaiterCalled(false), 3500);
  };

  /* ── Filtering ── */
  const filtered = products.filter((p) => {
    const cat = activeCategory === "all" || p.category === activeCategory;
    const search = p.searchKey.toLowerCase().includes(searchQuery.toLowerCase().trim());
    return cat && search;
  });

  const featuredItems = filtered.filter((p) => p.image || p.is_featured);
  const textItems = filtered.filter((p) => !p.image && !p.is_featured);

  /* ── Category counts (based on all items, not filtered) ── */
  const catCounts: Record<string, number> = {};
  for (const p of products) catCounts[p.category] = (catCounts[p.category] || 0) + 1;
  const sortedCategories = [...categories].sort((a, b) => a.sort_order - b.sort_order);

  const accentContrast = (hex: string) => {
    const c = hex.replace("#", "");
    if (c.length !== 6) return "white";
    const r = parseInt(c.slice(0, 2), 16);
    const g = parseInt(c.slice(2, 4), 16);
    const b = parseInt(c.slice(4, 6), 16);
    return r * 0.299 + g * 0.587 + b * 0.114 > 186 ? "#1c1917" : "white";
  };

  const styleVars: React.CSSProperties = {
    backgroundColor: bg,
    color: onBg,
  } as any;

  return (
    <div
      className="relative min-h-screen antialiased pb-28"
      style={{
        ...styleVars,
        ["--accent" as any]: accent,
        ["--accent-on" as any]: accentContrast(accent),
        ["--bg" as any]: bg,
        ["--muted" as any]: muted,
        ["--border" as any]: border,
        ["--bg-alt" as any]: bgAlt,
      }}
    >
      {/* ── 1. Fullscreen Welcome Cover (Mobile Only) ── */}
      {isCoverVisible && client.cover_mobile_url && (
        <div
          onClick={dismissCover}
          className={`md:hidden fixed inset-0 z-50 w-full h-[100dvh] flex flex-col justify-end items-center overflow-hidden transition-all duration-600 ease-in-out cursor-pointer ${isFadingOut ? "opacity-0 pointer-events-none scale-105" : "opacity-100"}`}
          style={{ background: bg }}
        >
          <img
            src={client.cover_mobile_url}
            alt={`${client.business_name} Welcome Cover`}
            className="absolute inset-0 w-full h-full object-cover object-center z-0"
          />
          <div
            className="relative z-10 w-full pb-4 pt-16 flex flex-col items-center justify-center"
            style={{ background: `linear-gradient(to top, ${bgAlt}, transparent 70%, transparent)` }}
          >
            <div className="flex flex-col items-center gap-1.5">
              <span className="material-symbols-outlined text-3xl animate-bounce" style={{ color: `${onBg}50` }}>keyboard_arrow_down</span>
              <span className="text-[9px] font-semibold tracking-[0.22em] uppercase font-body" style={{ color: `${onBg}40` }}>scroll</span>
            </div>
          </div>
        </div>
      )}

      {/* ── 2. Toast ── */}
      <div className={`fixed top-5 inset-x-0 z-50 flex justify-center pointer-events-none transition-all duration-300 transform ${toastMessage ? "translate-y-0 opacity-100" : "-translate-y-12 opacity-0"}`}>
        <div
          className="px-4 py-2.5 rounded-2xl backdrop-blur-md text-white text-[11px] font-medium shadow-lg border border-white/10 flex items-center gap-2 font-body"
          style={{ background: `${accent}e6` }}
        >
          <svg className="w-3.5 h-3.5 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
          </svg>
          <span>{toastMessage}</span>
        </div>
      </div>

      {/* ── 3. Sticky Header ── */}
      <header
        className="sticky top-0 z-40 backdrop-blur-lg border-b px-5 py-2.5"
        style={{ background: `${bg}cc`, borderColor: `${border}50` }}
      >
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {client.logo_url ? (
              <img src={client.logo_url} alt={`${client.business_name} Logo`} className="h-8 sm:h-10 w-auto object-contain" />
            ) : (
              <div
                className="h-8 w-8 rounded-xl flex items-center justify-center"
                style={{ background: accent, color: accentContrast(accent) }}
              >
                <span className="material-symbols-outlined text-lg">local_cafe</span>
              </div>
            )}
            <span className="text-xs" style={{ color: `${muted}40` }}>|</span>
            <span className="text-xs font-semibold tracking-[0.18em] uppercase font-body" style={{ color: muted }}>
              Table {tableNum}
            </span>
          </div>
          {client.operating_hours && (
            <div className="flex items-center gap-1.5 text-[10px] font-medium font-body" style={{ color: muted }}>
              <span className="w-1 h-1 rounded-full bg-emerald-500"></span>
              <span className="tracking-wider">{client.operating_hours}</span>
            </div>
          )}
        </div>
      </header>

      {/* ── 4. Main Content ── */}
      <main className="max-w-xl mx-auto px-5 pt-2 sm:pt-3 space-y-6 font-body">
        {/* Hero — Minimal */}
        <section className="text-center py-1 space-y-1">
          <div className="flex justify-center mb-2">
            {client.logo_url ? (
              <img
                src={client.logo_url}
                alt={`${client.business_name} Logo`}
                className="h-10 sm:h-12 w-auto max-w-[200px] object-contain"
              />
            ) : (
              <div
                className="h-12 w-12 rounded-2xl flex items-center justify-center shadow-md"
                style={{ background: accent, color: accentContrast(accent) }}
              >
                <span className="material-symbols-outlined text-2xl">storefront</span>
              </div>
            )}
          </div>
          <h1 className="font-heading text-2xl sm:text-3xl font-bold uppercase tracking-[0.2em]" style={{ color: onBg }}>
            MENU
          </h1>
          {client.tagline && (
            <p className="text-[10px] tracking-[0.24em] uppercase font-bold pt-0.5" style={{ color: muted }}>
              &quot;{client.tagline}&quot;
            </p>
          )}
        </section>

        {/* Quick Actions — WiFi & Review */}
        {(hasWifi || hasReview) && (
          <section className={`grid gap-3 ${hasWifi && hasReview ? "grid-cols-2" : "grid-cols-1"}`}>
            {/* WiFi */}
            {hasWifi && (
              <div className="p-4 rounded-2xl bg-white border flex flex-col justify-between" style={{ borderColor: border }}>
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <svg className="w-4 h-4" style={{ color: muted }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.5"
                      />
                    </svg>
                    <span
                      className="text-[9px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-full"
                      style={{ background: bgAlt, color: muted }}
                    >
                      WiFi
                    </span>
                  </div>
                  <p className="font-semibold text-xs" style={{ color: onBg }}>
                    {wifiSsid}
                  </p>
                  {wifiPass ? (
                    <p className="text-[11px] font-mono mt-0.5 select-all" style={{ color: muted }}>
                      {wifiPass}
                    </p>
                  ) : (
                    <p className="text-[11px] mt-0.5 italic" style={{ color: muted }}>
                      Tanpa password
                    </p>
                  )}
                </div>
                {wifiPass && (
                  <button
                    onClick={handleCopyWifi}
                    className="mt-3 w-full py-2 rounded-xl text-[10px] font-semibold text-white flex items-center justify-center gap-1.5 active:scale-95 transition cursor-pointer"
                    style={{ background: accent, color: accentContrast(accent) }}
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                      />
                    </svg>
                    {copiedWifi ? "Tersalin ✓" : "Salin Password"}
                  </button>
                )}
              </div>
            )}

            {/* Google Review */}
            {hasReview && (
              <a
                href={reviewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-4 rounded-2xl bg-white border flex flex-col justify-between transition group cursor-pointer"
                style={{ borderColor: border, ["--hover-border" as any]: "rgb(252 211 77)" }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgb(252 211 77)")}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = border)}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-amber-500 text-[10px] tracking-tight">★★★★★</span>
                    <span className="text-[9px] font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-800">Rating</span>
                  </div>
                  <p className="text-xs font-semibold" style={{ color: onBg }}>
                    Suka suasana kami?
                  </p>
                  <p className="text-[11px] leading-tight mt-0.5" style={{ color: muted }}>
                    Beri ulasan untuk {client.business_name}.
                  </p>
                </div>
                <div className="mt-3 w-full py-2 rounded-xl text-[10px] font-semibold text-center flex items-center justify-center gap-1 transition group-hover:bg-amber-300 bg-amber-400 text-[#451a03]">
                  Beri Ulasan Maps
                  <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                  </svg>
                </div>
              </a>
            )}
          </section>
        )}

        {/* Search */}
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari menu..."
            className="w-full bg-white border rounded-full pl-10 pr-4 py-2.5 text-xs placeholder focus:outline-none focus:ring-1 transition font-body"
            style={{
              borderColor: border,
              color: onBg,
              ["--ph" as any]: "rgb(196 190 180)",
              ["--ring" as any]: muted,
            } as any}
          />
          <svg className="w-4 h-4 absolute left-3.5 top-2.5" fill="none" stroke={muted} viewBox="0 0 24 24">
            <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
          </svg>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3.5 top-2.5 text-xs"
              style={{ color: muted }}
            >
              ✕
            </button>
          )}
        </div>

        {/* Category Pills */}
        {sortedCategories.length > 0 && (
          <div className="flex items-center gap-2.5 overflow-x-auto no-scrollbar py-2 px-1 text-[11px] font-body">
            <button
              onClick={() => setActiveCategory("all")}
              className={`px-4 py-2 rounded-full font-medium whitespace-nowrap transition-all duration-200 cursor-pointer active:scale-95 ${
                activeCategory === "all" ? "shadow-xs" : "bg-white border hover:text-[#3C3833]"
              }`}
              style={
                activeCategory === "all"
                  ? { background: accent, color: accentContrast(accent) }
                  : { color: muted, borderColor: border }
              }
            >
              Semua ({products.length})
            </button>
            {sortedCategories.map((cat) => (
              <button
                key={cat.key}
                onClick={() => setActiveCategory(cat.key)}
                className={`px-4 py-2 rounded-full font-medium whitespace-nowrap transition-all duration-200 cursor-pointer active:scale-95 border`}
                style={
                  activeCategory === cat.key
                    ? { background: accent, color: accentContrast(accent), borderColor: accent }
                    : { background: "white", color: muted, borderColor: border }
                }
              >
                {cat.label} ({catCounts[cat.key] || 0})
              </button>
            ))}
          </div>
        )}

        {/* ── Category Section Header ── */}
        {activeCategory !== "all" &&
          (() => {
            const cat = sortedCategories.find((c) => c.key === activeCategory);
            if (!cat) return null;
            return (
              <div className="rounded-2xl overflow-hidden" style={{ background: accent }}>
                <div className="px-5 py-3.5 flex items-center justify-between">
                  <h2 className="font-heading font-bold text-lg uppercase tracking-[0.2em]" style={{ color: accentContrast(accent) }}>
                    {cat.label.toUpperCase()}
                  </h2>
                  {client.logo_url ? (
                    <img
                      src={client.logo_url}
                      alt={`${client.business_name} Logo`}
                      className="h-4 w-auto object-contain"
                      style={{ filter: "brightness(0) invert(1)", opacity: 0.7 }}
                    />
                  ) : (
                    <span
                      className="material-symbols-outlined text-sm"
                      style={{ filter: "brightness(0) invert(1)", opacity: 0.7 }}
                    >
                      local_cafe
                    </span>
                  )}
                </div>
              </div>
            );
          })()}

        {/* ── Featured Items (with Photos) ── */}
        {featuredItems.length > 0 && (
          <section>
            {activeCategory === "all" && (
              <p className="text-[10px] font-medium uppercase tracking-[0.2em] mb-3 font-body" style={{ color: muted }}>
                Pilihan Tamu
              </p>
            )}
            <div className="grid grid-cols-2 gap-3">
              {featuredItems.map((product) => (
                <article
                  key={product.id}
                  onClick={() => setSelectedProduct(product)}
                  className="group flex flex-col bg-white rounded-2xl border overflow-hidden transition-all cursor-pointer active:scale-[0.97]"
                  style={{ borderColor: border }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#C4BEB4")}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = border)}
                >
                  <div
                    className="relative w-full aspect-square flex items-center justify-center"
                    style={{ background: bgAlt }}
                  >
                    {product.image ? (
                      <img
                        src={product.image}
                        alt={product.name}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        loading="lazy"
                      />
                    ) : (
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{ background: accent, color: accentContrast(accent) }}
                      >
                        <span className="material-symbols-outlined">restaurant</span>
                      </div>
                    )}
                    {product.badge && (
                      <span
                        className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[8px] font-semibold text-white tracking-wider uppercase font-body"
                        style={{ background: `${accent}d9` }}
                      >
                        {product.badge}
                      </span>
                    )}
                  </div>
                  <div className="p-3 flex flex-col gap-1">
                    <div className="flex items-start justify-between gap-1">
                      <h3 className="font-semibold text-[11px] leading-snug font-body" style={{ color: onBg }}>
                        {product.name}
                      </h3>
                      <span className="text-[11px] font-bold shrink-0 font-body" style={{ color: onBg }}>
                        {product.price}
                      </span>
                    </div>
                    {product.description && (
                      <p className="text-[10px] leading-relaxed line-clamp-2 font-body" style={{ color: muted }}>
                        {product.description}
                      </p>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {/* ── Text-Only Items (No Photo — Clean List) ── */}
        {textItems.length > 0 && (
          <section>
            {featuredItems.length > 0 && <div className="border-t pt-4 mt-2" style={{ borderColor: border }}></div>}
            <div className="space-y-0">
              {textItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setSelectedProduct(item)}
                  className="w-full flex items-center justify-between py-3 border-b hover:bg-[#F5F1EB] transition cursor-pointer px-1 text-left"
                  style={{ borderColor: `${border}60` }}
                >
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-medium font-body block" style={{ color: onBg }}>
                      {item.name}
                    </span>
                    {item.description && (
                      <span className="text-[10px] font-body" style={{ color: muted }}>
                        {item.description}
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-bold ml-4 shrink-0 font-body" style={{ color: onBg }}>
                    {item.price}
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        {filtered.length === 0 && (
          <div className="text-center py-10 px-4 rounded-2xl bg-white border" style={{ borderColor: border }}>
            <p className="text-xs font-body" style={{ color: muted }}>
              {products.length === 0 ? "Menu belum tersedia. Silakan hubungi staf." : "Tidak ada hidangan yang sesuai."}
            </p>
          </div>
        )}

        {/* Ordering Notice */}
        <div
          className="rounded-2xl border p-4 text-center space-y-1 mb-6"
          style={{ background: bgAlt, borderColor: "#E3DCD2" }}
        >
          <p className="font-semibold text-xs font-body" style={{ color: onBg }}>
            Pemesanan &amp; Pembayaran
          </p>
          <p className="text-[11px] leading-relaxed font-body" style={{ color: muted }}>
            Sebutkan Meja {tableNum} ke kasir atau gunakan tombol panggil bantuan pelayan di bawah.
          </p>
        </div>
      </main>

      {/* ── 5. Floating Bottom Dock — Liquid Glass ── */}
      <aside
        className={`fixed bottom-4 inset-x-0 z-40 px-4 pointer-events-none transition-all duration-500 ease-out ${isCoverVisible ? "translate-y-24 opacity-0" : "translate-y-0 opacity-100"}`}
      >
        <div
          className="max-w-md mx-auto pointer-events-auto flex items-center justify-between gap-2 p-1.5 rounded-full"
          style={{
            background: "rgba(255,255,255,0.18)",
            backdropFilter: "blur(24px) saturate(180%)",
            WebkitBackdropFilter: "blur(24px) saturate(180%)",
            boxShadow: "0 8px 32px rgba(38,35,30,0.18), inset 0 1px 0 rgba(255,255,255,0.45), inset 0 -1px 0 rgba(0,0,0,0.06)",
            border: "1px solid rgba(255,255,255,0.35)",
          }}
        >
          <button
            onClick={handleCallWaiter}
            className="flex-1 py-2.5 px-4 rounded-full text-[11px] font-semibold flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer font-body"
            style={{
              background: waiterCalled ? "rgba(16,185,129,0.18)" : `${accent}b8`,
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              color: waiterCalled ? "#065f46" : bg,
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.15), 0 2px 8px rgba(0,0,0,0.12)",
              border: waiterCalled ? "1px solid rgba(16,185,129,0.3)" : "1px solid rgba(255,255,255,0.12)",
            }}
          >
            <svg
              className="w-3.5 h-3.5 shrink-0"
              style={{ color: waiterCalled ? "#10b981" : "#6ee7b7" }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
              />
            </svg>
            <span className="truncate">{waiterCalled ? "Dipanggil..." : "Panggil Waiter"}</span>
          </button>
          {hasReview && (
            <a
              href={reviewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="py-2.5 px-4 rounded-full text-[11px] font-semibold flex items-center gap-1.5 active:scale-95 transition-all shrink-0 cursor-pointer font-body"
              style={{
                background: "rgba(251,191,36,0.82)",
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
                color: "#451a03",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.5), 0 2px 8px rgba(245,158,11,0.3)",
                border: "1px solid rgba(255,255,255,0.3)",
              }}
            >
              <svg className="w-3 h-3 fill-current" style={{ color: "#92400e" }} viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              <span>Rating</span>
            </a>
          )}
        </div>
      </aside>

      {/* ── 6. Product Detail Modal ── */}
      {selectedProduct && (
        <div
          onClick={() => setSelectedProduct(null)}
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto cursor-default border"
            style={{ background: bg, borderColor: border }}
          >
            {selectedProduct.image ? (
              <div className="relative w-full aspect-square rounded-2xl overflow-hidden" style={{ background: bgAlt }}>
                <img src={selectedProduct.image} alt={selectedProduct.name} className="w-full h-full object-cover" />
                {selectedProduct.badge && (
                  <span
                    className="absolute top-3 left-3 text-white text-[9px] font-semibold px-2.5 py-0.5 rounded-full uppercase tracking-wider font-body"
                    style={{ background: accent }}
                  >
                    {selectedProduct.badge}
                  </span>
                )}
              </div>
            ) : (
              <div
                className="w-full aspect-[2/1] rounded-2xl flex items-center justify-center"
                style={{ background: bgAlt }}
              >
                {client.logo_url ? (
                  <img
                    src={client.logo_url}
                    alt={`${client.business_name} Logo`}
                    className="h-7 w-auto object-contain opacity-60"
                  />
                ) : (
                  <span className="material-symbols-outlined text-3xl opacity-40" style={{ color: onBg }}>
                    restaurant
                  </span>
                )}
              </div>
            )}

            <div>
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-base font-body" style={{ color: onBg }}>
                  {selectedProduct.name}
                </h3>
                <span
                  className="font-bold text-sm px-2.5 py-1 rounded-lg border shrink-0 font-body"
                  style={{ background: bgAlt, borderColor: "#E3DCD2", color: onBg }}
                >
                  {selectedProduct.priceNum}
                </span>
              </div>
              <span
                className="inline-block mt-1 text-[10px] uppercase tracking-wider font-medium font-body"
                style={{ color: muted }}
              >
                {selectedProduct.categoryLabel}
              </span>
            </div>

            {selectedProduct.description && (
              <div className="pt-2 border-t" style={{ borderColor: border }}>
                <p className="text-xs leading-relaxed font-light font-body" style={{ color: muted }}>
                  {selectedProduct.description}
                </p>
              </div>
            )}

            <button
              onClick={() => setSelectedProduct(null)}
              className="w-full py-2.5 rounded-xl hover:bg-black text-white text-xs font-semibold active:scale-95 transition cursor-pointer font-body"
              style={{ background: accent, color: accentContrast(accent) }}
            >
              Tutup
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
