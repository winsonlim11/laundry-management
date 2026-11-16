# Backup & pemulihan

## 1. Backup dari aplikasi (Owner)
*Pengaturan → Backup → Unduh backup sekarang* (atau `GET /api/backup`). Hanya pemegang izin `backup.manage` (default: Owner). Setiap unduhan tercatat di log aktivitas. Isi: semua tabel bisnis termasuk foto bukti; sesi login tidak ikut. Simpan file di lokasi aman (berisi data pelanggan).

## 2. Backup tingkat database (disarankan untuk produksi)
- **Neon**: aktifkan *Point-in-time restore / history retention* di dashboard Neon; buat *branch* sebelum perubahan besar.
- Mandiri: `pg_dump "$DATABASE_URL" -Fc -f laundry-$(date +%F).dump` (jadwalkan harian, simpan di luar server).

## 3. Pemulihan
### Dari file JSON aplikasi
```bash
# database baru & kosong
export DATABASE_URL="postgresql://…/laundry_baru"
npm run db:migrate
npm run restore-backup -- backup-laundry-2026-11-16T10-00-00-000Z.json
```
Script menolak database yang sudah berisi pengguna (pakai `--force` hanya bila yakin), memulihkan dalam satu transaksi, lalu menyinkronkan sequence ID. Arahkan `DATABASE_URL` aplikasi ke database baru dan redeploy.

### Dari pg_dump
```bash
createdb laundry_baru
pg_restore -d laundry_baru --no-owner laundry-2026-11-16.dump
```

Diverifikasi: backup JSON dari database demo (44 nota, 2 foto) dipulihkan ke database kosong dengan jumlah nota, total, pembayaran, dan ukuran foto identik.
