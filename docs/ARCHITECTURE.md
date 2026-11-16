# Rancangan

## Batas modul
```
src/
  lib/              ← aturan murni, dipakai klien & server
    pricing.ts      ← HARGA: parsing jumlah, pembulatan setengah-ke-atas, diskon, total, status bayar
    status.ts       ← TRANSISI STATUS pengerjaan, jemput, antar + label
    permissions.ts  ← daftar izin & hak awal per peran
    time.ts         ← zona waktu bisnis (Asia/Jakarta) & batas hari lokal
  server/
    services/       ← SATU-SATUNYA tempat penulisan data & otorisasi per objek
      orders.ts     ← buat nota (snapshot tarif), daftar/detail, tugaskan operator, transisi, batal
      payments.ts   ← pembayaran (transaksi + FOR UPDATE + idempotensi), verifikasi QRIS, refund, webhook gateway
      logistics.ts  ← jemput/antar, foto bukti, akses kurir
      reports.ts    ← laporan & dashboard (dipakai layar dan ekspor)
      loyalty.ts, customers.ts, catalog.ts, users.ts, settings.ts, expenses.ts, backup.ts, receipt.ts …
    http.ts         ← pembungkus REST: sesi, CSRF, pemetaan error → JSON
    exports.ts      ← XLSX & PDF dari objek laporan yang sama
  app/api/**        ← REST API tipis → services
  app/(app)/**      ← halaman (server component memanggil services dengan aktor yang sama)
```
UI → REST API → service → Prisma. Halaman server membaca lewat service yang sama, sehingga UI, API, laporan, dan ekspor memakai aturan identik. Pratinjau tagihan di kasir memakai `lib/pricing.ts` yang sama dengan server; server tetap menghitung ulang dari tarif yang berlaku saat menyimpan.

## Database (tabel utama)
`users, roles, permissions, role_permissions, sessions, login_attempts, customers, services, orders, order_items, payments, order_status_history, pickup_requests, delivery_requests, couriers, task_photos, expenses, loyalty_ledger, business_settings, activity_logs, doc_sequences, gateway_notifications` — lihat `prisma/schema.prisma` & `prisma/migrations/0001_init/migration.sql`.

Constraint penting:
- `orders.number`, `orders.refCode`, `orders.idempotencyKey`, `payments.idempotencyKey`, `payments.qrisCode`, `payments.gatewayRef` **unique**.
- CHECK: diskon ≤ subtotal, biaya ≥ 0, `paidAmount ≤ total`, `refundedAmount ≤ paidAmount`, jumlah item > 0, nominal pembayaran > 0.
- `loyalty_ledger (orderId, type)` unique → poin pesanan tercatat tepat sekali.
- `gateway_notifications (provider, externalId, status)` unique → notifikasi berulang diproses sekali.
- `delivery_requests.orderId`, `pickup_requests.orderId` unique.
- Master data yang dirujuk transaksi (layanan, pelanggan) **diarsipkan** (`archivedAt`), tidak dihapus.
- Indeks untuk pencarian pelanggan (nama, WA), filter pesanan (status, status bayar, tanggal), laporan (`payments(status, confirmedAt)`), tugas kurir (`courierId, status`).

## Aturan bisnis & lokasinya
| Aturan | Lokasi |
| --- | --- |
| Rupiah bulat, KG ≤ 3 desimal, PCS bulat, pembulatan ½ ke atas (integer, tanpa float) | `lib/pricing.ts` |
| Snapshot nama/satuan/tarif di `order_items` | `services/orders.ts#createOrder` |
| Satu diskon (nominal/%) atas subtotal; biaya tambahan/jemput/antar masing-masing sekali | `lib/pricing.ts#computeBill` |
| Status bayar diturunkan dari pembayaran TERKONFIRMASI | `services/payments.ts#recomputeOrderPayment` |
| Tolak bayar > sisa; aman klik ganda/retry/2 kasir | transaksi + `SELECT … FOR UPDATE` + kunci idempotensi |
| QRIS manual = PENDING sampai diverifikasi; PENDING ikut memesan sisa | `services/payments.ts` |
| Nomor nota unik konkuren | `doc_sequences` UPSERT … RETURNING (`services/sequence.ts`) |
| Transisi status sah per layanan & serah terima | `lib/status.ts` (dicek di server `transitionOrder`) |
| Riwayat status + pegawai + waktu dalam transaksi yang sama | semua service menulis `order_status_history` di tx yang sama |
| Mulai antar → pesanan "Dalam Pengantaran"; serah terima → Selesai (atomik) | `services/logistics.ts#advanceDelivery` |
| Biaya antar ke pelanggan (tagihan) ≠ ongkos kurir (pengeluaran) | `orders.deliveryFee` vs `expenses` kategori "Transportasi - Ongkos Kurir" |
| Pembatalan simpan alasan & riwayat bayar; refund transaksi terpisah ≤ dana tersisa | `cancelOrder`, `refundTx` |
| Penerimaan dihitung dari `confirmedAt` dalam WIB | `services/reports.ts` |

## Status pengerjaan
Jalur = `Baru → Menunggu Proses → (tahap yang dibutuhkan gabungan semua item) → Dikemas → Siap Diambil → [Antar: Dalam Pengantaran] → Selesai`.
- Cuci Kering: Dicuci → Dikeringkan · Cuci Setrika: Dicuci → Dikeringkan → Disetrika · Setrika Saja: Disetrika.
- Nota campuran baru "siap" setelah semua tahap yang dibutuhkan item mana pun dilalui.
- Ambil sendiri: Siap Diambil → Selesai oleh kasir (serah terima). Antar: diselesaikan oleh konfirmasi kurir + foto bukti.
- Dibatalkan dari status mana pun kecuali Selesai (butuh izin `orders.cancel`).

## Migrasi
Migrasi berupa SQL murni di `prisma/migrations/*/migration.sql`, dijalankan oleh `scripts/migrate.mts` (transaksi + advisory lock, tercatat di `_app_migrations`). Ini dipilih agar migrasi tidak bergantung pada unduhan engine biner Prisma saat deploy. Skema Prisma (`schema.prisma`) dipakai untuk client bertipe.
