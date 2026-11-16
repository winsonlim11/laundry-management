import { z } from "zod";
import { prisma } from "../db";
import type { Actor } from "../actor";
import { requirePerm } from "../actor";
import { badRequest } from "../errors";
import { logActivity } from "./activity";
import { gatewayStatus } from "./payments";

export async function getSettings() {
  const s = await prisma.businessSetting.findUnique({ where: { id: 1 } });
  if (s) return s;
  return prisma.businessSetting.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });
}

export const settingsInput = z.object({
  name: z.string().trim().min(2).max(80),
  address: z.string().trim().max(300),
  whatsapp: z.string().trim().max(20),
  logoDataUrl: z.string().max(400_000).nullable().optional(),
  receiptFooter: z.string().max(300),
  receiptWidth: z.union([z.literal(58), z.literal(80)]),
  printerName: z.string().max(100),
  showLogoOnReceipt: z.boolean(),
  defaultPickupFee: z.number().int().min(0),
  defaultDeliveryFee: z.number().int().min(0),
  pointsPerAmount: z.number().int().min(1000, "Minimal Rp1.000 per poin."),
  pointsEnabled: z.boolean(),
  qrisStaticPayload: z.string().max(1000).nullable().optional(),
}).partial();

export async function updateSettings(actor: Actor, raw: unknown) {
  requirePerm(actor, "settings.manage");
  const input = settingsInput.parse(raw);
  if (input.logoDataUrl && !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(input.logoDataUrl))
    throw badRequest("Logo harus gambar PNG/JPG/WEBP (maks. ±300 KB).");
  await getSettings();
  const s = await prisma.businessSetting.update({ where: { id: 1 }, data: input });
  await logActivity(prisma, actor, "settings.update", "settings", "1", { fields: Object.keys(input) });
  return s;
}

export function integrationStatus() {
  const gw = gatewayStatus();
  return [
    { key: "maps", name: "Google Maps", ready: true, detail: "Tautan lokasi & tombol \"Buka Maps\" berfungsi tanpa API key.", env: ["NEXT_PUBLIC_GOOGLE_MAPS_API_KEY (opsional, untuk embed peta)"], verified: true },
    { key: "wa_link", name: "WhatsApp (buka chat)", ready: true, detail: "Membuka chat wa.me berisi rincian nota. Tidak butuh konfigurasi.", env: [], verified: true },
    { key: "wa_api", name: "WhatsApp API (kirim otomatis)", ready: !!(process.env.WHATSAPP_PROVIDER && process.env.WHATSAPP_API_TOKEN), detail: "Mengirim notifikasi lewat penyedia (Fonnte). Belum diuji dengan kredensial nyata.", env: ["WHATSAPP_PROVIDER=fonnte", "WHATSAPP_API_TOKEN"], verified: false },
    { key: "qris_manual", name: "QRIS manual", ready: true, detail: "Pembayaran QRIS dicatat \"menunggu verifikasi\" sampai petugas mengonfirmasi. Isi payload QRIS statis di Pengaturan agar QR tampil di struk/kasir.", env: [], verified: true },
    { key: "qris_gateway", name: "Payment gateway QRIS (Midtrans)", ready: gw.configured, detail: "Webhook: POST /api/payments/gateway/midtrans (verifikasi signature SHA-512, notifikasi berulang diproses sekali). Belum diuji dengan akun Midtrans nyata.", env: ["QRIS_GATEWAY=midtrans", "MIDTRANS_SERVER_KEY", "MIDTRANS_IS_PRODUCTION"], verified: false },
    { key: "printer", name: "Printer termal", ready: true, detail: "Cetak dari browser dengan lebar 58/80 mm (pilih printer termal di dialog cetak). Belum diuji dengan perangkat fisik.", env: [], verified: false },
  ];
}
