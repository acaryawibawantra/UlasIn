import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";

/* Penyimpanan gambar di Cloudflare R2 (S3-compatible).
   PENTING: hanya untuk server (API route / server component).
   R2 dipilih karena egress-nya $0, jadi cached egress tidak akan "penuh" seperti Supabase.

   Env yang dibutuhkan:
   - R2_ACCOUNT_ID
   - R2_ACCESS_KEY_ID
   - R2_SECRET_ACCESS_KEY
   - R2_BUCKET
   - NEXT_PUBLIC_R2_PUBLIC_URL  (contoh: https://img.ratey.site)

   Catatan: kalau NEXT_PUBLIC_R2_PUBLIC_URL masih *.r2.dev (diblokir DNS
   sebagian ISP Indonesia), gambar disajikan lewat route internal /media/<key>
   yang membaca object langsung dari bucket — lihat lib/imageUrl.ts. */

const env = () => ({
  accountId: process.env.R2_ACCOUNT_ID,
  accessKeyId: process.env.R2_ACCESS_KEY_ID,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  bucket: process.env.R2_BUCKET,
  publicBase: process.env.NEXT_PUBLIC_R2_PUBLIC_URL,
});

export function isR2Configured() {
  const e = env();
  return Boolean(e.accountId && e.accessKeyId && e.secretAccessKey && e.bucket && e.publicBase);
}

let cachedClient: S3Client | null = null;

function getClient() {
  const e = env();
  if (!e.accountId || !e.accessKeyId || !e.secretAccessKey) {
    throw new Error("R2 belum dikonfigurasi (R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY).");
  }
  if (!cachedClient) {
    cachedClient = new S3Client({
      region: "auto",
      endpoint: `https://${e.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: e.accessKeyId,
        secretAccessKey: e.secretAccessKey,
      },
    });
  }
  return cachedClient;
}

export function getR2PublicUrl(key: string) {
  const base = (env().publicBase || "").replace(/\/+$/, "");
  if (!base) throw new Error("NEXT_PUBLIC_R2_PUBLIC_URL belum diisi.");
  return `${base}/${key.replace(/^\/+/, "")}`;
}

export async function uploadImageToR2(
  key: string,
  body: ArrayBuffer | Uint8Array,
  contentType: string
) {
  const { bucket } = env();
  if (!bucket) throw new Error("R2_BUCKET belum diisi.");

  await getClient().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body instanceof Uint8Array ? body : new Uint8Array(body),
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    })
  );

  return getR2PublicUrl(key);
}

/* Ambil object dari bucket lewat S3 API (server-side).
   Dipakai route /media/[...key] supaya gambar tetap tampil walau domain
   publik R2 (*.r2.dev) diblokir ISP. */
export async function getR2Object(key: string) {
  const { bucket } = env();
  if (!bucket) throw new Error("R2_BUCKET belum diisi.");

  return getClient().send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: key.replace(/^\/+/, ""),
    })
  );
}
