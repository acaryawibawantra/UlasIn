"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import AdminDashboard from "./AdminDashboard";

export default function AdminPage() {
  const [secretKey, setSecretKey] = useState("");
  const [inputKey, setInputKey] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Restore saved session from localStorage if available
  useEffect(() => {
    const savedKey =
      localStorage.getItem("ratey_admin_secret") ||
      localStorage.getItem("ulasin_admin_secret");
    if (savedKey) {
      setSecretKey(savedKey);
    }
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg("");

    if (!inputKey.trim()) {
      setErrorMsg("Masukkan Password Master Admin.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secretKey: inputKey }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "Password Master Admin salah.");
        return;
      }

      localStorage.setItem("ratey_admin_secret", inputKey);
      setSecretKey(inputKey);
    } catch (err) {
      setErrorMsg("Terjadi kesalahan koneksi server.");
    } finally {
      setIsLoading(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem("ratey_admin_secret");
    localStorage.removeItem("ulasin_admin_secret");
    setSecretKey("");
    setInputKey("");
  }

  // Logged In View
  if (secretKey) {
    return <AdminDashboard secretKey={secretKey} onLogout={handleLogout} />;
  }

  // Login View (Centered & Mobile-First)
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-container-margin">
      {/* Top Header Mobile Back Link */}
      <header className="fixed top-0 w-full z-50 flex justify-between items-center px-4 h-16 bg-surface-white border-b border-outline-variant">
        <Link href="/" className="flex items-center gap-2.5">
          <img src="/ratey-logo.png" alt="Ratey Logo" className="w-9 h-9 object-cover rounded-xl" />
          <span className="text-headline-md font-headline-md font-bold text-primary">Ratey</span>
        </Link>
        <span className="text-label-caps font-label-caps text-secondary bg-secondary/10 px-2.5 py-1 rounded-md font-semibold">
          Super Admin
        </span>
      </header>

      {/* Main Centered Login Box */}
      <main className="w-full max-w-[420px] bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-ambient-soft p-6 sm:p-8 flex flex-col gap-6 animate-fade-in mt-16 sm:mt-0">
        <div className="text-center flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-primary text-on-primary flex items-center justify-center shadow-md">
            <span className="material-symbols-outlined text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>
              admin_panel_settings
            </span>
          </div>

          <div>
            <h1 className="text-headline-md font-headline-md text-primary font-bold">
              Portal Super Admin Ratey
            </h1>
            <p className="text-body-sm font-body-sm text-on-surface-variant mt-1">
              Masukkan Password Master Admin untuk mengelola seluruh data kartu Ratey.
            </p>
          </div>
        </div>

        <form onSubmit={handleLogin} autoComplete="off" className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-label-bold font-label-bold text-on-surface" htmlFor="admin_password">
                Master Password Admin
              </label>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-xs text-secondary font-semibold hover:underline"
              >
                {showPassword ? "Sembunyikan" : "Lihat"}
              </button>
            </div>

            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-outline">
                <span className="material-symbols-outlined">lock</span>
              </span>
              <input
                id="admin_password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={inputKey}
                onChange={(e) => setInputKey(e.target.value)}
                placeholder="Masukkan password admin"
                className="w-full pl-10 pr-4 py-3 bg-surface-container-lowest border border-outline-variant rounded-lg text-body-md font-body-md text-on-[#191C1D] focus:outline-none focus:ring-2 focus:ring-secondary focus:border-secondary transition-all"
              />
            </div>
          </div>

          {errorMsg && (
            <div className="bg-accent-red-bg border border-accent-red-border text-accent-red p-3 rounded-lg text-body-sm font-body-sm">
              ⚠️ {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-primary hover:bg-primary-container text-on-primary text-label-bold font-label-bold py-3.5 px-6 rounded-lg shadow-ambient-soft transition-colors flex items-center justify-center gap-2 h-12 cursor-pointer mt-1"
          >
            {isLoading ? (
              <>
                <div className="spinner" />
                <span>Memverifikasi...</span>
              </>
            ) : (
              <>
                <span>Masuk ke Dashboard</span>
                <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </>
            )}
          </button>
        </form>

        <div className="text-center pt-2 border-t border-outline-variant/60">
          <Link href="/" className="text-body-sm font-body-sm text-secondary font-semibold hover:underline">
            ← Kembali ke Halaman Utama
          </Link>
        </div>
      </main>
    </div>
  );
}
