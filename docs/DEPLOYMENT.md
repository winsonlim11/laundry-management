# Deploy ke Vercel (tanpa Supabase)

Database: **Neon Postgres** (gratis, tersedia di Vercel Marketplace, mengisi `DATABASE_URL` otomatis). Bisa juga PostgreSQL lain (Railway, VPS, dll.).

## A. Lewat GitHub (disarankan)
1. Push folder proyek ini ke repositori GitHub baru.
2. Di https://vercel.com/new → **Import** repositori tersebut. Framework terdeteksi Next.js; `vercel.json` sudah mengatur build command `npm run vercel-build` dan region `sin1` (Singapura).
3. Sebelum klik Deploy, buka **Storage → Create Database → Neon** (atau setelah proyek dibuat: *Project → Storage → Connect Database → Neon*), pilih region Singapore. Variabel `DATABASE_URL` otomatis terpasang.
4. Tambahkan Environment Variables (Production + Preview):
   - `SESSION_SECRET` = string acak ≥ 32 karakter (`openssl rand -base64 32`)
   - `DEMO_SEED` = `true` **hanya untuk demo ke klien** (membuat akun demo `owner/demo1234` dst. & data contoh). Untuk produksi asli: `false`, lalu buat Owner lewat `/setup`.
   - opsional: `BUSINESS_TZ`, `WHATSAPP_*`, `QRIS_GATEWAY`, `MIDTRANS_*` (lihat `.env.example`).
5. Deploy. Saat build, `scripts/deploy.mts` menjalankan migrasi → data dasar → (data demo). Selesai, buka URL `*.vercel.app`.

## B. Lewat Vercel CLI (dari laptop)
```bash
npm i -g vercel
cd laundry
vercel login
vercel link                       # buat proyek baru
# hubungkan Neon di dashboard (Storage → Neon) lalu:
vercel env add SESSION_SECRET production
vercel env add DEMO_SEED production   # isi: true (demo) / false (produksi)
vercel --prod
```

## Jika build gagal "Database belum terhubung" / "DATABASE_URL belum diatur"
Proyek belum punya database. Buka **Project → Storage → Create Database → Neon** (atau *Connect Database* bila sudah ada), centang environment Production & Preview, lalu **Deployments → ⋯ → Redeploy**. Aplikasi menerima `DATABASE_URL`, `POSTGRES_URL`, `POSTGRES_PRISMA_URL`, maupun `DATABASE_URL_UNPOOLED` (migrasi memakai URL non-pooled bila tersedia).

## Catatan
- Migrasi aman dijalankan berulang (advisory lock + pencatatan di `_app_migrations`).
- Untuk mengubah demo menjadi produksi: buat database baru (atau kosongkan), set `DEMO_SEED=false`, redeploy, lalu buka `/setup`.
- Foto bukti disimpan di database (maks. 3 MB/foto, dikompres di perangkat) sehingga tidak butuh storage tambahan. Untuk volume besar, pindahkan ke object storage.
- Fungsi serverless memakai pool koneksi kecil (`DB_POOL_MAX`, default 5). Gunakan URL **pooled** Neon.
