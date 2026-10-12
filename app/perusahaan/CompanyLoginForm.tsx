"use client";

import { useState } from "react";
import { slugifyCompany } from "@/lib/company-slug";

export default function CompanyLoginForm({ companyName }: { companyName: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const companySlug = slugifyCompany(companyName);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError("Email dan password wajib diisi.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/company/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password, companyName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Login gagal.");
      window.location.href = `/perusahaan/${companySlug}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login gagal.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-[#3C3833] flex items-center justify-center mb-4 shadow-lg">
            <span className="material-symbols-outlined text-white text-3xl">apartment</span>
          </div>
          <h1 className="text-2xl font-bold text-[#3C3833]">Portal Perusahaan</h1>
          <p className="text-sm text-[#8E897C] mt-1">{companyName}</p>
          <p className="text-xs text-[#B5AFA3] mt-0.5">
            Kelola & pantau kartu review perusahaan Anda
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl border border-[#E8E3DA] shadow-sm p-6 space-y-4"
        >
          <div>
            <label className="block text-xs font-bold text-[#5C564A] mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nama@perusahaan.com"
              disabled={loading}
              className="w-full bg-[#FAF8F5] border border-[#E8E3DA] rounded-xl px-4 py-2.5 text-sm font-bold text-[#3C3833] placeholder:text-[#B5AFA3] focus:outline-none focus:border-[#3C3833] disabled:opacity-60"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-[#5C564A] mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              disabled={loading}
              className="w-full bg-[#FAF8F5] border border-[#E8E3DA] rounded-xl px-4 py-2.5 text-sm font-bold text-[#3C3833] placeholder:text-[#B5AFA3] focus:outline-none focus:border-[#3C3833] disabled:opacity-60"
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-100">
              <span className="material-symbols-outlined text-red-500 text-[16px]">error</span>
              <p className="text-xs font-bold text-red-600 leading-relaxed">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#3C3833] text-white font-bold text-sm py-3 rounded-xl hover:bg-black transition-colors disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading ? (
              <>
                <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                Masuk...
              </>
            ) : (
              "Masuk"
            )}
          </button>
        </form>

        <p className="text-center text-xs text-[#B5AFA3] mt-6">
          Hubungi admin Ratey untuk mendapatkan akun portal perusahaan.
        </p>
      </div>
    </div>
  );
}
