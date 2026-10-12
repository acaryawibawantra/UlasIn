// Helper untuk konversi nama perusahaan <-> URL slug.
// "Kebab Baba Rafi" <-> "kebab-baba-rafi"
// Slug dipakai untuk URL branded: /perusahaan/kebab-baba-rafi

export function slugifyCompany(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

// Cocokkan slug ke daftar company_name yang ada. Karena slugifikasi lossy
// (spasi jadi strip, karakter khusus hilang), kita cari yang slug-nya sama.
export async function findCompanyNameBySlug(
  supabase: any,
  slug: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("cards")
    .select("batch_label")
    .not("batch_label", "is", null)
    .order("batch_label");

  if (error || !data) return null;

  const seen = new Set<string>();
  for (const row of data) {
    const name = String(row.batch_label || "");
    if (!name || seen.has(name)) continue;
    seen.add(name);
    if (slugifyCompany(name) === slug) return name;
  }
  return null;
}
