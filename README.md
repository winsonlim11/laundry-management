# Laundry Management System

Aplikasi web operasional laundry: kasir & struk, produksi, jemput–antar + layar kurir ponsel, dashboard, laporan (Excel/PDF), pengeluaran, poin loyalitas, pegawai & izin, pengaturan, backup, dan log aktivitas. Antarmuka berbahasa Indonesia. Nama usaha default **"Laundry"** (ubah di *Pengaturan → Identitas usaha*).

Developed by CHIRP DEV.

## Teknologi
Next.js 15 (App Router, runtime Node.js) · TypeScript · PostgreSQL · Prisma 7 (driver adapter `pg`) · Tailwind CSS 4 · Lucide · Recharts · iron-session (cookie sesi terenkripsi + tabel `sessions` untuk revokasi) · bcryptjs · Zod · ExcelJS · pdf-lib · qrcode · bwip-js · Vitest · Playwright.

## Menjalankan secara lokal

```bash
# 1. Prasyarat: Node.js ≥ 20.9 dan PostgreSQL ≥ 14
cp .env.example .env            # isi DATABASE_URL & SESSION_SECRET
npm install                     # otomatis menjalankan prisma generate
npm run db:deploy               # migrasi + data dasar (peran, izin, layanan awal)
#   ATAU dengan data contoh:  DEMO_SEED=true npm run db:deploy
npm run dev                     # http://localhost:3000
```

Owner pertama (tanpa kata sandi bawaan):
- buka `http://localhost:3000/setup` selama belum ada pengguna, **atau**
- `npm run create-owner -- <username> "<Nama>"` (kata sandi ditanya interaktif / `OWNER_PASSWORD`).

Akun demo (hanya bila `DEMO_SEED=true`, kata sandi semua `demo1234`): `owner`, `admin`, `kasir`, `operator`, `operator2`, `kurir`, `kurir2`.

## Perintah

| Perintah | Fungsi |
| --- | --- |
| `npm run dev` / `build` / `start` | Pengembangan / build produksi / jalankan build |
| `npm run db:migrate` | Terapkan migrasi SQL yang belum ada |
| `npm run db:deploy` | Migrasi + data dasar (+ data demo bila `DEMO_SEED=true`) |
| `npm run db:reset` | Kosongkan DB lalu deploy ulang (**dev/test saja**) |
| `npm run create-owner` | Buat Owner pertama |
| `npm run restore-backup -- file.json` | Pulihkan backup JSON ke DB kosong |
| `npm run lint` / `typecheck` | ESLint / TypeScript |
| `npm test` | Uji integrasi + uji penerimaan (Vitest, DB `laundry_test`) |
| `npm run test:e2e` | Alur pengguna utama + tampilan desktop/tablet/ponsel (Playwright) |

## Dokumentasi
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — rancangan modul, database, aturan bisnis
- [docs/API.md](docs/API.md) — REST API
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — deploy ke Vercel + Neon
- [docs/BACKUP.md](docs/BACKUP.md) — backup & pemulihan
- [docs/TESTING.md](docs/TESTING.md) — cara menjalankan pengujian
- [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md) — WhatsApp, Maps, QRIS, printer termal
