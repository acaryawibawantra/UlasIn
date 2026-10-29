// Kebijakan operator: substring ini diblokir, termasuk bila ada di alamat.
const BLOCKED_WORDS = ["kuntul", "kontol"];
export const BLOCKED_PLACE_IDS = [
  "ChIJCY5XTQDzaS4RnTiYYfd_alA", // CV KUNTUL RACING
  "ChIJ4fIfKoOB0S0Rylg1vq2XPmo", // Pura Kuntul Bumi
];

export const BLOCKED_DESTINATION_MESSAGE =
  "Nama bisnis atau alamat tujuan ini diblokir. Pilih lokasi bisnis lain atau hubungi admin.";

function normalizedText(value: string): string {
  let decoded = value;
  // Tangani URL encoding, termasuk encoding berlapis.
  for (let i = 0; i < 3; i++) {
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    } catch { break; }
  }
  return decoded.normalize("NFKD").toLowerCase()
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

export function hasBlockedDestination(...values: unknown[]): boolean {
  return values.some((value) => {
    if (typeof value !== "string") return false;
    const normalized = normalizedText(value);
    return [...BLOCKED_WORDS, ...BLOCKED_PLACE_IDS.map(normalizedText)]
      .some((word) => normalized.includes(word));
  });
}
