"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type PlaceSuggestion = {
  place_id: string;
  description: string;
};

export default function EditForm({
  cardId,
  currentBusinessName,
  googleReviewUrl,
}: {
  cardId: string;
  currentBusinessName: string;
  googleReviewUrl?: string;
}) {
  const router = useRouter();

  // Modal states
  const [activeModal, setActiveModal] = useState<"link" | "pin" | null>(null);

  // Link edit state
  const [query, setQuery] = useState(currentBusinessName);
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<PlaceSuggestion | null>(null);
  const [customLink, setCustomLink] = useState(googleReviewUrl || "");
  const [isSearching, setIsSearching] = useState(false);

  // 4-box PIN states
  const [currentPinDigits, setCurrentPinDigits] = useState<string[]>(["", "", "", ""]);
  const [showCurrentPin, setShowCurrentPin] = useState(false);

  const [newPinDigits, setNewPinDigits] = useState<string[]>(["", "", "", ""]);
  const [showNewPin, setShowNewPin] = useState(false);

  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentPinRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  const newPinRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

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
      } catch (err) {
        console.error("Failed to fetch suggestions", err);
      } finally {
        setIsSearching(false);
      }
    }, 350);
  }

  function handleSelectPlace(place: PlaceSuggestion) {
    setSelectedPlace(place);
    setQuery(place.description);
    setSuggestions([]);
    const generatedUrl = `https://search.google.com/local/writereview?placeid=${encodeURIComponent(place.place_id)}`;
    setCustomLink(generatedUrl);
  }

  function handlePinChange(
    digits: string[],
    setDigits: (d: string[]) => void,
    refs: React.RefObject<HTMLInputElement>[],
    index: number,
    value: string
  ) {
    const digit = value.replace(/\D/g, "").slice(-1);
    const updated = [...digits];
    updated[index] = digit;
    setDigits(updated);

    if (digit && index < 3) {
      refs[index + 1].current?.focus();
    }
  }

  function handlePinKeyDown(
    digits: string[],
    refs: React.RefObject<HTMLInputElement>[],
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>
  ) {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      refs[index - 1].current?.focus();
    }
  }

  function handlePinPaste(
    setDigits: (d: string[]) => void,
    refs: React.RefObject<HTMLInputElement>[],
    e: React.ClipboardEvent<HTMLInputElement>
  ) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 4);
    if (pasted) {
      const updated = ["", "", "", ""];
      for (let i = 0; i < pasted.length; i++) {
        updated[i] = pasted[i];
      }
      setDigits(updated);
      const nextFocus = Math.min(pasted.length, 3);
      refs[nextFocus].current?.focus();
    }
  }

  async function handleSaveLink(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    const currentPin = currentPinDigits.join("");
    if (!/^\d{4}$/.test(currentPin)) {
      setErrorMsg("Masukkan 4 digit PIN Anda untuk verifikasi.");
      return;
    }

    const businessName = selectedPlace ? selectedPlace.description : query.trim();
    if (!businessName) {
      setErrorMsg("Masukkan nama bisnis atau pilih dari saran Google.");
      return;
    }

    setStatus("saving");
    try {
      const res = await fetch("/api/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cardId,
          pin: currentPin,
          newBusinessName: businessName,
          newPlaceId: selectedPlace ? selectedPlace.place_id : null,
          newGoogleReviewUrl: customLink.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setStatus("error");
        setErrorMsg(data.error || "Gagal memperbarui link review.");
        return;
      }

      setStatus("done");
      setSuccessMsg("Link ulasan Google berhasil diperbarui!");
      setActiveModal(null);
      setCurrentPinDigits(["", "", "", ""]);
      window.location.reload();
    } catch (err) {
      setStatus("error");
      setErrorMsg("Terjadi kesalahan koneksi.");
    }
  }

  async function handleSavePin(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    const currentPin = currentPinDigits.join("");
    if (!/^\d{4}$/.test(currentPin)) {
      setErrorMsg("Masukkan 4 digit PIN lama Anda.");
      return;
    }

    const newPin = newPinDigits.join("");
    if (!/^\d{4}$/.test(newPin)) {
      setErrorMsg("PIN baru harus 4 digit angka.");
      return;
    }

    setStatus("saving");
    try {
      const res = await fetch("/api/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cardId,
          pin: currentPin,
          newPin,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setStatus("error");
        setErrorMsg(data.error || "Gagal memperbarui PIN.");
        return;
      }

      setStatus("done");
      setSuccessMsg("PIN rahasia berhasil diperbarui!");
      setActiveModal(null);
      setCurrentPinDigits(["", "", "", ""]);
      setNewPinDigits(["", "", "", ""]);
      window.location.reload();
    } catch (err) {
      setStatus("error");
      setErrorMsg("Terjadi kesalahan koneksi.");
    }
  }

  return (
    <div className="bg-surface-bright text-on-surface font-body-md antialiased min-h-screen pb-24">
      {/* TopAppBar Shared Component */}
      <header className="fixed top-0 w-full z-50 flex justify-between items-center px-4 h-16 bg-surface-white border-b border-outline-variant">
        <Link href="/" className="flex items-center gap-2.5">
          <img src="/ratey-logo.png" alt="Ratey Logo" className="w-9 h-9 object-cover rounded-xl" />
          <span className="text-headline-md font-headline-md font-bold text-primary">Ratey</span>
        </Link>
        <Link href="/#portal" className="text-primary hover:text-secondary transition-colors">
          <span className="material-symbols-outlined text-headline-md">credit_card</span>
        </Link>
      </header>

      {/* Main Canvas */}
      <main className="pt-24 px-container-margin max-w-md mx-auto flex flex-col gap-stack-md">
        {/* Header Section */}
        <div className="flex flex-col gap-2">
          <h1 className="text-headline-lg-mobile font-headline-lg-mobile text-on-surface">Dashboard Kartu Saya</h1>
          <p className="text-body-sm font-body-sm text-on-surface-variant">Kelola pengaturan perangkat Ratey Anda.</p>
        </div>

        {/* Alert Notification */}
        {successMsg && (
          <div className="bg-accent-green-bg border border-accent-green-border text-on-tertiary-fixed-variant p-3.5 rounded-xl text-body-sm font-body-sm flex items-center gap-2 animate-fade-in">
            <span className="material-symbols-outlined text-cta-activation">check_circle</span>
            <span className="font-semibold">{successMsg}</span>
          </div>
        )}

        {/* Main Card Info Container */}
        <section className="bg-surface-white border border-outline-variant rounded-xl shadow-sm p-6 relative overflow-hidden flex flex-col gap-6">
          <div className="absolute -right-4 -top-4 opacity-5 pointer-events-none transform rotate-12">
            <span className="material-symbols-outlined text-9xl">contactless</span>
          </div>

          <div className="relative z-10 flex justify-between items-start">
            <div className="flex flex-col gap-1">
              <span className="text-label-caps font-label-caps text-on-surface-variant uppercase tracking-wider">
                Status Perangkat
              </span>
              <div className="inline-flex items-center gap-1.5 mt-1">
                <span className="flex h-2.5 w-2.5 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cta-activation opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cta-activation"></span>
                </span>
                <span className="text-label-bold font-label-bold text-cta-activation">Aktif</span>
              </div>
            </div>

            <div className="h-10 w-10 rounded-full bg-surface-container flex items-center justify-center">
              <span className="material-symbols-outlined text-on-surface" style={{ fontVariationSettings: "'FILL' 1" }}>
                nfc
              </span>
            </div>
          </div>

          <div className="relative z-10 flex flex-col gap-1">
            <span className="text-label-caps font-label-caps text-on-surface-variant uppercase tracking-wider">Card ID</span>
            <span className="text-body-lg font-body-lg font-mono font-bold tracking-widest text-on-surface">
              {cardId}
            </span>
          </div>

          <div className="relative z-10 pt-4 border-t border-outline-variant flex flex-col gap-1">
            <span className="text-label-caps font-label-caps text-on-surface-variant uppercase tracking-wider">
              Bisnis Terhubung
            </span>
            <span className="text-headline-md font-headline-md text-on-surface">
              {currentBusinessName}
            </span>
          </div>
        </section>

        {/* Statistics Bento Block */}
        <section className="bg-surface-white border border-outline-variant rounded-xl shadow-sm p-6 flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-label-caps font-label-caps text-on-surface-variant uppercase tracking-wider">
              Total Tap/Scan
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-headline-lg-mobile font-headline-lg-mobile text-on-surface">Aktif</span>
              <span className="text-body-sm font-body-sm text-text-muted">interaksi</span>
            </div>
          </div>
          <div className="h-12 w-12 rounded-full bg-secondary-container/10 flex items-center justify-center text-secondary">
            <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>
              bar_chart
            </span>
          </div>
        </section>

        {/* Quick Actions Stack */}
        <section className="flex flex-col gap-3 mt-2">
          <button
            onClick={() => {
              setActiveModal("link");
              setErrorMsg("");
              setCurrentPinDigits(["", "", "", ""]);
            }}
            className="w-full flex items-center justify-center gap-2 bg-primary text-on-primary h-12 rounded-lg text-label-bold font-label-bold hover:bg-on-surface transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-lg">link</span>
            <span>Ganti Link Review</span>
          </button>

          <button
            onClick={() => {
              setActiveModal("pin");
              setErrorMsg("");
              setCurrentPinDigits(["", "", "", ""]);
              setNewPinDigits(["", "", "", ""]);
            }}
            className="w-full flex items-center justify-center gap-2 bg-surface-white border border-outline-variant text-on-surface h-12 rounded-lg text-label-bold font-label-bold hover:bg-surface-container transition-colors shadow-sm cursor-pointer"
          >
            <span className="material-symbols-outlined text-lg">lock_reset</span>
            <span>Ubah PIN</span>
          </button>
        </section>

        {/* Support Link */}
        <section className="mt-4 flex justify-center pb-8">
          <a
            href="https://wa.me/6281234567890"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 text-label-bold font-label-bold text-secondary hover:text-on-secondary-fixed transition-colors"
          >
            <span className="material-symbols-outlined text-lg">help</span>
            <span>Butuh bantuan? Hubungi Support</span>
          </a>
        </section>
      </main>

      {/* MODAL GANTI LINK REVIEW */}
      {activeModal === "link" && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-surface-white rounded-2xl p-6 max-w-md w-full animate-fade-in shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-headline-md font-headline-md text-primary">Ganti Link Google Review</h3>
              <button
                onClick={() => setActiveModal(null)}
                className="text-on-surface-variant hover:text-primary text-xl font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveLink} autoComplete="off" className="flex flex-col gap-4">
              <div>
                <label className="text-label-bold font-label-bold text-on-surface block mb-1">
                  Cari Nama Bisnis Baru
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => handleQueryChange(e.target.value)}
                    placeholder="Contoh: Kopi Senja Jakarta"
                    className="w-full p-3 border border-outline-variant rounded-lg text-body-md outline-none focus:ring-2 focus:ring-secondary"
                  />
                  {isSearching && <div className="spinner absolute right-3 top-3.5" />}
                </div>

                {suggestions.length > 0 && !selectedPlace && (
                  <ul className="mt-1 bg-surface-white border border-outline-variant rounded-lg shadow-lg max-h-40 overflow-y-auto divide-y">
                    {suggestions.map((s) => (
                      <li
                        key={s.place_id}
                        onClick={() => handleSelectPlace(s)}
                        className="p-2.5 text-body-sm hover:bg-surface-container cursor-pointer flex items-center gap-2"
                      >
                        <span className="material-symbols-outlined text-secondary text-sm">pin_drop</span>
                        <span>{s.description}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <label className="text-label-bold font-label-bold text-on-surface block mb-1">
                  atau Link Google Maps Review
                </label>
                <input
                  type="text"
                  value={customLink}
                  onChange={(e) => setCustomLink(e.target.value)}
                  placeholder="https://search.google.com/local/writereview?placeid=..."
                  className="w-full p-3 border border-outline-variant rounded-lg text-body-md outline-none focus:ring-2 focus:ring-secondary"
                />
              </div>

              {/* 4-Box PIN Input for Verification */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-label-bold font-label-bold text-on-surface block">
                    Masukkan PIN 4 Digit (Verifikasi)
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowCurrentPin(!showCurrentPin)}
                    className="text-xs text-secondary font-semibold"
                  >
                    {showCurrentPin ? "Sembunyikan" : "Lihat PIN"}
                  </button>
                </div>

                <div className="pin-container my-2">
                  {currentPinDigits.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={currentPinRefs[idx]}
                      type={showCurrentPin ? "text" : "password"}
                      autoComplete="new-password"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handlePinChange(currentPinDigits, setCurrentPinDigits, currentPinRefs, idx, e.target.value)}
                      onKeyDown={(e) => handlePinKeyDown(currentPinDigits, currentPinRefs, idx, e)}
                      onPaste={(e) => handlePinPaste(setCurrentPinDigits, currentPinRefs, e)}
                      className={`pin-box ${digit ? "filled" : ""}`}
                    />
                  ))}
                </div>
              </div>

              {errorMsg && (
                <div className="bg-accent-red-bg border border-accent-red-border text-accent-red p-2.5 rounded-lg text-body-sm">
                  ⚠️ {errorMsg}
                </div>
              )}

              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="flex-1 py-3 border border-outline-variant rounded-lg font-label-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={status === "saving"}
                  className="flex-1 py-3 bg-primary text-on-primary rounded-lg font-label-bold hover:bg-on-surface"
                >
                  {status === "saving" ? "Menyimpan..." : "Simpan Link"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL UBAH PIN */}
      {activeModal === "pin" && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-surface-white rounded-2xl p-6 max-w-md w-full animate-fade-in shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-headline-md font-headline-md text-primary">Ubah PIN Rahasia</h3>
              <button
                onClick={() => setActiveModal(null)}
                className="text-on-surface-variant hover:text-primary text-xl font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSavePin} autoComplete="off" className="flex flex-col gap-4">
              {/* PIN Lama */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-label-bold font-label-bold text-on-surface block">
                    PIN Lama (4 Angka)
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowCurrentPin(!showCurrentPin)}
                    className="text-xs text-secondary font-semibold"
                  >
                    {showCurrentPin ? "Sembunyikan" : "Lihat PIN"}
                  </button>
                </div>

                <div className="pin-container my-2">
                  {currentPinDigits.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={currentPinRefs[idx]}
                      type={showCurrentPin ? "text" : "password"}
                      autoComplete="new-password"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handlePinChange(currentPinDigits, setCurrentPinDigits, currentPinRefs, idx, e.target.value)}
                      onKeyDown={(e) => handlePinKeyDown(currentPinDigits, currentPinRefs, idx, e)}
                      onPaste={(e) => handlePinPaste(setCurrentPinDigits, currentPinRefs, e)}
                      className={`pin-box ${digit ? "filled" : ""}`}
                    />
                  ))}
                </div>
              </div>

              {/* PIN Baru */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-label-bold font-label-bold text-on-surface block">
                    PIN Baru (4 Angka)
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowNewPin(!showNewPin)}
                    className="text-xs text-secondary font-semibold"
                  >
                    {showNewPin ? "Sembunyikan" : "Lihat PIN"}
                  </button>
                </div>

                <div className="pin-container my-2">
                  {newPinDigits.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={newPinRefs[idx]}
                      type={showNewPin ? "text" : "password"}
                      autoComplete="new-password"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handlePinChange(newPinDigits, setNewPinDigits, newPinRefs, idx, e.target.value)}
                      onKeyDown={(e) => handlePinKeyDown(newPinDigits, newPinRefs, idx, e)}
                      onPaste={(e) => handlePinPaste(setNewPinDigits, newPinRefs, e)}
                      className={`pin-box ${digit ? "filled" : ""}`}
                    />
                  ))}
                </div>
              </div>

              {errorMsg && (
                <div className="bg-accent-red-bg border border-accent-red-border text-accent-red p-2.5 rounded-lg text-body-sm">
                  ⚠️ {errorMsg}
                </div>
              )}

              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="flex-1 py-3 border border-outline-variant rounded-lg font-label-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={status === "saving"}
                  className="flex-1 py-3 bg-primary text-on-primary rounded-lg font-label-bold hover:bg-on-surface"
                >
                  {status === "saving" ? "Menyimpan..." : "Simpan PIN"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BottomNavBar Shared Component */}
      <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center h-20 bg-surface-white border-t border-outline-variant px-safe-area-inset-x shadow-sm md:hidden">
        <Link className="flex flex-col items-center justify-center text-on-surface-variant hover:text-secondary transition-colors w-16" href="/">
          <span className="material-symbols-outlined mb-1" style={{ fontVariationSettings: "'FILL' 0" }}>home</span>
          <span className="text-label-caps font-label-caps">Beranda</span>
        </Link>
        <a className="flex flex-col items-center justify-center text-on-surface-variant hover:text-secondary transition-colors w-16" href="/#portal">
          <span className="material-symbols-outlined mb-1" style={{ fontVariationSettings: "'FILL' 0" }}>sensors</span>
          <span className="text-label-caps font-label-caps">Aktivasi</span>
        </a>
        <div className="flex flex-col items-center justify-center text-secondary bg-secondary-container/10 rounded-xl px-4 py-2 scale-95 transition-transform duration-200">
          <span className="material-symbols-outlined mb-1" style={{ fontVariationSettings: "'FILL' 1" }}>dashboard</span>
          <span className="text-label-caps font-label-caps font-bold">Dashboard</span>
        </div>
      </nav>
    </div>
  );
}
