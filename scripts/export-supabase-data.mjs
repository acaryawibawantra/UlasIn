// BACKUP DATABASE Supabase via Management API — TANPA perlu upgrade / tunggu reset.
//
// Kenapa bisa: saat project "restricted" (kehabisan egress), REST/Storage diblokir,
// TAPI control-plane (Dashboard Table Editor + Management API) masih bisa query database.
//
// Script ini mengekspor SEMUA tabel ke folder `backups/<timestamp>/` (JSON + CSV).
// Isinya lengkap termasuk `cards` (mapping card_id → Google review) jadi kartu NFC aman.
//
// Pakai:
//   node scripts/export-supabase-data.mjs
//
// Butuh di .env.local:
//   SUPABASE_ACCESS_TOKEN=sbp_xxx   (Personal Access Token: Account > Access Tokens)
//   SUPABASE_PROJECT_REF=xxxxxxxx   (opsional; otomatis dari NEXT_PUBLIC_SUPABASE_URL)

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env.local") });

const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const REF =
  process.env.SUPABASE_PROJECT_REF ||
  (process.env.NEXT_PUBLIC_SUPABASE_URL || "").match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];

// Urutan kolom untuk pagination (harus unik / primary key).
const TABLES = [
  { name: "cards", order: "card_id" },
  { name: "table_qrs", order: "id" },
  { name: "clients", order: "slug" },
  { name: "menu_categories", order: "id" },
  { name: "menu_items", order: "id" },
  { name: "client_users", order: "id" },
  { name: "company_users", order: "id" },
  { name: "card_feedback", order: "id" },
  { name: "card_audit_log", order: "id" },
];

const PAGE = 1000;

function must(v, name) {
  if (!v) throw new Error(`Env ${name} belum diisi.`);
  return v;
}

async function runQuery(sql) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: sql, read_only: true }),
    });
    if (res.status === 429) {
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
      continue;
    }
    const text = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 400)}`);
    const json = JSON.parse(text);
    // Normalisasi beberapa bentuk respons.
    if (Array.isArray(json)) return json;
    if (Array.isArray(json?.result)) return json.result;
    if (Array.isArray(json?.data)) return json.data;
    if (Array.isArray(json?.rows)) return json.rows;
    throw new Error(`Bentuk respons tidak dikenal: ${text.slice(0, 200)}`);
  }
  throw new Error("Rate limit terus menerus (429).");
}

function csvCell(v) {
  if (v === null || v === undefined) return "";
  const s = typeof v === "object" ? JSON.stringify(v) : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rows) {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]);
  const lines = [cols.join(",")];
  for (const r of rows) lines.push(cols.map((c) => csvCell(r[c])).join(","));
  return lines.join("\n");
}

async function main() {
  must(TOKEN, "SUPABASE_ACCESS_TOKEN");
  must(REF, "SUPABASE_PROJECT_REF (atau NEXT_PUBLIC_SUPABASE_URL)");

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outDir = path.join(__dirname, "..", "backups", stamp);
  fs.mkdirSync(outDir, { recursive: true });

  console.log(`Project: ${REF}`);
  console.log(`Output : ${outDir}\n`);

  const summary = {};

  for (const t of TABLES) {
    let offset = 0;
    const all = [];
    for (;;) {
      const rows = await runQuery(
        `select * from public.${t.name} order by ${t.order} asc limit ${PAGE} offset ${offset}`
      );
      all.push(...rows);
      if (rows.length < PAGE) break;
      offset += rows.length;
    }
    fs.writeFileSync(path.join(outDir, `${t.name}.json`), JSON.stringify(all, null, 2));
    fs.writeFileSync(path.join(outDir, `${t.name}.csv`), toCsv(all));
    summary[t.name] = all.length;
    console.log(`  ✓ ${t.name.padEnd(16)} ${all.length} baris`);
  }

  // Skema kolom (untuk re-create tabel di backend baru).
  const columns = await runQuery(`
    select table_name, ordinal_position, column_name, data_type, udt_name,
           is_nullable, column_default, character_maximum_length
    from information_schema.columns
    where table_schema = 'public'
    order by table_name, ordinal_position
  `);
  fs.writeFileSync(path.join(outDir, "schema-columns.json"), JSON.stringify(columns, null, 2));

  // Nilai sequence saat ini (biar ID baru tidak bentrok setelah import).
  const sequences = await runQuery(`
    select schemaname, sequencename, last_value
    from pg_sequences
    where schemaname = 'public'
  `);
  fs.writeFileSync(path.join(outDir, "sequences.json"), JSON.stringify(sequences, null, 2));

  fs.writeFileSync(path.join(outDir, "_summary.json"), JSON.stringify({ ref: REF, exported_at: stamp, tables: summary }, null, 2));

  console.log("\nSelesai. Backup tersimpan di:", outDir);
  console.log("JANGAN commit folder backups/ (sudah masuk .gitignore).");
}

main().catch((err) => {
  console.error("\n✗", err instanceof Error ? err.message : err);
  process.exit(1);
});
