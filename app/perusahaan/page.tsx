import Link from "next/link";

// Landing page generic /perusahaan.
// Karena portal perusahaan pakai URL branded per nama perusahaan
// (mis. /perusahaan/kebab-baba-rafi), halaman ini hanya memberi info.
export default function PerusahaanLanding() {
  return (
    <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center p-4">
      <div className="w-full max-w-sm text-center">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-[#3C3833] flex items-center justify-center mb-4 shadow-lg">
          <span className="material-symbols-outlined text-white text-3xl">apartment</span>
        </div>
        <h1 className="text-2xl font-bold text-[#3C3833]">Portal Perusahaan</h1>
        <p className="text-sm text-[#8E897C] mt-2 leading-relaxed">
          Setiap perusahaan memiliki URL login tersendiri.
          <br />
          Hubungi admin Ratey untuk mendapatkan link portal perusahaan Anda.
        </p>
        <Link
          href="/"
          className="inline-block mt-6 text-xs font-bold text-[#3C3833] hover:underline"
        >
          ← Kembali ke beranda
        </Link>
      </div>
    </div>
  );
}
