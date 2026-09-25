import { notFound } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
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

  // Guard ON -> pelanggan rating dulu di Ratey:
  // bintang 4-5 auto-direct ke Google Review, bintang 1-3 isi keluhan.
  if (card.is_active && card.google_review_url && card.rating_guard) {
    return (
      <RatingGuard
        cardId={cardId}
        businessName={card.business_name}
        googleReviewUrl={card.google_review_url}
      />
    );
  }

  // Guard OFF (default) -> CLIENT-SIDE SMART REDIRECT (coba buka App Maps native, fallback ke web)
  // Lebih tinggi kesempatan terbuka di App Maps Google (Android/iOS) ketimbang server redirect langsung.
  // Kesan user: hampir instan (layar polos sekedip, tanpa spinner / text loading).
  if (card.is_active && card.google_review_url) {
    return (
      <SmartRedirect googleReviewUrl={card.google_review_url} />
    );
  }

  // Kartu belum aktif -> tampilkan form aktivasi
  return <ActivationForm cardId={cardId} />;
}
