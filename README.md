# FazaHub

Jurnal foto privat untuk dua orang: React + Vite, Supabase Auth/Postgres/Realtime, Cloudinary unsigned uploads, dan PWA.

## Jalankan lokal

1. Buat project Supabase dan jalankan [`supabase/schema.sql`](./supabase/schema.sql) lewat SQL Editor. Jika project sudah memakai skema sebelumnya, jalankan ulang untuk menambahkan tabel langganan push.
2. Salin `.env.example` menjadi `.env`, lalu isi URL dan anon key Supabase.
3. Buat unsigned upload preset di Cloudinary. Batasi preset pada format gambar dan ukuran yang sesuai, lalu isi cloud name dan preset pada `.env`.
4. Jalankan `npm install`, `npm run dev`. Build production dengan `npm run build`.

Environment variables Vite:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_CLOUDINARY_CLOUD_NAME=
VITE_CLOUDINARY_UPLOAD_PRESET=
VITE_VAPID_PUBLIC_KEY=
```

Supabase dan Cloudinary wajib untuk aplikasi; `VITE_VAPID_PUBLIC_KEY` hanya diperlukan untuk fitur pengingat push. Semua variabel `VITE_*` tersedia di browser. Jangan letakkan service-role key, private VAPID key, atau kredensial privat lain di frontend. Upload foto langsung ke Cloudinary melalui unsigned preset; metadata tersimpan di Supabase.

## Deploy ke Vercel

Impor repository ke Vercel, atur framework preset **Vite**, build command `npm run build`, output directory `dist`, lalu tambahkan environment variables frontend di atas. `vercel.json` menangani fallback route ke aplikasi.

## Pengingat push harian

Pengingat dikirim pukul **20.00 waktu lokal** dan dilewati jika salah satu pasangan sudah menambahkan foto pada tanggal lokal tersebut. Pengingat memerlukan izin notifikasi, koneksi HTTPS, Edge Function Supabase, dan konfigurasi cron:

1. Buat VAPID key pair (misalnya dengan `npx web-push generate-vapid-keys`). Isi kunci publik ke `VITE_VAPID_PUBLIC_KEY` di `.env` dan environment Vercel.
2. Deploy function:

   ```sh
   supabase functions deploy send-daily-reminders --no-verify-jwt
   supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:email-anda@example.com CRON_SECRET=...
   ```

   Gunakan satu nilai acak kuat untuk `CRON_SECRET`; jangan pernah menaruh private VAPID key, service-role key, atau cron secret di variabel `VITE_*`.
3. Buat Vault secrets di SQL Editor Supabase dengan URL project dan nilai `CRON_SECRET` yang sama:

   ```sql
   select vault.create_secret('https://PROJECT_REF.supabase.co', 'fazahub_project_url');
   select vault.create_secret('GANTI_DENGAN_CRON_SECRET_YANG_SAMA', 'fazahub_cron_secret');
   ```
4. Jalankan [`supabase/reminders-cron.sql`](./supabase/reminders-cron.sql) untuk menjadwalkan pemeriksaan setiap lima menit.
5. Di FazaHub, aktifkan pengingat dari halaman **Ruang kita**. Di iPhone, push notification memerlukan iOS 16.4+ dan aplikasi ditambahkan ke Home Screen.

Jika pengguna tidak mengaktifkan izin notifikasi, aplikasi tidak mengirim push. Mengubah VAPID key setelah pengguna berlangganan mengharuskan mereka menonaktifkan lalu mengaktifkan ulang pengingat.

## Ekspor jurnal

Halaman **Ruang kita** menyediakan ekspor ZIP foto teroptimasi dengan `metadata.json` berisi tanggal, mood, catatan, dan nama pengirim. Ekspor dilakukan di browser; pastikan koneksi internet tersedia dan jangan menutup halaman sebelum unduhan selesai.

## Privasi & batas unggahan

RLS membatasi data foto pada anggota ruang. Join dilakukan melalui RPC atomik `join_couple` sehingga klien tidak memperoleh izin update bebas ke tabel pasangan. Setiap akun hanya dapat menjadi anggota satu ruang. Feed dan kalender memuat entri dengan pagination database, tanpa batas jumlah foto per hari. Foto dibatasi 15 MB di antarmuka; konfigurasi Cloudinary unsigned preset juga perlu membatasi format/ukuran upload. Hapus foto di Cloudinary bila entri foto dihapus dari database secara manual.

Service worker menyimpan aset aplikasi dan hasil transformasi foto untuk penggunaan ulang; permintaan Supabase selalu menggunakan jaringan.
