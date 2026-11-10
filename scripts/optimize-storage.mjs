// Re-kompres gambar yang SUDAH ada di Supabase Storage untuk menekan cached egress.
//
// Kenapa: foto menu/cover yang diupload sebelum perbaikan masih berukuran besar
// (sampai 1600px / ratusan KB). Setiap kunjungan menarik byte sebanyak itu dari
// Storage → cached egress cepat habis.
//
// Script ini men-download tiap gambar, resize + kompres ulang, lalu upload balik
// ke PATH YANG SAMA (nama file tidak berubah, jadi URL di database tetap valid).
//
// Jalankan:
//   node scripts/optimize-storage.mjs            # DRY RUN (hanya lihat estimasi)
//   node scripts/optimize-storage.mjs --apply    # benar-benar ubah file
//
// Butuh: SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL di .env.local
//        dan dependency `sharp` (devDependency).

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env.local") });

const BUCKET = process.env.STORAGE_BUCKET || "menu-assets";
const APPLY = process.argv.includes("--apply");
const IMAGE_EXT = new Set(["jpg", "jpeg", "png", "webp"]);
const MIN_BYTES = 90 * 1024; // lewati file yang sudah kecil
const QUALITY = 72;

const supabase = createClient(
  process.env.OLD_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.OLD_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

function maxDimFor(filePath) {
  const p = filePath.toLowerCase();
  if (p.includes("/brand/")) return p.includes("logo") ? 400 : 1200;
  return 600;
}

async function listAll(prefix = "") {
  const out = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .list(prefix, { limit: 1000, offset });
    if (error) throw new Error(`list "${prefix}": ${error.message}`);
    if (!data || data.length === 0) break;
    for (const o of data) {
      const full = prefix ? `${prefix}/${o.name}` : o.name;
      if (o.id === null || o.metadata === null) {
        out.push(...(await listAll(full)));
      } else {
        out.push({ path: full, size: o.metadata?.size ?? 0, mime: o.metadata?.mimetype ?? "" });
      }
    }
    if (data.length < 1000) break;
    offset += data.length;
  }
  return out;
}

function fmt(kb) {
  return kb >= 1024 ? `${(kb / 1024).toFixed(2)} MB` : `${Math.round(kb)} KB`;
}

async function main() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY tidak ada di .env.local");
  }

  console.log(`Bucket: ${BUCKET} | Mode: ${APPLY ? "APPLY (ubah file)" : "DRY RUN"}\n`);
  const files = (await listAll("")).filter((f) => {
    const ext = f.path.split(".").pop()?.toLowerCase() || "";
    return IMAGE_EXT.has(ext);
  });

  let before = 0;
  let after = 0;
  let changed = 0;

  for (const f of files) {
    before += f.size;
    const maxDim = maxDimFor(f.path);
    if (f.size < MIN_BYTES) {
      after += f.size;
      continue;
    }

    try {
      const { data: blob, error: dlErr } = await supabase.storage.from(BUCKET).download(f.path);
      if (dlErr || !blob) throw new Error(dlErr?.message || "download gagal");
      const input = Buffer.from(await blob.arrayBuffer());

      const meta = await sharp(input).metadata();
      const longest = Math.max(meta.width || 0, meta.height || 0);
      const format = (meta.format || "").toLowerCase();
      if (!["jpeg", "png", "webp"].includes(format)) {
        after += f.size;
        continue;
      }

      let pipeline = sharp(input).rotate();
      if (longest > maxDim) {
        pipeline = pipeline.resize({ width: maxDim, height: maxDim, fit: "inside", withoutEnlargement: true });
      }
      pipeline = pipeline.toFormat(format, {
        quality: QUALITY,
        ...(format === "png" ? { compressionLevel: 9, palette: true } : {}),
        ...(format === "jpeg" ? { progressive: true, mozjpeg: true } : {}),
        ...(format === "webp" ? { effort: 5 } : {}),
      });

      const output = await pipeline.toBuffer();
      const saved = f.size - output.length;
      after += output.length;

      if (saved <= 0 || output.length >= f.size) {
        continue;
      }
      changed++;
      console.log(
        `✓ ${fmt(f.size / 1024)} → ${fmt(output.length / 1024)}  (-${Math.round((saved / f.size) * 100)}%)  ${f.path}`
      );

      if (APPLY) {
        const contentType =
          format === "jpeg" ? "image/jpeg" : format === "png" ? "image/png" : "image/webp";
        const { error: upErr } = await supabase.storage
          .from(BUCKET)
          .upload(f.path, output, { contentType, upsert: true, cacheControl: "31536000" });
        if (upErr) console.error(`  ✗ upload gagal: ${upErr.message}`);
      }
    } catch (err) {
      after += f.size;
      console.error(`✗ ${f.path}: ${err instanceof Error ? err.message : err}`);
    }
  }

  console.log("\n────────────────────────────────────────");
  console.log(`File gambar     : ${files.length}`);
  console.log(`Berubah         : ${changed}`);
  console.log(`Total sebelum   : ${fmt(before / 1024)}`);
  console.log(`Total sesudah   : ${fmt(after / 1024)}`);
  console.log(`Hemat           : ${fmt((before - after) / 1024)} (${before ? Math.round(((before - after) / before) * 100) : 0}%)`);
  if (!APPLY) console.log("\nIni DRY RUN. Jalankan ulang dengan --apply untuk menerapkan.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
