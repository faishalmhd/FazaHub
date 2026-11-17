# FazaHub

Jurnal foto editorial privat untuk dua orang. Dibangun dengan React, Vite, Tailwind CSS, Supabase Auth/Postgres/Realtime, Cloudinary unsigned upload, dan PWA.

## Jalankan lokal

1. Buat project Supabase dan jalankan [`supabase/schema.sql`](./supabase/schema.sql) lewat SQL Editor.
2. Salin `.env.example` sebagai `.env`, lalu isi URL dan anon key Supabase serta Cloudinary cloud name dan unsigned upload preset.
3. Jalankan `npm install`, kemudian `npm run dev`. Build production dengan `npm run build`.

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_CLOUDINARY_CLOUD_NAME=
VITE_CLOUDINARY_UPLOAD_PRESET=
```

Variabel `VITE_*` tersedia di browser. Jangan letakkan Supabase service-role key atau kredensial privat di frontend. Upload dikirim langsung dari browser ke Cloudinary.

## Deploy ke Vercel

Impor repository ke Vercel dengan preset **Vite**, build command `npm run build`, dan output directory `dist`. Tambahkan empat variabel environment di atas. `vercel.json` menangani fallback aplikasi SPA.

## Fitur

- Feed jurnal harian, kalender dengan thumbnail, Realtime, badge streak, dan penghapusan foto milik sendiri.
- Komentar pada setiap foto dan chat realtime privat untuk dua anggota ruang. Terapkan [`supabase/migrations/20261117200000_comments_and_couple_chat.sql`](./supabase/migrations/20261117200000_comments_and_couple_chat.sql) di SQL Editor pada project yang sudah berjalan; foto dan akun lama tidak dihapus.
- Chat mendukung kirim foto dengan kompresi browser, pratinjau, dan tampilan foto penuh. Terapkan [`supabase/migrations/20261117234000_chat_photo_messages.sql`](./supabase/migrations/20261117234000_chat_photo_messages.sql) sebelum mengirim foto dari chat.
- Panggilan video satu-lawan-satu memakai WebRTC, Supabase Realtime privat, dan Metered Open Relay TURN. Terapkan [`supabase/migrations/20261117214500_video_calls.sql`](./supabase/migrations/20261117214500_video_calls.sql), lalu tambahkan `METERED_DOMAIN` (subdomain `*.metered.live`) dan `METERED_API_KEY` sebagai environment variables Vercel. Buat akun Open Relay gratis di Metered untuk memperoleh keduanya; dokumentasi provider saat ini mencantumkan kuota TURN gratis 20 GB/bulan. Kunci API hanya dibaca oleh endpoint server Vercel dan tidak dikirim sebagai konfigurasi browser.
- ICE menerima daftar server dari URL HTTPS `VITE_TURN_URL` (endpoint API Metered), atau URL `turn:`/`turns:` beserta `VITE_TURN_USERNAME` dan `VITE_TURN_CREDENTIAL`. Jika URL/kredensial tidak tersedia atau invalid, browser tetap memakai STUN Google dan kredensial server TURN Vercel bila tersedia.
- Panggilan memerlukan izin kamera/mikrofon, koneksi internet, dan kedua pasangan membuka FazaHub. Untuk pengujian lokal, jalankan melalui Vercel CLI agar endpoint `/api/turn-credentials` tersedia.
- Jika kamera sedang sibuk atau tidak tersedia, panggilan mencoba lanjut dengan mikrofon saja; kamera dapat diaktifkan kembali dari kontrol panggilan tanpa mengakhiri suara. Kredensial `VITE_TURN_*` opsional dan terekspos ke browser; jangan masukkan rahasia TURN jangka panjang ke variabel tersebut. Tanpa TURN, FazaHub tetap mencoba STUN Google, tetapi koneksi pada jaringan tertentu mungkin tidak berhasil.
- Notifikasi pesan baru dapat diaktifkan per perangkat dari **Ruang kita**. Notifikasi tampil saat browser/PWA masih berjalan dan izin notifikasi diberikan; notifikasi push saat aplikasi benar-benar ditutup memerlukan layanan push server tambahan.
- Upload galeri dan kamera melalui tombol terpisah. Foto diorientasikan dan di-resize maksimal 1600 px, lalu dikompres sebagai JPEG kualitas 0.85 sebelum diunggah.
- Ekspor ZIP foto teroptimasi dengan `metadata.json` berisi tanggal, mood, catatan, dan nama pengirim.
- Tema gelap editorial sebagai default, dengan pilihan tema terang.
- Pengingat lokal memakai jam pilihan yang disimpan pada perangkat dan notifikasi saat aplikasi/PWA sedang berjalan. Pengingat browser **tidak dapat dijadwalkan untuk tetap berjalan setelah browser ditutup**; impor file `.ics` di halaman Ruang kita untuk alarm kalender berulang yang dikelola aplikasi Kalender HP.
- Tab, drawer, dan modal disinkronkan dengan browser history sehingga tombol Back HP menutup overlay atau kembali ke Beranda.

## Privasi dan keamanan

RLS membatasi foto hanya untuk anggota ruang. Kode undangan tidak ditampilkan lewat query daftar ruang; bergabung dilakukan secara atomik melalui RPC `join_couple`. RPC `leave_couple` mengizinkan partner 2 keluar tanpa izin update tabel yang luas. Bila partner 1 menghapus ruang, ruang dan foto ikut terhapus permanen karena relasi cascade. Setiap akun hanya dapat menjadi anggota satu ruang.

Foto dapat berukuran sampai 20 MB sebelum kompresi di browser. Batasi format dan ukuran unggahan juga pada Cloudinary unsigned preset. Penghapusan metadata foto dari Supabase tidak menghapus aset Cloudinary secara otomatis.
