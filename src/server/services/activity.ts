import type { Prisma } from "@/generated/prisma/client";
import type { Tx } from "../db";
import { prisma } from "../db";

type Db = Tx | typeof prisma;

export async function logActivity(
  db: Db,
  actor: { id: number; name: string } | null,
  action: string,
  entity?: string,
  entityId?: string,
  detail?: Prisma.InputJsonValue,
) {
  await db.activityLog.create({
    data: { userId: actor?.id ?? null, userName: actor?.name ?? "Sistem", action, entity, entityId, detail },
  });
}

export const ACTION_LABEL: Record<string, string> = {
  "auth.login": "Masuk",
  "auth.logout": "Keluar",
  "order.create": "Membuat pesanan",
  "order.status": "Mengubah status pesanan",
  "order.assign": "Menugaskan operator",
  "order.cancel": "Membatalkan pesanan",
  "payment.create": "Menerima pembayaran",
  "payment.confirm": "Memverifikasi pembayaran",
  "payment.reject": "Menolak pembayaran",
  "payment.refund": "Mencatat pengembalian dana",
  "payment.gateway": "Notifikasi payment gateway",
  "customer.create": "Membuat pelanggan",
  "customer.update": "Memperbarui pelanggan",
  "customer.archive": "Mengarsipkan pelanggan",
  "loyalty.adjust": "Menyesuaikan poin",
  "service.create": "Membuat layanan",
  "service.update": "Memperbarui layanan",
  "service.archive": "Mengarsipkan layanan",
  "pickup.create": "Membuat permintaan jemput",
  "pickup.status": "Mengubah status jemput",
  "pickup.link": "Menautkan jemput ke pesanan",
  "delivery.create": "Membuat pengantaran",
  "delivery.status": "Mengubah status antar",
  "task.photo": "Mengunggah foto bukti",
  "expense.create": "Mencatat pengeluaran",
  "expense.delete": "Menghapus pengeluaran",
  "user.create": "Membuat pegawai",
  "user.update": "Memperbarui pegawai",
  "role.permissions": "Mengubah izin peran",
  "settings.update": "Mengubah pengaturan",
  "backup.create": "Membuat backup",
  "report.export": "Mengekspor laporan",
  "setup.owner": "Membuat Owner pertama",
};
