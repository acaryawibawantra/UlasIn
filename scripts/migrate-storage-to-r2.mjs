// Migrasi storage gambar: Supabase Storage → Cloudflare R2.
//
// Alasan: Supabase menghitung cached egress (bisa habis & bikin project terkunci).
// R2 egress-nya $0, jadi biaya bandwidth gambar praktis nol.
//
// Alur:
//   1. Salin SEMUA file dari bucket Supabase ke bucket R2 (path sama).
//   2. Ganti URL Supabase di database (clients + menu_items) ke domain R2.
//
// Pakai:
//   node scripts/migrate-storage-to-r2.mjs                # DRY RUN (lihat rencana)
//   node scripts/migrate-storage-to-r2.mjs --copy         # salin file saja
//   node scripts/migrate-storage-to-r2.mjs --update-db    # update URL DB saja
//   node scripts/migrate-storage-to-r2.mjs --all          # salin + update DB
//
// Butuh env di .env.local:
//   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, NEXT_PUBLIC_R2_PUBLIC_URL

import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env.local") });

// Sumber storage = project LAMA (OLD_SUPABASE_*), DB tujuan update URL = project AKTIF.
const SB_URL = process.env.OLD_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SB_KEY = process.env.OLD_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = process.env.R2_BUCKET || "menu-assets";
const R2_PUBLIC_BASE = (process.env.NEXT_PUBLIC_R2_PUBLIC_URL || "").replace(/\/+$/, "");
const OLD_BASE = `${SB_URL}/storage/v1/object/public/${BUCKET}`;

const COPY = process.argv.includes("--copy") || process.argv.includes("--all");
const UPDATE_DB = process.argv.includes("--update-db") || process.argv.includes("--all");
const APPLY = COPY || UPDATE_DB;

function must(name, v) {
  if (!v) throw new Error(`Env ${name} belum diisi.`);
  return v;
}

const supabase = createClient(must("OLD_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL", SB_URL), must("OLD_SUPABASE_SERVICE_ROLE_KEY / SUPABASE_SERVICE_ROLE_KEY", SB_KEY), {
  auth: { persistSession: false },
});

// DB aktif (project baru) — untuk mengganti URL gambar jadi domain R2.
const db = createClient(
  must("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
  must("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY),
  { auth: { persistSession: false } }
);

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${must("R2_ACCOUNT_ID", process.env.R2_ACCOUNT_ID)}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: must("R2_ACCESS_KEY_ID", process.env.R2_ACCESS_KEY_ID),
    secretAccessKey: must("R2_SECRET_ACCESS_KEY", process.env.R2_SECRET_ACCESS_KEY),
  },
});

function fmt(bytes) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(2)} MB` : `${Math.round(bytes / 1024)} KB`;
}

async function listAll(prefix = "") {
  const out = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await supabase.storage.from(BUCKET).list(prefix, { limit: 1000, offset });
    if (error) throw new Error(`list "${prefix}": ${error.message}`);
    if (!data || data.length === 0) break;
    for (const o of data) {
      const full = prefix ? `${prefix}/${o.name}` : o.name;
      if (o.id === null || o.metadata === null) out.push(...(await listAll(full)));
      else out.push({ path: full, size: o.metadata?.size ?? 0, mime: o.metadata?.mimetype ?? "application/octet-stream" });
    }
    if (data.length < 1000) break;
    offset += data.length;
  }
  return out;
}

async function copyFiles() {
  console.log(`\n📦 Menyalin bucket "${BUCKET}" Supabase → R2 ${APPLY ? "" : "(DRY RUN)"}`);
  const files = await listAll("");
  let total = 0;
  let copied = 0;
  let failed = 0;

  for (const f of files) {
    total += f.size;
    if (!APPLY) continue;
    try {
      const { data: blob, error } = await supabase.storage.from(BUCKET).download(f.path);
      if (error || !blob) throw new Error(error?.message || "download gagal");
      const body = new Uint8Array(await blob.arrayBuffer());
      await s3.send(
        new PutObjectCommand({
          Bucket: BUCKET,
          Key: f.path,
          Body: body,
          ContentType: f.mime,
          CacheControl: "public, max-age=31536000, immutable",
        })
      );
      copied++;
      if (copied % 25 === 0) console.log(`  ... ${copied}/${files.length}`);
    } catch (err) {
      failed++;
      console.error(`  ✗ ${f.path}: ${err instanceof Error ? err.message : err}`);
    }
  }

  console.log(`  File: ${files.length} | Total: ${fmt(total)}`);
  if (APPLY) console.log(`  Tersalin: ${copied} | Gagal: ${failed}`);
  else console.log("  (dry run) Jalankan dengan --copy untuk benar-benar menyalin.");
}

async function updateDb() {
  console.log(`\n🔗 Update URL database: ${OLD_BASE}\n   → ${R2_PUBLIC_BASE} ${APPLY ? "" : "(DRY RUN)"}`);
  if (!R2_PUBLIC_BASE) throw new Error("NEXT_PUBLIC_R2_PUBLIC_URL kosong.");

  const swap = (u) => (u && u.startsWith(OLD_BASE) ? R2_PUBLIC_BASE + u.slice(OLD_BASE.length) : u);
  let changed = 0;

  // clients: logo_url + cover_mobile_url (primary key = slug, bukan id)
  {
    const { data, error } = await db.from("clients").select("slug,logo_url,cover_mobile_url");
    if (error) throw error;
    for (const row of data || []) {
      const patch = {};
      const logo = swap(row.logo_url);
      const cover = swap(row.cover_mobile_url);
      if (logo !== row.logo_url) patch.logo_url = logo;
      if (cover !== row.cover_mobile_url) patch.cover_mobile_url = cover;
      if (Object.keys(patch).length === 0) continue;
      changed++;
      if (APPLY) {
        const { error: e } = await db.from("clients").update(patch).eq("slug", row.slug);
        if (e) console.error(`  ✗ clients/${row.slug}: ${e.message}`);
      }
    }
  }

  // menu_items: image_url
  {
    const { data, error } = await db.from("menu_items").select("id,image_url");
    if (error) throw error;
    for (const row of data || []) {
      const img = swap(row.image_url);
      if (img === row.image_url) continue;
      changed++;
      if (APPLY) {
        const { error: e } = await db.from("menu_items").update({ image_url: img }).eq("id", row.id);
        if (e) console.error(`  ✗ menu_items#${row.id}: ${e.message}`);
      }
    }
  }

  console.log(`  Baris yang perlu diubah: ${changed}`);
  if (!APPLY) console.log("  (dry run) Jalankan dengan --update-db untuk menerapkan.");
}

async function main() {
  if (!SB_URL || !SB_KEY) throw new Error("Env Supabase belum lengkap.");
  if (!process.argv.includes("--copy") && !process.argv.includes("--update-db") && !process.argv.includes("--all")) {
    console.log("Mode DRY RUN. Opsi: --copy | --update-db | --all");
  }
  if (COPY) await copyFiles();
  if (UPDATE_DB) await updateDb();
  if (!COPY && !UPDATE_DB) {
    // Dry-run: tampilkan rencana untuk keduanya.
    await copyFiles();
    await updateDb();
  }
}

main().catch((err) => {
  console.error("\n✗", err instanceof Error ? err.message : err);
  process.exit(1);
});
