# Product Requirements Document
## Ratey (Kartu Review Google NFC + QR) — Alat Aktivasi Review Otomatis untuk UMKM

**Versi:** 1.0
**Tanggal:** 18 Agustus 2026
**Disusun oleh:** Acarya
**Status:** Draft — tahap testing/prototype

---

## 1. Ringkasan Eksekutif

Produk ini adalah kartu fisik (dengan chip NFC dan QR code tercetak) yang memudahkan pelanggan sebuah bisnis (UMKM, kafe, bengkel, dll.) untuk langsung memberi review Google Maps hanya dengan tap HP ke kartu atau scan QR — tanpa perlu mencari-cari halaman bisnis di Google secara manual.

Kartu dijual dalam kondisi **belum aktif**. Pemilik bisnis (client) mengaktifkan sendiri kartu setelah membeli, dengan mengisi nama bisnis dan membuat PIN 4 digit lewat halaman aktivasi web. Setelah aktif, setiap tap/scan otomatis mengarahkan pelanggan langsung ke halaman "Tulis Review" Google Maps milik bisnis tersebut.

Fase ini berfokus murni pada **membangun alatnya** (produk teknis) — bukan model bisnis atau strategi distribusi.

---

## 2. Latar Belakang & Masalah

### 2.1 Masalah yang Diselesaikan
- UMKM kesulitan mendapatkan review Google organik karena pelanggan malas mencari halaman bisnis secara manual di Google Maps/Search.
- Cara konvensional (minta pelanggan cari sendiri, atau stiker QR statis buatan sendiri) punya friksi tinggi dan terkesan kurang profesional.
- Solusi kompetitor yang ada di pasar (referensi: produk sejenis dari kompetitor) menjual kartu fisik saja tanpa lapisan software/data yang memberi nilai tambah jangka panjang.

### 2.2 Referensi
Produk ini terinspirasi dari kartu NFC+QR "Bantu Kami Dengan Google Review" yang dijual di pasaran dengan model: kartu kosong dijual dulu, aktivasi dilakukan mandiri oleh pembeli lewat halaman web sederhana.

---

## 3. Tujuan Produk (Goals)

| Tujuan | Ukuran Keberhasilan |
|---|---|
| Alat dasar (kartu + sistem aktivasi) berfungsi end-to-end | 1 kartu berhasil di-tap/scan dan redirect otomatis ke halaman review Google yang benar |
| Proses aktivasi mandiri oleh pemilik bisnis mudah dipakai | Aktivasi selesai dalam < 2 menit tanpa bantuan teknis |
| Sistem bisa menangani banyak kartu tanpa bentrok data | Setiap `card_id` unik dan terisolasi datanya |
| Siap dipakai untuk sampel/testing ke calon client | Minimal 5 kartu prototype berhasil diproduksi dan diuji coba |

### Non-Goals (di luar cakupan versi ini)
- Model bisnis, harga jual, strategi reseller — dibahas terpisah di luar PRD ini.
- Dashboard analitik lanjutan (jumlah scan, jam ramai, dsb.) — masuk fase berikutnya.
- Fitur filter rating (redirect ke form feedback internal jika rating rendah) — masuk fase berikutnya, perlu tinjauan kebijakan Google lebih dulu.

---

## 4. Target Pengguna (User Personas)

### Persona 1: Pemilik Bisnis (Client / Buyer)
- Pemilik UMKM (kafe, bengkel, warteg, toko retail) yang ingin menambah review Google tanpa ribet.
- Awam teknologi — perlu proses aktivasi yang sangat sederhana, mirip mengisi formulir biasa.

### Persona 2: Pelanggan Akhir (End Customer)
- Pelanggan dari bisnis tersebut yang menerima ajakan untuk memberi review.
- Berinteraksi dengan kartu hanya sekali, tidak perlu install apapun — cukup tap NFC atau scan QR pakai kamera HP.

### Persona 3: Acarya (Operator/Admin)
- Memproduksi kartu, generate `card_id`, dan memantau status kartu yang beredar (di tahap awal, dilakukan manual).

---

## 5. Alur Pengguna (User Flow)

### 5.1 Alur Aktivasi (Pemilik Bisnis)
1. Pemilik bisnis tap NFC / scan QR kartu yang masih kosong.
2. Sistem mengecek `card_id` di database → status belum aktif → tampilkan halaman "Aktivasi Kartu".
3. Pemilik bisnis mengetik nama bisnis → sistem menampilkan saran otomatis dari Google Places.
4. Pemilik bisnis memilih nama bisnis yang sesuai dari daftar saran.
5. Pemilik bisnis membuat PIN 4 digit.
6. Klik "Aktifkan Kartu" → sistem menyimpan data dan mengubah status kartu jadi aktif.
7. Sistem menampilkan konfirmasi "Kartu Sudah Aktif" dengan tombol untuk mencoba langsung.

### 5.2 Alur Review (Pelanggan Akhir, kartu sudah aktif)
1. Pelanggan tap NFC / scan QR di kartu.
2. Sistem mengecek `card_id` → status aktif → langsung redirect ke halaman "Tulis Review" Google Maps bisnis tersebut.
3. Pelanggan menulis review di Google Maps seperti biasa.

### 5.3 Alur Edit/Reset (Pemilik Bisnis)
1. Pemilik bisnis membuka halaman edit kartu (link terpisah dari halaman aktivasi).
2. Memasukkan `card_id` + PIN yang dibuat saat aktivasi.
3. Jika PIN benar → bisa mengubah nama bisnis atau reset PIN baru.

---

## 6. Kebutuhan Fungsional (Functional Requirements)

| ID | Kebutuhan | Prioritas |
|---|---|---|
| FR-1 | Sistem dapat generate `card_id` unik untuk setiap kartu baru | Must have |
| FR-2 | Setiap `card_id` dapat ditulis ke chip NFC dan di-encode jadi QR code dengan URL yang identik | Must have |
| FR-3 | Halaman `/c/[card_id]` dapat membedakan status kartu (aktif/belum aktif) dan menampilkan tampilan yang sesuai | Must have |
| FR-4 | Form aktivasi memiliki autocomplete nama bisnis via Google Places API | Must have |
| FR-5 | Sistem dapat generate link review Google Maps otomatis dari `place_id` yang dipilih | Must have |
| FR-6 | PIN 4 digit disimpan dalam bentuk hash (tidak plain text) | Must have |
| FR-7 | Kartu yang sudah aktif otomatis redirect ke link review saat diakses | Must have |
| FR-8 | Pemilik bisnis dapat mengedit nama bisnis/link review menggunakan PIN | Should have |
| FR-9 | Pemilik bisnis dapat reset PIN jika lupa (lewat halaman edit, bukan otomatis) | Should have |
| FR-10 | Sistem mencatat waktu aktivasi (`activated_at`) untuk keperluan tracking dasar | Could have |

---

## 7. Kebutuhan Non-Fungsional

| Kategori | Kebutuhan |
|---|---|
| Performa | Halaman redirect harus terbuka dalam < 2 detik setelah tap/scan |
| Kompatibilitas | Berfungsi di NFC Android & iPhone (iOS 13+) tanpa aplikasi tambahan; QR terbaca oleh kamera bawaan HP |
| Keamanan | PIN di-hash (bcrypt/setara); `card_id` dibuat acak agar tidak mudah ditebak |
| Skalabilitas | Struktur data mendukung ratusan–ribuan kartu tanpa perubahan skema |
| Ketersediaan | Uptime hosting minimal setara free-tier Vercel/Supabase di tahap awal |

---

## 8. Arsitektur & Data Model

### 8.1 Tech Stack
- **Frontend & routing:** Next.js
- **Database:** Supabase (PostgreSQL)
- **Hosting:** Vercel
- **API tambahan:** Google Places Autocomplete API (untuk pencarian nama bisnis)

### 8.2 Struktur Data (tabel `cards`)

| Kolom | Tipe | Keterangan |
|---|---|---|
| `card_id` | string (unique) | Kode unik per kartu, ditulis ke NFC & di-encode ke QR |
| `business_name` | string, nullable | Diisi saat aktivasi |
| `place_id` | string, nullable | ID tempat dari Google Places, dipakai untuk generate link review |
| `google_review_url` | string, nullable | Link tujuan redirect saat kartu aktif |
| `pin_hash` | string, nullable | PIN 4 digit yang sudah di-hash |
| `is_active` | boolean | Default `false` |
| `created_at` | timestamp | Waktu kartu digenerate ke sistem |
| `activated_at` | timestamp, nullable | Waktu aktivasi berhasil |

### 8.3 Logika Inti
```
Request masuk ke /c/[card_id]
   → Query database berdasarkan card_id
   → Jika is_active == false: tampilkan form aktivasi
   → Jika is_active == true: redirect ke google_review_url
```

Poin penting: **NFC dan QR di satu kartu fisik menunjuk ke URL yang identik**. Status aktif/tidak aktif sepenuhnya dikendalikan oleh data di server, bukan oleh chip atau QR itu sendiri — sehingga tap NFC dan scan QR pada kartu yang sama akan selalu memberi hasil yang konsisten.

---

## 9. Kebutuhan Produksi Fisik

| Item | Keterangan |
|---|---|
| Chip NFC | NTAG213 (13.56MHz, ISO14443A), kapasitas ~144 byte — cukup untuk 1 URL pendek |
| Domain | Wajib pendek agar muat di kapasitas chip dan tampil rapi di QR (contoh: `xxx.app/c/AYBRZY`) |
| Alat tulis NFC | Aplikasi NFC Tools (gratis) untuk menulis URL ke chip |
| QR generator | Library `qrcode` (npm), digenerate otomatis dari `card_id` yang sama dengan yang ditulis ke NFC — tidak boleh diketik ulang manual untuk menghindari mismatch |
| Media kartu | Tahap testing: sticker NFC + print QR biasa. Tahap produksi: kartu PVC custom dengan chip tertanam |

---

## 10. Roadmap Implementasi

### Fase 1 — Testing/Prototype (Bulan 1)
- Setup Next.js + Supabase + tabel `cards`
- Bangun halaman `/c/[card_id]` dengan logika aktivasi & redirect dasar
- Generate 5–10 `card_id` uji coba, tulis ke sticker NFC, generate QR
- Uji end-to-end: tap/scan → aktivasi → redirect ke review

### Fase 2 — Penyempurnaan Form Aktivasi (Bulan 1–2)
- Integrasi Google Places Autocomplete
- Generate otomatis link review dari `place_id`
- Hashing PIN + halaman edit/reset

### Fase 3 — Kesiapan Sampel untuk Client (Bulan 2)
- Produksi kartu PVC fisik dalam jumlah kecil
- Uji coba ke beberapa calon client sebagai sampel/demo
- Dokumentasi mapping `card_id` ↔ kartu fisik untuk keperluan inventaris

### Fase 4 — Fitur Lanjutan (di luar cakupan versi ini)
- Dashboard analitik untuk pemilik bisnis
- Fitur filter rating (dengan kajian kebijakan Google Maps terlebih dahulu)
- Sistem reseller/distribusi

---

## 11. Risiko & Catatan

| Risiko | Mitigasi |
|---|---|
| Google Places API butuh billing account aktif | Siapkan Google Cloud Billing (bisa pakai virtual card) sejak awal, set budget alert |
| Mismatch URL antara NFC dan QR jika ditulis manual terpisah | Generate `card_id` sekali di kode, pakai variable yang sama untuk menulis NFC dan generate QR |
| Kapasitas chip NFC terbatas (~144 byte) | Gunakan domain pendek, hindari parameter URL yang panjang |
| PIN lupa tanpa mekanisme reset otomatis | Sediakan jalur reset manual lewat admin di tahap awal (belum perlu sistem otomatis) |

---

## 12. Metrik Keberhasilan (Fase Testing)

- Jumlah kartu prototype yang berhasil dibuat dan diuji: target 5–10 kartu
- Tingkat keberhasilan flow aktivasi tanpa error: target 100% dari kartu yang diuji
- Waktu rata-rata proses aktivasi: target di bawah 2 menit
- Konsistensi hasil antara tap NFC dan scan QR pada kartu yang sama: wajib 100% konsisten