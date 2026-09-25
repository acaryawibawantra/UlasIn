"use client";

import { useState } from "react";
import Link from "next/link";
import SmartRedirect from "./SmartRedirect";

type GuardStage = "rating" | "negative" | "thanks";

export default function RatingGuard({
  cardId,
  businessName,
  googleReviewUrl,
  placeId,
}: {
  cardId: string;
  businessName: string;
  googleReviewUrl: string;
  placeId?: string | null;
}) {
  const [stage, setStage] = useState<GuardStage>("rating");
  const [rating, setRating] = useState(0);
  const [hoveredStar, setHoveredStar] = useState(0);

  // Form keluhan (rating 1-3)
  const [message, setMessage] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // Link ke lokasi Maps (bukan halaman review) — dipakai di layar terima kasih
  const mapsLocationUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    businessName || cardId
  )}${placeId ? `&query_place_id=${encodeURIComponent(placeId)}` : ""}`;

  function handleSelectStar(value: number) {
    setRating(value);
    if (value >= 4) {
      // Positif -> langsung arahkan ke Google Review (SmartRedirect handle buka app Maps)
      setStage("rating");
      return;
    }
    // Negatif -> tahan dulu di Ratey, minta keluhan
    setStage("negative");
  }

  async function handleSubmitFeedback(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError("");

    if (message.trim().length < 10) {
      setSubmitError("Ceritakan keluhan Anda minimal 10 karakter.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cardId,
          rating,
          message: message.trim(),
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error || "Gagal mengirim keluhan. Coba lagi.");
        return;
      }

      setStage("thanks");
    } catch (err) {
      setSubmitError("Terjadi kesalahan koneksi. Silakan coba lagi.");
    } finally {
      setIsSubmitting(false);
    }
  }

  // ── RATING 4-5: terima kasih + auto redirect ke Google Review ──
  if (stage === "rating" && rating >= 4) {
    return (
      <div className="bg-background text-on-background min-h-screen flex flex-col md:items-center md:justify-center p-4 md:p-container-margin">
        <div className="w-full max-w-[480px] bg-surface-container-lowest md:rounded-xl md:shadow-ambient-soft md:border md:border-outline-variant p-8 flex flex-col items-center gap-4 mx-auto text-center animate-fade-in">
          <span className="material-symbols-outlined text-5xl text-cta-activation" style={{ fontVariationSettings: "'FILL' 1" }}>
            favorite
          </span>
          <h1 className="text-headline-lg-mobile font-headline-lg-mobile md:text-headline-lg text-on-surface">
            Terima kasih! 🎉
          </h1>
          <p className="text-body-md font-body-md text-on-surface-variant flex items-center gap-2 justify-center">
            <span className="spinner" />
            Mengarahkan ke Google Review...
          </p>
        </div>
        {/* Redirect ke halaman Google Review (dialog rating langsung) */}
        <SmartRedirect googleReviewUrl={googleReviewUrl} />
      </div>
    );
  }

  // ── TERIMA KASIH (setelah kirim keluhan) ──
  if (stage === "thanks") {
    return (
      <div className="bg-background text-on-background min-h-screen flex flex-col md:items-center md:justify-center p-0 md:p-container-margin">
        <header className="fixed top-0 w-full z-50 flex justify-between items-center px-4 h-16 bg-surface-white border-b border-outline-variant md:hidden">
          <Link href="/" className="text-on-surface-variant flex items-center justify-center w-10 h-10 rounded-full hover:bg-surface-container transition-colors">
            <span className="material-symbols-outlined">arrow_back</span>
          </Link>
          <div className="flex items-center gap-2.5">
            <img src="/ratey-logo.png" alt="Ratey Logo" className="w-9 h-9 object-cover rounded-xl" />
            <div className="text-headline-md font-headline-md font-bold text-primary">Ratey</div>
          </div>
          <div className="w-10" />
        </header>

        <main className="w-full max-w-[480px] bg-surface-container-lowest md:rounded-xl md:shadow-ambient-soft md:border md:border-outline-variant mt-16 md:mt-0 pt-stack-lg pb-stack-lg px-container-margin md:p-8 flex flex-col items-center gap-stack-lg mx-auto text-center animate-fade-in">
          <div className="w-16 h-16 rounded-full bg-accent-green-bg border border-accent-green-border text-accent-green flex items-center justify-center mx-auto">
            <span className="material-symbols-outlined text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>
              mark_email_read
            </span>
          </div>

          <div>
            <h1 className="text-headline-lg-mobile font-headline-lg-mobile md:text-headline-lg text-on-surface mb-2">
              Terima kasih atas masukan Anda 🙏
            </h1>
            <p className="text-body-md font-body-md text-on-surface-variant">
              Keluhan Anda sudah kami teruskan ke tim <strong>{businessName}</strong> dan akan segera ditindaklanjuti.
            </p>
          </div>

          <div className="flex flex-col gap-3 w-full">
            <a
              href={mapsLocationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full bg-cta-activation hover:brightness-110 text-on-primary text-label-bold font-label-bold py-4 px-6 rounded-lg shadow-ambient-soft transition-colors flex items-center justify-center gap-2 min-h-[48px]"
            >
              <span className="material-symbols-outlined text-sm">pin_drop</span>
              <span>Lihat Lokasi di Google Maps</span>
            </a>
          </div>
        </main>
      </div>
    );
  }

  // ── FORM KELUHAN (rating 1-3) ──
  if (stage === "negative") {
    return (
      <div className="bg-background text-on-background min-h-screen flex flex-col md:items-center md:justify-center p-0 md:p-container-margin">
        <header className="fixed top-0 w-full z-50 flex justify-between items-center px-4 h-16 bg-surface-white border-b border-outline-variant md:hidden">
          <Link href="/" className="text-on-surface-variant flex items-center justify-center w-10 h-10 rounded-full hover:bg-surface-container transition-colors">
            <span className="material-symbols-outlined">arrow_back</span>
          </Link>
          <div className="flex items-center gap-2.5">
            <img src="/ratey-logo.png" alt="Ratey Logo" className="w-9 h-9 object-cover rounded-xl" />
            <div className="text-headline-md font-headline-md font-bold text-primary">Ratey</div>
          </div>
          <div className="w-10" />
        </header>

        <main className="w-full max-w-[480px] bg-surface-container-lowest md:rounded-xl md:shadow-ambient-soft md:border md:border-outline-variant mt-16 md:mt-0 pt-stack-md pb-stack-lg px-container-margin md:p-8 flex flex-col gap-stack-md mx-auto animate-fade-in">
          <section className="flex flex-col gap-base">
            <div className="flex items-center gap-1 mb-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <span
                  key={i}
                  className="material-symbols-outlined text-2xl"
                  style={{
                    color: i < rating ? "#F5A623" : undefined,
                    fontVariationSettings: i < rating ? "'FILL' 1" : "'FILL' 0",
                  }}
                >
                  star
                </span>
              ))}
            </div>
            <h1 className="text-headline-lg-mobile font-headline-lg-mobile md:text-headline-lg text-on-surface">
              Kami mohon maaf 🙏
            </h1>
            <p className="text-body-sm font-body-sm text-on-surface-variant">
              Atas pengalaman kurang menyenangkan Anda di <strong>{businessName}</strong>. Ceritakan kendalanya — masukan Anda langsung sampai ke tim kami untuk ditindaklanjuti.
            </p>
          </section>

          <form onSubmit={handleSubmitFeedback} autoComplete="off" className="flex flex-col gap-stack-md">
            <div className="flex flex-col gap-base">
              <label className="text-label-bold font-label-bold text-on-surface" htmlFor="keluhan">
                Ceritakan Keluhan Anda <span className="text-accent-red">*</span>
              </label>
              <textarea
                id="keluhan"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Contoh: pesanan lama, pelayanan kurang ramah, tempat kurang bersih..."
                rows={5}
                maxLength={2000}
                required
                className="w-full p-3 bg-surface-container-lowest border border-outline-variant rounded-lg text-body-md font-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary focus:border-secondary transition-all resize-none"
              />
              <p className="text-[12px] text-text-muted">{message.trim().length}/2000 karakter (min. 10)</p>
            </div>

            <div className="flex flex-col gap-base">
              <label className="text-label-bold font-label-bold text-on-surface" htmlFor="nama">
                Nama <span className="text-text-muted font-normal">(opsional)</span>
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-outline">
                  <span className="material-symbols-outlined">person</span>
                </span>
                <input
                  id="nama"
                  type="text"
                  autoComplete="off"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Nama Anda"
                  maxLength={100}
                  className="w-full pl-10 pr-4 py-3 bg-surface-container-lowest border border-outline-variant rounded-lg text-body-md font-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary focus:border-secondary transition-all"
                />
              </div>
            </div>

            <div className="flex flex-col gap-base">
              <label className="text-label-bold font-label-bold text-on-surface" htmlFor="nohp">
                No. HP <span className="text-text-muted font-normal">(opsional, untuk follow-up)</span>
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-outline">
                  <span className="material-symbols-outlined">call</span>
                </span>
                <input
                  id="nohp"
                  type="tel"
                  inputMode="tel"
                  autoComplete="off"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="08xxxxxxxxxx"
                  maxLength={20}
                  className="w-full pl-10 pr-4 py-3 bg-surface-container-lowest border border-outline-variant rounded-lg text-body-md font-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary focus:border-secondary transition-all"
                />
              </div>
            </div>

            {submitError && (
              <div className="bg-accent-red-bg border border-accent-red-border text-accent-red p-3 rounded-lg text-body-sm font-body-sm">
                ⚠️ {submitError}
              </div>
            )}

            <div className="flex flex-col gap-3 mt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-cta-activation hover:brightness-110 text-on-primary text-label-bold font-label-bold py-4 px-6 rounded-lg shadow-ambient-soft transition-colors flex items-center justify-center gap-2 min-h-[48px] cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <div className="spinner" />
                    <span>Mengirim...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
                      send
                    </span>
                    <span>Kirim Masukan</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setStage("rating");
                  setRating(0);
                  setSubmitError("");
                }}
                className="w-full text-label-bold font-label-bold text-secondary hover:underline py-2 cursor-pointer"
              >
                ← Ubah Rating
              </button>
            </div>
          </form>
        </main>
      </div>
    );
  }

  // ── STAGE AWAL: PILIH BINTANG ──
  return (
    <div className="bg-background text-on-background min-h-screen flex flex-col md:items-center md:justify-center p-0 md:p-container-margin">
      {/* Top App Bar (Mobile Only) */}
      <header className="fixed top-0 w-full z-50 flex justify-between items-center px-4 h-16 bg-surface-white border-b border-outline-variant md:hidden">
        <Link href="/" className="text-on-surface-variant flex items-center justify-center w-10 h-10 rounded-full hover:bg-surface-container transition-colors">
          <span className="material-symbols-outlined">arrow_back</span>
        </Link>
        <div className="flex items-center gap-2.5">
          <img src="/ratey-logo.png" alt="Ratey Logo" className="w-9 h-9 object-cover rounded-xl" />
          <div className="text-headline-md font-headline-md font-bold text-primary">Ratey</div>
        </div>
        <div className="w-10" />
      </header>

      <main className="w-full max-w-[480px] bg-surface-container-lowest md:rounded-xl md:shadow-ambient-soft md:border md:border-outline-variant mt-16 md:mt-0 pt-stack-lg pb-stack-lg px-container-margin md:p-8 flex flex-col items-center gap-stack-lg mx-auto text-center animate-fade-in">
        {/* Badge bisnis */}
        <div className="w-14 h-14 rounded-2xl bg-secondary-container/10 text-secondary flex items-center justify-center">
          <span className="material-symbols-outlined text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>
            storefront
          </span>
        </div>

        <div>
          <span className="text-label-caps font-label-caps text-secondary bg-secondary/10 px-2.5 py-1 rounded-md font-semibold inline-block mb-3">
            {businessName || "Ulasan"}
          </span>
          <h1 className="text-headline-lg-mobile font-headline-lg-mobile md:text-headline-lg text-on-surface mb-2">
            Bagaimana pengalaman Anda?
          </h1>
          <p className="text-body-md font-body-md text-on-surface-variant">
            Beri rating untuk membantu {businessName || "kami"} memberikan pelayanan lebih baik.
          </p>
        </div>

        {/* 5 Bintang Interaktif */}
        <div
          className="flex items-center justify-center gap-2 py-2"
          onMouseLeave={() => setHoveredStar(0)}
        >
          {Array.from({ length: 5 }).map((_, i) => {
            const value = i + 1;
            const active = value <= (hoveredStar || rating);
            return (
              <button
                key={value}
                type="button"
                aria-label={`Beri ${value} bintang`}
                onMouseEnter={() => setHoveredStar(value)}
                onClick={() => handleSelectStar(value)}
                className="transition-transform hover:scale-110 active:scale-95 cursor-pointer touch-manipulation"
              >
                <span
                  className="material-symbols-outlined text-5xl select-none"
                  style={{
                    color: active ? "#F5A623" : "var(--color-outline, #CAC4D0)",
                    fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0",
                  }}
                >
                  star
                </span>
              </button>
            );
          })}
        </div>

        <p className="text-body-sm font-body-sm text-text-muted flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[16px]">lock</span>
          Rating Anda aman dan tidak dipublikasikan tanpa izin.
        </p>
      </main>
    </div>
  );
}
