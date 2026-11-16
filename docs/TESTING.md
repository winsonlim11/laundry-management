# Pengujian

## Integrasi & uji penerimaan (Vitest)
Butuh PostgreSQL dengan database uji (nama harus mengandung "test"; skema dikosongkan setiap run).
```bash
createdb laundry_test
TEST_DATABASE_URL=postgresql://postgres@localhost:5432/laundry_test npm test
```
Cakupan: uji penerimaan wajib (nota 2,5 kg × Rp8.000 + 3 pcs × Rp5.000, diskon 10%, ongkir, DP tunai, pelunasan transfer hari berikutnya, laporan & ekspor XLSX/PDF per hari, retry pelunasan), pembayaran bersamaan, klik ganda, nomor nota konkuren, QRIS manual, webhook gateway berulang, perubahan tarif, Setrika Saja + ambil di toko, nota campuran, akses operator, poin tepat sekali, pembatalan ber-DP + refund bertanggal, jemput → nota, antar atomik + ongkos kurir, akses kurir lain, hak Admin vs Owner.

## Alur pengguna (Playwright)
```bash
createdb laundry_e2e
export DATABASE_URL=postgresql://postgres@localhost:5432/laundry_e2e DEMO_SEED=true SESSION_SECRET=$(openssl rand -base64 32)
npm run db:reset && npm run build && npx next start -p 3100 &
npx playwright install chromium   # sekali, bila belum ada Chrome
PW_CHANNEL=chromium npm run test:e2e   # atau tanpa PW_CHANNEL bila Google Chrome terpasang
```
Cakupan: kasir end-to-end (pelanggan baru → nota multi-item → DP → struk → pindai kode → profil), penolakan API kurir lain, CSRF/tanpa sesi, kurir ponsel (bukti foto → serah terima), operator Setrika Saja, serta pemeriksaan tampilan desktop/tablet/ponsel tanpa error & tanpa scroll horizontal. Tangkapan layar tersimpan di `e2e/screens/`.
