/* Normalisasi URL gambar untuk dipakai di <img src>.

   Kenapa perlu:
   URL publik R2 versi development (*.r2.dev) sering diblokir DNS ISP di
   Indonesia (mis. Biznet mengarahkan ke "rpz.biznet"), sehingga gambar
   tampil kosong walau file-nya ada di bucket.

   Solusi:
   - Selama NEXT_PUBLIC_R2_PUBLIC_URL masih *.r2.dev, URL gambar R2 ditulis
     ulang ke route internal /media/<key> yang membaca object langsung dari
     bucket R2 (server-side, tanpa DNS publik).
   - Begitu custom domain R2 dipasang (mis. https://img.ratey.site), URL
     otomatis dipakai langsung tanpa proxy.

   File ini dipakai di client & server — jangan import modul Node di sini. */

const R2_BASE = (process.env.NEXT_PUBLIC_R2_PUBLIC_URL || "").replace(/\/+$/, "");

/* Host development R2: <account-id>.r2.dev */
const R2_DEV_RE = /^https?:\/\/[a-z0-9-]+\.r2\.dev\/(.+)$/i;

/* True kalau base publik masih domain dev (diblokir ISP) atau belum diisi. */
const USE_INTERNAL_PROXY = !R2_BASE || /^https?:\/\/[a-z0-9-]+\.r2\.dev$/i.test(R2_BASE);

function encodeKey(key: string) {
  return key
    .split("/")
    .filter(Boolean)
    .map((seg) => encodeURIComponent(seg))
    .join("/");
}

/* Ubah URL gambar tersimpan → URL yang aman ditampilkan browser. */
export function imageSrc(url?: string | null): string | undefined {
  if (!url) return undefined;
  const trimmed = String(url).trim();
  if (!trimmed) return undefined;

  let key: string | null = null;

  const devMatch = trimmed.match(R2_DEV_RE);
  if (devMatch) {
    key = devMatch[1];
  } else if (R2_BASE && trimmed.startsWith(`${R2_BASE}/`)) {
    key = trimmed.slice(R2_BASE.length + 1);
  }

  if (!key) return trimmed;
  return USE_INTERNAL_PROXY ? `/media/${encodeKey(key)}` : `${R2_BASE}/${encodeKey(key)}`;
}
