// Upload gambar asli (hasil restore dari git) ke Cloudflare R2.
// Dioptimalkan dulu: resize + WebP (jauh lebih kecil), tapi KEY/URL tetap sama
// (ekstensi tetap .png) supaya URL di database tidak perlu diubah satu-satu.
// Content-Type diset image/webp → browser tetap menampilkannya normal.
//
// Jalankan: node scripts/upload-originals-to-r2.mjs

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import dotenv from "dotenv";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env.local") });

const SRC = path.join(__dirname, "..", "backups", "tammmu-originals");
const BUCKET = process.env.R2_BUCKET || "menu-assets";
const QUALITY = 78;

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

function maxDimFor(key) {
  const k = key.toLowerCase();
  if (k.includes("/brand/")) return k.includes("logo") ? 400 : 1200;
  return 600;
}

async function main() {
  if (!process.env.R2_ACCOUNT_ID) throw new Error("R2 env belum diisi.");
  if (!fs.existsSync(SRC)) throw new Error("Folder backups/tammmu-originals tidak ada.");

  const files = walk(SRC);
  let totalIn = 0;
  let totalOut = 0;

  for (const file of files) {
    const key = path.relative(SRC, file).split(path.sep).join("/");
    const maxDim = maxDimFor(key);
    const inBuf = fs.readFileSync(file);
    totalIn += inBuf.length;

    const outBuf = await sharp(inBuf)
      .rotate()
      .resize({ width: maxDim, height: maxDim, fit: "inside", withoutEnlargement: true })
      .webp({ quality: QUALITY, effort: 5 })
      .toBuffer();
    totalOut += outBuf.length;

    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: outBuf,
        ContentType: "image/webp",
        CacheControl: "public, max-age=31536000, immutable",
      })
    );

    console.log(
      `✓ ${key}  ${(inBuf.length / 1024).toFixed(0)}KB → ${(outBuf.length / 1024).toFixed(0)}KB`
    );
  }

  console.log(
    `\nSelesai: ${files.length} file | ${(totalIn / 1024 / 1024).toFixed(1)}MB → ${(totalOut / 1024 / 1024).toFixed(1)}MB`
  );
}

main().catch((e) => {
  console.error("\n✗", e && e.name, "|", e && e.message, "\n", e && e.stack);
  process.exit(1);
});
