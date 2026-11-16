# Integrasi

Status tiap integrasi terlihat di *Pengaturan → Integrasi*.

| Integrasi | Tanpa konfigurasi | Dengan konfigurasi | Status verifikasi |
| --- | --- | --- | --- |
| Google Maps | Tombol "Buka Maps" memakai tautan yang disimpan atau pencarian alamat | `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (cadangan untuk embed peta) | Tautan diuji |
| WhatsApp – buka chat | `wa.me` berisi rincian nota/sisa tagihan | – | Diuji (tautan) |
| WhatsApp – kirim otomatis | – | `WHATSAPP_PROVIDER=fonnte`, `WHATSAPP_API_TOKEN` → `POST /api/whatsapp/send` | **Belum diuji dengan akun nyata** |
| QRIS manual | Pembayaran QRIS = "menunggu verifikasi" sampai petugas klik *Verifikasi*. Isi payload QRIS statis di Pengaturan → Struk agar QR bayar tampil di struk | – | Diuji |
| QRIS gateway (Midtrans) | – | `QRIS_GATEWAY=midtrans`, `MIDTRANS_SERVER_KEY`, `MIDTRANS_IS_PRODUCTION`; set Notification URL Midtrans ke `https://<domain>/api/payments/gateway/midtrans`. `order_id` = `payments.qrisCode`. Signature SHA-512 diverifikasi; notifikasi berulang diproses sekali | Diuji dengan payload simulasi; **belum dengan akun Midtrans nyata**. Pembuatan charge QRIS dinamis belum diimplementasikan (perlu kredensial) |
| Printer termal | Struk 58/80 mm, cetak dari dialog browser (margin None, skala 100%) | Nama printer di Pengaturan sebagai pengingat | **Belum diuji dengan printer fisik** |

Kode referensi nota (QR/barcode di struk, `orders.refCode`) terpisah dari kode transaksi QRIS (`payments.qrisCode`). QR nota membuka `/o/<kode>` yang tetap memerlukan login dan hak akses.
