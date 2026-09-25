"use client";

import { useState } from "react";
import Link from "next/link";
import SmartRedirect from "./SmartRedirect";

type GuardStage = "rating" | "negative" | "thanks";

// Header mobile (dipakai semua layar guard): logo Ratey + tombol back.
// Fullwidth fixed di atas; disembunyikan di desktop.
function MobileHeader() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 h-16 bg-surface-white border-b border-outline-variant md:hidden">
      <Link
        href="/"
        aria-label="Kembali"
        className="text-on-surface-variant flex items-center justify-center w-10 h-10 rounded-full hover:bg-surface-container transition-colors"
      >
        <span className="material-symbols-outlined">arrow_back</span>
      </Link>
      <div className="flex items-center gap-2.5">
        <img src="/ratey-logo.png" alt="Ratey Logo" className="w-9 h-9 object-cover rounded-xl" />
        <div className="text-headline-md font-headline-md font-bold text-primary">Ratey</div>
      </div>
      <div className="w-10" />
    </header>
  );
}

export default function RatingGuard({
  cardId,
  businessName,
  googleReviewUrl,
}: {
  cardId: string;
  businessName: string;
  googleReviewUrl: string;
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

  function handleSelectStar(value: number) {
    setRating(value);
    if (value >= 4) return; // positif -> render redirect di bawah
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

  // ── RATING 4-5: terima kasih singkat + auto redirect ke Google Review ──
  if (stage === "rating" && rating >= 4) {
    return (
      <div className="bg-background text-on-background min-h-[100dvh] flex flex-col md:items-center md:justify-center p-0 md:p-container-margin">
        <MobileHeader />

        <div className="flex-1 md:flex-none w-full max-w-[480px] mx-auto mt-16 md:mt-0 flex items-center justify-center px-4 md:px-0 py-8">
          <div className="w-full bg-surface-container-lowest md:rounded-xl md:shadow-ambient-soft md:border md:border-outline-variant px-6 py-10 md:p-10 flex flex-col items-center gap-4 text-center animate-fade-in">
            <span
              className="material-symbols-outlined"
              style={{ fontSize: 64, color: "#F5A623", fontVariationSettings: "'FILL' 1" }}
            >
              favorite
            </span>
            <h1 className="text-headline-lg-mobile font-headline-lg-mobile md:text-headline-lg text-on-surface">
              Terima kasih! 🎉
            </h1>
            <p className="text-body-md font-body-md text-on-surface-variant flex items-center gap-2 justify-center">
              <span className="spinner" />
              Membuka Google Review...
            </p>
          </div>
        </div>

        {/* SmartRedirect disembunyikan dari layout — hanya efek navigasinya yang dipakai
            (tanpa ini div min-h-screen-nya merusak posisi kartu / layout tidak responsive) */}
        <div className="hidden" aria-hidden="true">
          <SmartRedirect googleReviewUrl={googleReviewUrl} />
        </div>
      </div>
    );
  }

  // ── TERIMA KASIH (setelah kirim keluhan) -> ajak beri Google Rating ──
  if (stage === "thanks") {
    return (
      <div className="bg-background text-on-background min-h-[100dvh] flex flex-col md:items-center md:justify-center p-0 md:p-container-margin">
        <MobileHeader />

        <main className="flex-1 md:flex-none w-full max-w-[480px] mx-auto mt-16 md:mt-0 flex items-center px-4 md:px-0 py-8">
          <div className="w-full bg-surface-container-lowest md:rounded-xl md:shadow-ambient-soft md:border md:border-outline-variant pt-stack-lg pb-stack-lg px-6 md:p-8 flex flex-col items-center justify-center gap-stack-lg text-center animate-fade-in">
            <div className="w-16 h-16 rounded-full bg-accent-green-bg border border-accent-green-border text-accent-green flex items-center justify-center">
              <span className="material-symbols-outlined text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                mark_email_read
              </span>
            </div>

            <div>
              <h1 className="text-headline-lg-mobile font-headline-lg-mobile md:text-headline-lg text-on-surface mb-2">
                Terima kasih atas masukan Anda 🙏
              </h1>
              <p className="text-body-md font-body-md text-on-surface-variant">
                Keluhan Anda sudah kami terima dan akan ditindaklanjuti oleh tim{" "}
                <strong>{businessName}</strong>.
              </p>
            </div>

            <a
              href={googleReviewUrl}
              className="w-full bg-cta-activation hover:brightness-110 text-on-primary text-label-bold font-label-bold py-4 px-6 rounded-lg shadow-ambient-soft transition-colors flex items-center justify-center gap-2 min-h-[48px]"
            >
              <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>
                star
              </span>
              <span>Beri Google Rating</span>
            </a>
            <p className="text-[12px] text-text-muted -mt-2">
              Kalau berkenan, ulasan Anda di Google sangat membantu kami.
            </p>
          </div>
        </main>
      </div>
    );
  }

  // ── FORM KELUHAN (rating 1-3) ──
  if (stage === "negative") {
    return (
      <div className="bg-background text-on-background min-h-[100dvh] flex flex-col md:items-center md:justify-center p-0 md:p-container-margin">
        <MobileHeader />

        <main className="flex-1 md:flex-none w-full max-w-[480px] bg-surface-container-lowest md:rounded-xl md:shadow-ambient-soft md:border md:border-outline-variant mt-16 md:mt-0 pt-stack-md pb-stack-lg px-container-margin md:p-8 flex flex-col justify-center gap-stack-md mx-auto animate-fade-in">
          <section className="flex flex-col gap-base text-center">
            <div className="flex items-center justify-center gap-1">
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
              Ceritakan apa yang kurang berkenan — masukan Anda langsung kami tindaklanjuti.
            </p>
          </section>

          <form onSubmit={handleSubmitFeedback} autoComplete="off" className="flex flex-col gap-stack-md">
            <div className="flex flex-col gap-base">
              <textarea
                id="keluhan"
                aria-label="Ceritakan keluhan Anda"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Contoh: pesanan lama, pelayanan kurang ramah..."
                rows={5}
                maxLength={2000}
                required
                autoFocus
                className="w-full p-3 bg-surface-container-lowest border border-outline-variant rounded-lg text-body-md font-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary focus:border-secondary transition-all resize-none"
              />
              <p className="text-[12px] text-text-muted text-right">{message.trim().length}/2000 (min. 10)</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-base">
                <label className="text-label-bold font-label-bold text-on-surface" htmlFor="nama">
                  Nama <span className="text-text-muted font-normal">(opsional)</span>
                </label>
                <input
                  id="nama"
                  type="text"
                  autoComplete="off"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Nama Anda"
                  maxLength={100}
                  className="w-full p-3 bg-surface-container-lowest border border-outline-variant rounded-lg text-body-md font-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary focus:border-secondary transition-all"
                />
              </div>

              <div className="flex flex-col gap-base">
                <label className="text-label-bold font-label-bold text-on-surface" htmlFor="nohp">
                  No. HP <span className="text-text-muted font-normal">(opsional)</span>
                </label>
                <input
                  id="nohp"
                  type="tel"
                  inputMode="tel"
                  autoComplete="off"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="08xxxxxxxxxx"
                  maxLength={20}
                  className="w-full p-3 bg-surface-container-lowest border border-outline-variant rounded-lg text-body-md font-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary focus:border-secondary transition-all"
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
    <div className="bg-background text-on-background min-h-[100dvh] flex flex-col md:items-center md:justify-center p-0 md:p-container-margin">
      <MobileHeader />

      <main className="flex-1 md:flex-none w-full max-w-[480px] bg-surface-container-lowest md:rounded-xl md:shadow-ambient-soft md:border md:border-outline-variant mt-16 md:mt-0 pt-stack-lg pb-stack-lg px-container-margin md:p-8 flex flex-col items-center justify-center gap-stack-lg mx-auto text-center animate-fade-in">
        {/* Badge bisnis */}
        <div className="w-14 h-14 rounded-2xl bg-secondary-container/10 text-secondary flex items-center justify-center">
          <span className="material-symbols-outlined text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>
            storefront
          </span>
        </div>

        <div>
          {/* Nama outlet cukup disebut sekali di sini */}
          <span className="text-label-caps font-label-caps text-secondary bg-secondary/10 px-2.5 py-1 rounded-md font-semibold inline-block mb-3 max-w-full truncate align-bottom">
            {businessName || "Ulasan"}
          </span>
          <h1 className="text-headline-lg-mobile font-headline-lg-mobile md:text-headline-lg text-on-surface mb-2">
            Bagaimana pengalaman Anda?
          </h1>
          <p className="text-body-md font-body-md text-on-surface-variant">
            Beri rating untuk membantu kami memberikan pelayanan yang lebih baik.
          </p>
        </div>

        {/* 5 Bintang BESAR */}
        <div className="flex items-center justify-center gap-3 py-2 w-full" onMouseLeave={() => setHoveredStar(0)}>
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
                className="p-1 -m-1 transition-transform hover:scale-110 active:scale-90 cursor-pointer touch-manipulation"
              >
                <span
                  className="material-symbols-outlined select-none"
                  style={{
                    // Responsif: besar di layar lebar, menyusut otomatis di layar sempit
                    fontSize: "clamp(44px, 12vw, 56px)",
                    lineHeight: 1,
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
          <span>4-5 langsung ke Google Review · 1-3 ceritakan langsung ke kami</span>
        </p>
      </main>
    </div>
  );
}
