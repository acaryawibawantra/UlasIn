// Pindahkan gambar yang (tidak sengaja) terupload ke Supabase project BARU
// menuju Cloudflare R2, lalu update URL di database.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import dotenv from "dotenv";
import sharp from "sharp";
import { execFileSync } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env.local") });

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = process.env.R2_BUCKET || "menu-assets";
const R2_BASE = (process.env.NEXT_PUBLIC_R2_PUBLIC_URL || "").replace(/\/+$/, "");
const SRC_BASE = `${SB_URL}/storage/v1/object/public/${BUCKET}/`;

const sb = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });
const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY },
});

const maxDimFor = (k) => (k.toLowerCase().includes("/brand/") ? (k.toLowerCase().includes("logo") ? 400 : 1200) : 600);

async function toR2(key) {
  // pakai curl (lebih stabil dari fetch Node di mesin ini)
  const input = execFileSync("curl", ["-s", "-f", "--max-time", "40", SRC_BASE + key], { maxBuffer: 1e8 });
  const out = await sharp(input).rotate().resize({ width: maxDimFor(key), height: maxDimFor(key), fit: "inside", withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
  await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: out, ContentType: "image/webp", CacheControl: "public, max-age=31536000, immutable" }));
  return R2_BASE + "/" + key;
}

async function main() {
  if (!R2_BASE) throw new Error("NEXT_PUBLIC_R2_PUBLIC_URL kosong");
  let changed = 0;

  const clients = (await sb.from("clients").select("slug,logo_url,cover_mobile_url")).data || [];
  for (const c of clients) {
    const patch = {};
    for (const [field, url] of [["logo_url", c.logo_url], ["cover_mobile_url", c.cover_mobile_url]]) {
      if (url && url.startsWith(SRC_BASE)) {
        const key = url.slice(SRC_BASE.length);
        const newUrl = await toR2(key);
        patch[field] = newUrl;
        changed++;
        console.log("✓", c.slug, field, "->", key);
      }
    }
    if (Object.keys(patch).length) await sb.from("clients").update(patch).eq("slug", c.slug);
  }

  const items = (await sb.from("menu_items").select("id,name,image_url").not("image_url", "is", null)).data || [];
  for (const it of items) {
    if (!it.image_url || !it.image_url.startsWith(SRC_BASE)) continue;
    const key = it.image_url.slice(SRC_BASE.length);
    const newUrl = await toR2(key);
    await sb.from("menu_items").update({ image_url: newUrl }).eq("id", it.id);
    changed++;
    console.log("✓", it.name, "->", key);
  }

  console.log("\nSelesai. URL diubah:", changed);
}

main().catch((e) => { console.error("✗", e?.name, "|", e?.message); console.error(e?.stack); process.exit(1); });
