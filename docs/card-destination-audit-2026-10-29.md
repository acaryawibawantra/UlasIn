# Audit tujuan kartu — 29 Oktober 2026

## Bukti produksi

Audit baca-saja atas 93 kartu dan 92 baris `card_audit_log`, dengan paginasi sampai seluruh hasil terbaca. Tidak ada perubahan database oleh audit ini. Waktu di bawah adalah WIB.

| Kartu | Waktu | Kejadian |
|---|---|---|
| NDKSK | 5 Oktober 2026 13.50.11 | Audit #38: aktivasi dari nama/link/Place ID kosong, status belum aktif, menjadi Pura Kuntul Bumi, Unggahan, Kabupaten Buleleng, Bali. |
| NDKSK | 5 Oktober 2026 13.51.04 | Audit #39: reset admin. IP dan User-Agent sama dengan aktivasi; IP tersebut juga mencatat aksi produksi admin sesudahnya. |
| 3CDRHR | 19 Oktober 2026 23.06.57 | Audit #86: aktivasi dari nama/link/Place ID kosong, status belum aktif, menjadi CV KUNTUL RACING, Jl. Darul Khairot, RT.3/RW.8, Kebon Pala, Jakarta Timur. |
| 3CDRHR | 29 Oktober 2026 09.21.54 | Audit #92: reset admin yang sudah muncul saat audit lanjutan. Bukan tindakan audit ini. |

Pada saat pemindaian tidak ada kartu tersimpan yang memuat substring KUNTUL/KONTOL di nama atau link. Tidak ditemukan kejadian GUNUNG KUNTUL/KONTOL di riwayat yang tersedia. Log paling awal tersedia mulai 5 Oktober; kejadian sebelum itu tidak dapat direkonstruksi dari tabel ini.

Aktivasi 3CDRHR berasal dari IP 175.183.54.181 dengan User-Agent Chrome/iPhone. Aktivasi dan reset NDKSK berasal dari IP 103.94.190.204 dengan User-Agent Chrome/macOS. IP dan User-Agent bukan bukti identitas dan tidak membuktikan dua kejadian dilakukan orang yang sama.

## Temuan kode dan batas kesimpulan

1. Aktivasi publik hanya memerlukan ID kartu yang masih kosong, lokasi, dan PIN baru pilihan pengunjung. Tidak ada pemeriksaan bahwa pengunjung merupakan pembeli. Orang yang mengetahui URL kartu kosong dapat mengaktifkannya. Dua kejadian yang tercatat memang memakai jalur aktivasi; log tidak membuktikan bagaimana orang tersebut memperoleh URL atau apakah pemilihan lokasi sengaja dilakukan.
2. Aktivasi sebelumnya membaca `is_active`, lalu memperbarui kartu berdasarkan ID saja. Dua permintaan yang bersamaan bisa sama-sama lolos pemeriksaan awal dan permintaan terakhir menimpa data/PIN. Ini celah yang direproduksi dan diperbaiki, bukan bukti bahwa insiden di atas memakai celah tersebut.
3. Nama dan Place ID dari browser tidak diverifikasi terhadap detail lokasi Google. Tidak ada blokir kata pada pencarian, aktivasi, atau edit. Listing dengan kata tersebut dapat dipilih/disimpan tanpa ditolak; belum ada bukti bahwa Google atau Ratey mengganti alamat secara otomatis.
4. Endpoint admin dan penandatangan sesi portal memiliki secret bawaan dalam kode ketika environment variable kosong. Ini membuka akses jika deployment benar-benar memakai fallback. Konfigurasi lokal memiliki ADMIN_SECRET_KEY; konfigurasi produksi belum diperiksa, sehingga penggunaan fallback di produksi tidak dinyatakan terbukti.
5. Audit ditulis terpisah setelah perubahan dan bersifat best effort. Perubahan langsung di database atau kegagalan insert audit tidak dijamin muncul di riwayat. Riwayat kosong bukan bukti bahwa tidak pernah ada perubahan.

## Perubahan dalam working tree

- Blokir substring KUNTUL/KONTOL pada nama/alamat dan URL, tanpa membedakan huruf besar/kecil, dengan normalisasi Unicode, pemisah dan URL encoding.
- Blokir dua Place ID yang teridentifikasi, sehingga mengganti label bisnis tidak melewati blokir.
- Filter hasil autocomplete dan tolak penyimpanan di aktivasi, edit PIN, dan portal perusahaan.
- Verifikasi nama/alamat resmi melalui Google Places Details untuk tujuan baru. Tolak bila Google tidak dapat memverifikasi; nama yang dikirim browser tidak cukup.
- Tujuan baru harus berupa link `https://search.google.com/local/writereview?placeid=...` yang konsisten dengan Place ID. Link pendek ditolak karena tujuan tidak dapat diverifikasi. Link lama tidak diubah massal.
- Saat membuka kartu, hentikan redirect bila nama/URL/Place ID tersimpan termasuk blokir, termasuk saat Rating Guard aktif. Tidak mereset kartu atau membuka aktivasi ulang secara otomatis.
- Aktivasi memakai update bersyarat `is_active=false`; hanya satu permintaan boleh berhasil. Edit PIN ditolak jika kartu telah direset atau PIN berganti sesudah pemeriksaan.
- Hapus secret bawaan admin dan sesi portal. Tanpa konfigurasi secret, akses ditolak.
- Perubahan QR meja yang sudah ada sebelum audit tetap dipertahankan dan bukan bagian patch keamanan ini.

## Validasi

- `node --test scripts/card-security.test.cjs`: 13 pengujian lolos, meliputi blokir tersamarkan, detail Google, penolakan sebelum tulis, jalur edit PIN/perusahaan, autocomplete, aktivasi bersamaan, serta secret bawaan.
- `./node_modules/.bin/tsc --noEmit --incremental false`: lolos.
- `git diff --check`: lolos.
- Satu pembacaan Google Places Details dengan konfigurasi lokal berhasil (`OK`, nama/alamat dan Place ID sesuai). Secret tidak ditampilkan. Konfigurasi Google produksi belum diverifikasi.
- Tidak menjalankan build, melakukan commit/push, atau deploy. Blokir dalam patch belum aktif pada website produksi sampai deployment dilakukan.

## Risiko yang masih tersisa

Blokir kata tidak membuktikan kepemilikan. Kartu kosong tetap bisa diaktivasi orang yang mengetahui URL dengan lokasi lain yang diizinkan. Untuk menutupnya secara menyeluruh, perlu kode aktivasi rahasia terpisah yang diberikan kepada pembeli, atau aktivasi setelah login akun pemilik. Kode rahasia tidak boleh berada dalam URL NFC/QR yang dapat dibaca pelanggan.

Pencatatan perubahan yang dijamin lengkap memerlukan audit di transaksi/database (misalnya trigger), termasuk perubahan langsung, bukan hanya logger aplikasi. Pembatasan percobaan PIN saat ini juga belum atomik untuk permintaan paralel.

Pemblokiran berdasarkan substring mengikuti instruksi operator, sehingga nama tempat yang sah yang mengandung KUNTUL juga ikut diblokir. Pemeriksaan Google menambah satu permintaan API pada penggantian tujuan; bila layanan gagal, penyimpanan tujuan baru ditolak sementara. Tidak ada lookup Google tambahan pada setiap tap kartu.
