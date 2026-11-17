# FazaHub

Jurnal foto privat untuk dua orang: React + Vite, Supabase Auth/Postgres/Realtime, Cloudinary unsigned uploads, dan PWA.

## Jalankan lokal

1. Buat project Supabase dan jalankan [`supabase/schema.sql`](./supabase/schema.sql) lewat SQL Editor.
2. Salin `.env.example` menjadi `.env`, lalu isi URL dan anon key Supabase.
3. Buat unsigned upload preset di Cloudinary. Batasi preset pada format gambar dan ukuran yang sesuai, lalu isi cloud name dan preset pada `.env`.
4. Jalankan `npm install`, `npm run dev`. Build production dengan `npm run build`.

Environment variables Vite yang wajib:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_CLOUDINARY_CLOUD_NAME=
VITE_CLOUDINARY_UPLOAD_PRESET=
```

Semua variabel `VITE_*` tersedia di browser. Jangan letakkan service-role key atau kredensial privat di frontend. Upload foto langsung ke Cloudinary melalui unsigned preset; metadata tersimpan di Supabase.

## Deploy ke Vercel

Impor repository ke Vercel, atur framework preset **Vite**, build command `npm run build`, output directory `dist`, lalu tambahkan empat environment variables di atas. `vercel.json` menangani fallback route ke aplikasi.

## Privasi & batas unggahan

RLS membatasi data foto pada anggota ruang. Join dilakukan melalui RPC atomik `join_couple` sehingga klien tidak memperoleh izin update bebas ke tabel pasangan. Setiap akun hanya dapat menjadi anggota satu ruang. Feed dan kalender memuat entri dengan pagination database, tanpa batas jumlah foto per hari. Foto dibatasi 15 MB di antarmuka; konfigurasi Cloudinary unsigned preset juga perlu membatasi format/ukuran upload. Hapus foto di Cloudinary bila entri foto dihapus dari database secara manual.

Service worker menyimpan aset aplikasi dan hasil transformasi foto untuk penggunaan ulang; permintaan Supabase selalu menggunakan jaringan.
