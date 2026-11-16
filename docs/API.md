# REST API

Semua endpoint (kecuali login, setup, dan webhook gateway) memerlukan cookie sesi `laundry_session`.
Permintaan yang mengubah data (POST/PATCH/PUT/DELETE) wajib **same-origin** dan membawa header
`x-requested-with: laundry-app` (perlindungan CSRF). Body JSON. Nominal = rupiah bulat (integer).
Galat: `{ "error": "pesan Bahasa Indonesia", "field"?: "..." }` dengan status 400/401/403/404/409/413/429/500.

Idempotensi: kirim header `Idempotency-Key: <uuid>` (atau `idempotencyKey` di body) pada pembayaran, refund, dan pembuatan nota. Permintaan berulang dengan kunci sama mengembalikan hasil pertama (`duplicate: true`).

## Auth
| Metode | Path | Keterangan |
| --- | --- | --- |
| POST | `/api/auth/login` | `{username, password}` — dibatasi 5 gagal/15 menit per user, 20 per IP |
| POST | `/api/auth/logout` | |
| GET | `/api/auth/me` | profil & izin aktor |
| POST | `/api/setup` | Owner pertama `{name, username, password, businessName?}` — hanya saat belum ada pengguna |

## Pelanggan (`customers.manage`)
| GET | `/api/customers?q=&take=` | cari nama/WA |
| POST | `/api/customers` | `{name, phone, address?, mapsUrl?, notes?, membership?}` |
| GET | `/api/customers/:id` | profil + riwayat pesanan, pembayaran, poin, statistik |
| PATCH | `/api/customers/:id` | ubah |
| DELETE | `/api/customers/:id` | arsipkan |
| POST | `/api/customers/:id/points` | `{points, note}` penyesuaian poin |

## Layanan
| GET | `/api/services?archived=1` | katalog |
| POST | `/api/services` | `services.manage` — `{code, name, unit: KG|PCS, flow: WASH_DRY|WASH_IRON|IRON_ONLY, price, expressPrice, estimateHours, expressEstimateHours, active, sortOrder}` |
| PATCH/DELETE | `/api/services/:id` | ubah / arsipkan (hapus bila belum pernah dipakai) |

## Pesanan
| POST | `/api/orders/preview` | hitung tagihan tanpa menyimpan |
| POST | `/api/orders` | `orders.create` — lihat contoh di bawah |
| GET | `/api/orders?q=&status=&paymentStatus=&page=` | daftar |
| GET | `/api/orders/lookup?code=` | cari dari kode QR/barcode atau nomor nota |
| GET | `/api/orders/:id` | detail (operator hanya pesanan yang ditugaskan, tanpa data keuangan) |
| POST | `/api/orders/:id/status` | `{to, note?}` — transisi sah saja |
| POST | `/api/orders/:id/assign` | `production.assign` — `{operatorId|null}` |
| POST | `/api/orders/:id/payments` | `payments.create` — `{method: CASH|QRIS|TRANSFER, amount, note?}` |
| POST | `/api/orders/:id/cancel` | `orders.cancel` — `{reason, refund?: {method, amount}}` |
| POST | `/api/orders/:id/refunds` | `refunds.create` — `{method, amount, note?}` (pesanan dibatalkan) |
| POST | `/api/orders/:id/delivery` | `logistics.manage` — jadwalkan antar |
| POST | `/api/payments/:id/confirm` · `/reject` | `payments.confirm` — verifikasi QRIS manual |
| POST | `/api/payments/gateway/midtrans` | webhook Midtrans (signature SHA-512) |

Contoh buat nota:
```json
{
  "customerId": 12,
  "items": [{ "serviceId": 2, "quantity": "2,5" }, { "serviceId": 5, "quantity": "3", "express": false }],
  "discountType": "PERCENT", "discountValue": 10,
  "extraFee": 0, "pickupFee": 0, "deliveryFee": 5000, "handover": "ANTAR",
  "initialPayment": { "method": "CASH", "amount": 10000 },
  "idempotencyKey": "4f0c…"
}
```

## Jemput & antar
| GET/POST | `/api/pickups` | `logistics.manage` — daftar / buat `{name, phone, address, mapsUrl?, scheduledAt, courierId?, fee, courierPay, notes?, customerId?}` |
| POST | `/api/pickups/:id/status` | `{to}` — kurir pemilik tugas atau staf |
| POST | `/api/deliveries/:id/status` | `{to: DALAM_PENGANTARAN|BERHASIL_DIANTAR|DIBATALKAN}` |
| GET/PATCH | `/api/tasks/:type/:id` | detail tugas / ganti kurir (`type` = pickup|delivery) |
| POST | `/api/tasks/:type/:id/photos` | multipart `photo` (JPG/PNG/WEBP ≤ 3 MB, dicek magic bytes) |
| GET | `/api/photos/:id` | foto (hanya staf / kurir pemilik) |
| GET | `/api/courier/tasks` | tugas milik kurir yang login |

## Laporan, pengeluaran, dashboard
| GET | `/api/dashboard` | |
| GET | `/api/reports?from=YYYY-MM-DD&to=&groupBy=day|week|month&serviceId=&paymentStatus=` | `reports.view` |
| GET | `/api/reports/export?format=xlsx|pdf&…` | filter & total sama dengan layar |
| GET/POST | `/api/expenses` · DELETE `/api/expenses/:id` | `expenses.manage` |

## Pegawai, pengaturan, sistem
| GET/POST | `/api/users` · PATCH `/api/users/:id` | Admin hanya peran operasional; Owner semua |
| GET | `/api/roles` · PUT `/api/roles/:key/permissions` | ubah izin — Owner |
| GET/PATCH | `/api/settings` | identitas usaha, struk, biaya default, aturan poin |
| GET | `/api/integrations` | status konfigurasi integrasi |
| GET | `/api/backup` | `backup.manage` — unduh JSON |
| GET | `/api/activity?page=` | `activity.view` |
| POST | `/api/whatsapp/send` | `{phone, message}` via WhatsApp API (jika dikonfigurasi) |
