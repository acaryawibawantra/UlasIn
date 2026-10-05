import { notFound } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { resolveReviewUrl } from "@/lib/review-url";
import ActivationForm from "./ActivationForm";
import SmartRedirect from "./SmartRedirect";
import RatingGuard from "./RatingGuard";

// Pastikan halaman ini SELALU mengecek database terbaru (tanpa cache Next.js)
// setiap kali kartu di-tap NFC / di-scan QR oleh siapapun.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CardPage({
  params,
}: {
  params: { card_id: string };
}) {
  const cardId = params.card_id.toUpperCase();
  const supabase = getSupabaseServerClient();

  const { data: card, error } = await supabase
    .from("cards")
    .select("*")
    .eq("card_id", cardId)
    .maybeSingle();

  if (error) {
    console.error("Error fetching card:", error.message);
    throw new Error("Terjadi kesalahan saat memuat kartu.");
  }

  if (!card) {
    notFound();
  }

  // Pengaman runtime: kalau google_review_url terlanjur berisi link share Maps
  // yang diblokir (bukan form ulasan), pakai URL aman dari place_id.
  const safeReviewUrl = resolveReviewUrl(card.place_id, card.google_review_url);

  // Guard ON -> pelanggan rating dulu di Ratey:
  // bintang 4-5 auto-direct ke Google Review, bintang 1-3 isi keluhan.
  if (card.is_active && safeReviewUrl && card.rating_guard) {
    return (
      <RatingGuard
        cardId={cardId}
        businessName={card.business_name}
        googleReviewUrl={safeReviewUrl}
      />
    );
  }

  // Guard OFF (default) -> CLIENT-SIDE SMART REDIRECT (coba buka App Maps native, fallback ke web)
  // Lebih tinggi kesempatan terbuka di App Maps Google (Android/iOS) ketimbang server redirect langsung.
  // Kesan user: hampir instan (layar polos sekedip, tanpa spinner / text loading).
  if (card.is_active && safeReviewUrl) {
    return (
      <SmartRedirect googleReviewUrl={safeReviewUrl} />
    );
  }

  // Kartu aktif tapi link tidak valid & tidak ada place_id -> jangan redirect ke tempat salah.
  if (card.is_active && !safeReviewUrl) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF8F5] text-[#3C3833] font-body">
        <div className="text-center px-6 max-w-md">
          <div className="w-16 h-16 rounded-2xl bg-[#F3EFEA] mx-auto mb-4 flex items-center justify-center">
            <span className="material-symbols-outlined text-[#8E897C] text-3xl">link_off</span>
          </div>
          <h1 className="font-bold text-lg mb-1">{card.business_name || "Kartu Ratey"}</h1>
          <p className="text-xs text-[#8E897C]">
            Link ulasan belum diatur dengan benar. Silakan hubungi pemilik usaha atau pengelola kartu.
          </p>
        </div>
      </div>
    );
  }

  // Kartu belum aktif -> tampilkan form aktivasi
  return <ActivationForm cardId={cardId} />;
}
