"use client";

import { useEffect } from "react";

interface SmartRedirectProps {
  googleReviewUrl: string;
}

// Redirect ke HALAMAN RATING Google (bukan aplikasi Maps).
// URL writereview?placeid=... otomatis memunculkan dialog rating:
// user langsung bisa kasih bintang & tulis review, tanpa perlu
// cari tombol "Tulis Review" di dalam app Maps.
export default function SmartRedirect({ googleReviewUrl }: SmartRedirectProps) {
  useEffect(() => {
    const target = googleReviewUrl;
    if (!target) return;

    let fallbackTimer: ReturnType<typeof setTimeout> | null = null;

    const cancelFallback = () => {
      if (fallbackTimer) {
        clearTimeout(fallbackTimer);
        fallbackTimer = null;
      }
    };

    const onVisibilityChange = () => {
      // Halaman sudah tidak terlihat = Google sudah terbuka, jangan ganggu
      if (document.visibilityState === "hidden") {
        cancelFallback();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", cancelFallback);

    // Langsung navigasi ke halaman Google Review
    try {
      window.location.assign(target);
    } catch {
      window.location.href = target;
    }

    // Fallback: ~950ms kemudian (kalau halaman ini masih terlihat /
    // navigasi pertama gagal diam-diam), paksa buka review URL lagi.
    fallbackTimer = setTimeout(() => {
      if (document.visibilityState !== "visible") return;
      try {
        window.location.replace(target);
      } catch {
        window.location.href = target;
      }
    }, 950);

    return () => {
      cancelFallback();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", cancelFallback);
    };
  }, [googleReviewUrl]);

  return (
    <div className="min-h-screen w-full bg-background" aria-hidden="true" />
  );
}
