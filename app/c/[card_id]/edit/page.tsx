import { redirect, notFound } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import EditForm from "./EditForm";

// Pastikan halaman edit SELALU mengecek data Supabase terbaru secara real-time
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function EditPage({
  params,
}: {
  params: { card_id: string };
}) {
  const cardId = params.card_id.toUpperCase();
  const supabase = getSupabaseServerClient();

  const { data: card, error } = await supabase
    .from("cards")
    .select("card_id, business_name, google_review_url, is_active, rating_guard")
    .eq("card_id", cardId)
    .maybeSingle();

  if (error) {
    console.error("Error fetching card for edit:", error.message);
    throw new Error("Terjadi kesalahan saat memuat kartu.");
  }

  if (!card) {
    notFound();
  }

  if (!card.is_active) {
    // Jika kartu belum aktif, arahkan ke halaman aktivasi
    redirect(`/c/${cardId}`);
  }

  return (
    <EditForm
      cardId={cardId}
      currentBusinessName={card.business_name || ""}
      googleReviewUrl={card.google_review_url || ""}
      ratingGuard={!!card.rating_guard}
    />
  );
}
