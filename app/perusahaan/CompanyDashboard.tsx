"use client";

import { useEffect, useRef, useState } from "react";
import { slugifyCompany } from "@/lib/company-slug";

type CardRow = {
  card_id: string;
  business_name: string | null;
  place_id: string | null;
  google_review_url: string | null;
  is_active: boolean;
  rating_guard: boolean | null;
  created_at: string;
  activated_at: string | null;
  tap_count: number;
  last_tap_at: string | null;
  prod_card_ready: boolean | null;
  prod_nfc_installed: boolean | null;
  prod_ready_sell: boolean | null;
};

type Stats = {
  totalCards: number;
  activeCards: number;
  inactiveCards: number;
  totalTaps: number;
  guardOnCards: number;
};

type PlaceSuggestion = { place_id: string; description: string };

type FeedbackItem = {
  id: number;
  card_id: string;
  rating: number;
  message: string;
  customer_name: string | null;
  customer_phone: string | null;
  created_at: string;
  cards?: { business_name: string | null } | null;
};

function formatDate(d: string | null): string {
  if (!d) return "Belum pernah";
  try {
    return new Date(d).toLocaleString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return d;
  }
}

function whatsappLink(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  const normalized = digits.startsWith("0") ? "62" + digits.slice(1) : digits;
  return `https://wa.me/${normalized}`;
}

export default function CompanyDashboard({
  companyName,
  email,
}: {
  companyName: string;
  email: string;
}) {
  const [cards, setCards] = useState<CardRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [editCard, setEditCard] = useState<CardRow | null>(null);
  const [feedbackCard, setFeedbackCard] = useState<CardRow | null>(null);
  const [feedbackList, setFeedbackList] = useState<FeedbackItem[]>([]);
  const [feedbackLoading, setFeedbackLoading] = useState(false);

  // Edit link state
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<PlaceSuggestion | null>(null);
  const [customLink, setCustomLink] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function loadCards() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/company/cards");
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Gagal memuat kartu.");
      setCards(data.cards || []);
      setStats(data.stats || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCards();
  }, []);

  async function handleLogout() {
    await fetch("/api/company/logout", { method: "POST" });
    window.location.href = `/perusahaan/${slugifyCompany(companyName)}`;
  }

  function openEdit(card: CardRow) {
    setEditCard(card);
    setQuery(card.business_name || "");
    setSelectedPlace(null);
    setCustomLink(card.google_review_url || "");
    setSuggestions([]);
    setSaveMsg(null);
  }

  function closeEdit() {
    setEditCard(null);
    setSaveMsg(null);
  }

  function handleQueryChange(value: string) {
    setQuery(value);
    setSelectedPlace(null);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    if (value.trim().length < 3) {
      setSuggestions([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    debounceTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/places?query=${encodeURIComponent(value)}`);
        if (res.ok) {
          const data = await res.json();
          setSuggestions(data.suggestions || []);
        } else {
          setSuggestions([]);
        }
      } catch {
        setSuggestions([]);
      } finally {
        setIsSearching(false);
      }
    }, 350);
  }

  function handleSelectPlace(place: PlaceSuggestion) {
    setSelectedPlace(place);
    setQuery(place.description);
    setSuggestions([]);
    setCustomLink(
      `https://search.google.com/local/writereview?placeid=${encodeURIComponent(place.place_id)}`
    );
  }

  async function saveLink() {
    if (!editCard) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      const businessName = selectedPlace ? selectedPlace.description : query.trim();
      const res = await fetch("/api/company/card", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cardId: editCard.card_id,
          newBusinessName: businessName,
          newPlaceId: selectedPlace ? selectedPlace.place_id : null,
          newGoogleReviewUrl: customLink.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Gagal memperbarui link.");
      setSaveMsg({ type: "ok", text: "Link review berhasil diperbarui!" });
      await loadCards();
      setTimeout(closeEdit, 800);
    } catch (err) {
      setSaveMsg({
        type: "err",
        text: err instanceof Error ? err.message : "Gagal memperbarui link.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function toggleGuard(card: CardRow) {
    const newState = !card.rating_guard;
    try {
      const res = await fetch("/api/company/card", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId: card.card_id, ratingGuard: newState }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Gagal mengubah guard.");
      await loadCards();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Gagal mengubah guard.");
    }
  }

  async function openFeedback(card: CardRow) {
    setFeedbackCard(card);
    setFeedbackLoading(true);
    setFeedbackList([]);
    try {
      const res = await fetch(`/api/company/feedback?cardId=${card.card_id}`);
      const data = await res.json();
      if (res.ok) setFeedbackList(data.feedback || []);
    } catch {
      setFeedbackList([]);
    } finally {
      setFeedbackLoading(false);
    }
  }

  const filtered = cards.filter((c) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      c.card_id.toLowerCase().includes(q) ||
      (c.business_name || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-[#FAF8F5]">
      {/* Header */}
      <header className="bg-white border-b border-[#E8E3DA] sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#3C3833] flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-white text-xl">apartment</span>
            </div>
            <div className="min-w-0">
              <h1 className="font-bold text-[#3C3833] truncate">{companyName}</h1>
              <p className="text-xs text-[#8E897C] truncate">{email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="text-xs font-bold text-[#8E897C] hover:text-red-500 transition-colors flex items-center gap-1 shrink-0"
          >
            <span className="material-symbols-outlined text-[18px]">logout</span>
            Keluar
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Total Kartu" value={stats.totalCards} icon="credit_card" />
            <StatCard label="Kartu Aktif" value={stats.activeCards} icon="check_circle" color="green" />
            <StatCard label="Total Tap" value={stats.totalTaps} icon="touch_app" color="blue" />
            <StatCard label="Guard Aktif" value={stats.guardOnCards} icon="shield" color="amber" />
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#B5AFA3] text-[20px]">
            search
          </span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari ID kartu / nama bisnis..."
            className="w-full bg-white border border-[#E8E3DA] rounded-xl pl-11 pr-4 py-3 text-sm font-bold text-[#3C3833] placeholder:text-[#B5AFA3] focus:outline-none focus:border-[#3C3833]"
          />
        </div>

        {/* Card list */}
        {loading ? (
          <div className="text-center py-12 text-[#8E897C] text-sm">Memuat data kartu...</div>
        ) : error ? (
          <div className="text-center py-12 text-red-500 text-sm font-bold">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-[#8E897C] text-sm">
            {search ? "Tidak ada kartu yang cocok." : "Belum ada kartu untuk perusahaan ini."}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((card) => (
              <div
                key={card.card_id}
                className="bg-white rounded-2xl border border-[#E8E3DA] p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-sm text-[#3C3833]">
                        {card.card_id}
                      </span>
                      {card.is_active ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                          Aktif
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                          Belum Aktif
                        </span>
                      )}
                      {card.rating_guard && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[12px]">shield</span>
                          Guard
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-bold text-[#3C3833] mt-1 truncate">
                      {card.business_name || "Belum ada nama bisnis"}
                    </p>
                  </div>
                </div>

                {/* Tap stats */}
                <div className="flex items-center gap-4 text-xs text-[#8E897C] mb-3 flex-wrap">
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px]">touch_app</span>
                    <b className="text-[#3C3833]">{card.tap_count || 0}</b> tap
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px]">schedule</span>
                    {formatDate(card.last_tap_at)}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => openEdit(card)}
                    disabled={!card.is_active}
                    className="text-xs font-bold px-3 py-2 rounded-lg bg-[#3C3833] text-white hover:bg-black transition-colors disabled:opacity-40 flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed"
                  >
                    <span className="material-symbols-outlined text-[16px]">link</span>
                    Edit Link
                  </button>
                  <button
                    onClick={() => toggleGuard(card)}
                    disabled={!card.is_active}
                    className={`text-xs font-bold px-3 py-2 rounded-lg transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                      card.rating_guard
                        ? "bg-amber-100 text-amber-700 hover:bg-amber-200"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      {card.rating_guard ? "shield" : "shield_off"}
                    </span>
                    Guard {card.rating_guard ? "ON" : "OFF"}
                  </button>
                  <button
                    onClick={() => openFeedback(card)}
                    disabled={!card.is_active}
                    className="text-xs font-bold px-3 py-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors disabled:opacity-40 flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed"
                  >
                    <span className="material-symbols-outlined text-[16px]">forum</span>
                    Keluhan
                  </button>
                  {card.google_review_url && (
                    <a
                      href={card.google_review_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-bold px-3 py-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                      Buka
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Edit Link Modal */}
      {editCard && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
          <div className="bg-white rounded-t-2xl md:rounded-2xl w-full md:max-w-md max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-[#E8E3DA] px-5 py-4 flex items-center justify-between">
              <h2 className="font-bold text-[#3C3833]">Edit Link Review — {editCard.card_id}</h2>
              <button onClick={closeEdit} className="text-[#8E897C] hover:text-[#3C3833]">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#5C564A] mb-1.5">
                  Cari Nama Bisnis di Google
                </label>
                <div className="relative">
                  <input
                    value={query}
                    onChange={(e) => handleQueryChange(e.target.value)}
                    placeholder="Ketik nama bisnis..."
                    className="w-full bg-[#FAF8F5] border border-[#E8E3DA] rounded-xl px-4 py-2.5 text-sm font-bold text-[#3C3833] placeholder:text-[#B5AFA3] focus:outline-none focus:border-[#3C3833]"
                  />
                  {isSearching && (
                    <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-[#B5AFA3] animate-spin text-[18px]">
                      progress_activity
                    </span>
                  )}
                </div>
                {suggestions.length > 0 && (
                  <div className="mt-1 border border-[#E8E3DA] rounded-xl overflow-hidden bg-white max-h-48 overflow-y-auto">
                    {suggestions.map((s) => (
                      <button
                        key={s.place_id}
                        onClick={() => handleSelectPlace(s)}
                        className="w-full text-left px-4 py-2.5 text-xs text-[#3C3833] hover:bg-[#FAF8F5] border-b border-[#F3EFEA] last:border-0"
                      >
                        {s.description}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-[#5C564A] mb-1.5">
                  Link Review Google
                </label>
                <input
                  value={customLink}
                  onChange={(e) => setCustomLink(e.target.value)}
                  placeholder="https://search.google.com/local/writereview?placeid=..."
                  className="w-full bg-[#FAF8F5] border border-[#E8E3DA] rounded-xl px-4 py-2.5 text-sm font-bold text-[#3C3833] placeholder:text-[#B5AFA3] focus:outline-none focus:border-[#3C3833]"
                />
                <p className="text-[10px] text-[#B5AFA3] mt-1">
                  Pilih dari saran Google atau tempel link writereview manual.
                </p>
              </div>

              {saveMsg && (
                <div
                  className={`flex items-start gap-2 p-3 rounded-xl text-xs font-bold ${
                    saveMsg.type === "ok"
                      ? "bg-green-50 text-green-700 border border-green-100"
                      : "bg-red-50 text-red-600 border border-red-100"
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">
                    {saveMsg.type === "ok" ? "check_circle" : "error"}
                  </span>
                  {saveMsg.text}
                </div>
              )}

              <button
                onClick={saveLink}
                disabled={saving}
                className="w-full bg-[#3C3833] text-white font-bold text-sm py-3 rounded-xl hover:bg-black transition-colors disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer"
              >
                {saving ? (
                  <>
                    <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                    Menyimpan...
                  </>
                ) : (
                  "Simpan Link"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Feedback Modal */}
      {feedbackCard && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
          <div className="bg-white rounded-t-2xl md:rounded-2xl w-full md:max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-[#E8E3DA] px-5 py-4 flex items-center justify-between">
              <h2 className="font-bold text-[#3C3833]">
                Keluhan — {feedbackCard.card_id}
              </h2>
              <button onClick={() => setFeedbackCard(null)} className="text-[#8E897C] hover:text-[#3C3833]">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-5">
              {feedbackLoading ? (
                <div className="text-center py-8 text-[#8E897C] text-sm">Memuat keluhan...</div>
              ) : feedbackList.length === 0 ? (
                <div className="text-center py-8 text-[#8E897C] text-sm">
                  Belum ada keluhan untuk kartu ini.
                </div>
              ) : (
                <div className="space-y-3">
                  {feedbackList.map((f) => {
                    const wa = whatsappLink(f.customer_phone);
                    return (
                      <div
                        key={f.id}
                        className="border border-[#E8E3DA] rounded-xl p-3 bg-[#FAF8F5]"
                      >
                        <div className="flex items-center gap-1 mb-1">
                          {[1, 2, 3].map((n) => (
                            <span
                              key={n}
                              className="material-symbols-outlined text-[18px]"
                              style={{
                                color: n <= f.rating ? "#F5A623" : "#E8E3DA",
                                fontVariationSettings: "'FILL' 1",
                              }}
                            >
                              star
                            </span>
                          ))}
                          <span className="text-[10px] text-[#B5AFA3] ml-2">
                            {formatDate(f.created_at)}
                          </span>
                        </div>
                        <p className="text-sm text-[#3C3833] mb-2">{f.message}</p>
                        {(f.customer_name || f.customer_phone) && (
                          <div className="flex items-center gap-2 flex-wrap text-xs text-[#5C564A]">
                            {f.customer_name && (
                              <span className="font-bold">{f.customer_name}</span>
                            )}
                            {wa && (
                              <a
                                href={wa}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-green-600 font-bold hover:underline flex items-center gap-1"
                              >
                                <span className="material-symbols-outlined text-[14px]">chat</span>
                                WhatsApp
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  color = "default",
}: {
  label: string;
  value: number;
  icon: string;
  color?: "default" | "green" | "blue" | "amber";
}) {
  const colorMap: Record<string, string> = {
    default: "bg-[#3C3833] text-white",
    green: "bg-green-100 text-green-700",
    blue: "bg-blue-100 text-blue-700",
    amber: "bg-amber-100 text-amber-700",
  };
  return (
    <div className="bg-white rounded-2xl border border-[#E8E3DA] p-4 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${colorMap[color]}`}>
          <span className="material-symbols-outlined text-[18px]">{icon}</span>
        </span>
      </div>
      <p className="text-2xl font-bold text-[#3C3833]">{value}</p>
      <p className="text-[11px] text-[#8E897C] font-bold uppercase tracking-wide">{label}</p>
    </div>
  );
}
