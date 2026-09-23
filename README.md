# Ratey — Starter Project

Sesuai PRD: kartu NFC + QR yang belum aktif mengarah ke form aktivasi;
setelah pemilik bisnis mengisi nama bisnis + PIN, kartu otomatis redirect
ke halaman review Google setiap kali di-tap/scan.

## 1. Setup Supabase
1. Buat project baru di https://supabase.com
2. Buka **SQL Editor** > New query > tempel isi `supabase/schema.sql` > Run
3. Buka **Project Settings > API**, catat:
   - `Project URL` → jadi `NEXT_PUBLIC_SUPABASE_URL`
   - `service_role` key (bukan `anon` key!) → jadi `SUPABASE_SERVICE_ROLE_KEY`

## 2. Setup Google Places API
1. Buka https://console.cloud.google.com
2. Buat project baru (atau pakai yang sudah ada), aktifkan billing
3. Aktifkan **Places API** di menu "APIs & Services > Library"
4. Buat API key di "Credentials", catat sebagai `GOOGLE_PLACES_API_KEY`
5. Disarankan: batasi API key ini supaya hanya bisa dipanggil dari server
   kamu (restrict by API, bukan by HTTP referrer, karena dipanggil dari
   API route bukan langsung dari browser)

## 3. Setup Project Lokal
```bash
cp .env.local.example .env.local
# lalu isi semua value di .env.local

npm install
npm install dotenv   # dipakai khusus oleh script generate-card.mjs
npm run dev
```

Buka http://localhost:3000 — akan muncul halaman placeholder.

## 4. Generate Kartu Testing
```bash
npm run gen:card        # generate 1 kartu
npm run gen:card 5      # generate 5 kartu sekaligus
```

Script ini akan:
- Insert row baru ke tabel `cards` dengan `card_id` unik
- Simpan file QR code (.png) ke folder `generated-cards/`
- Print URL yang harus kamu tulis ke chip NFC pakai app **NFC Tools**

## 5. Tulis ke Chip NFC
1. Buka app **NFC Tools** di HP
2. Menu **Write** > **Add a record** > tipe **URL/URI**
3. Masukkan URL yang muncul di terminal (contoh: `http://localhost:3000/c/AYBRZY`)

   > Catatan: kalau masih testing lokal, HP kamu harus satu jaringan WiFi
   > dengan laptop dan akses pakai IP lokal laptop (bukan `localhost`),
   > misal `http://192.168.1.5:3000/c/AYBRZY`. Setelah nanti di-deploy ke
   > Vercel, ganti `NEXT_PUBLIC_BASE_URL` ke domain aslinya dan generate
   > ulang kartu-nya.

4. Tempelkan HP ke sticker NFC sampai muncul konfirmasi "Write success"

## 6. Test End-to-End
1. Tap NFC atau scan QR yang sudah digenerate
2. Harusnya muncul form "Aktivasi Kartu"
3. Isi nama bisnis (pilih dari saran autocomplete) + PIN 4 digit
4. Klik "Aktifkan Kartu"
5. Tap/scan lagi kartu yang sama → sekarang harus langsung redirect ke
   halaman "Tulis review" Google Maps bisnis tersebut

## 7. Deploy ke Vercel (setelah testing lokal berhasil)
1. Push project ini ke GitHub
2. Import ke https://vercel.com
3. Isi semua environment variables yang sama seperti `.env.local`
4. Update `NEXT_PUBLIC_BASE_URL` ke domain Vercel kamu
5. Generate ulang kartu-kartu produksi pakai domain baru ini

## Struktur Project
```
app/
  page.tsx                    -> halaman utama (placeholder)
  c/[card_id]/page.tsx        -> otak logic: cek status, tampilkan form / redirect
  c/[card_id]/ActivationForm.tsx -> form aktivasi (client component)
  api/places/route.ts         -> proxy ke Google Places Autocomplete
  api/activate/route.ts       -> proses aktivasi kartu
  api/edit/route.ts           -> edit data / reset PIN (butuh verifikasi PIN lama)
lib/
  supabaseServer.ts           -> koneksi Supabase khusus server (service role)
scripts/
  generate-card.mjs           -> generator card_id + QR code
supabase/
  schema.sql                  -> struktur tabel database
```
