import { z } from "zod";
import { prisma } from "../db";
import type { Actor } from "../actor";
import { requirePerm } from "../actor";
import { logActivity } from "./activity";

export const serviceInput = z.object({
  code: z.string().trim().min(2).max(20).regex(/^[A-Z0-9_-]+$/i, "Kode hanya huruf, angka, - atau _."),
  name: z.string().trim().min(2).max(60),
  unit: z.enum(["KG", "PCS"]),
  flow: z.enum(["WASH_DRY", "WASH_IRON", "IRON_ONLY"]),
  price: z.number().int().min(0, "Tarif tidak boleh negatif."),
  expressPrice: z.number().int().min(0, "Tarif express tidak boleh negatif."),
  estimateHours: z.number().int().min(1).max(720),
  expressEstimateHours: z.number().int().min(1).max(720),
  active: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

export async function listServices(includeArchived = false) {
  return prisma.service.findMany({ where: includeArchived ? {} : { archivedAt: null }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] });
}

export async function createService(actor: Actor, raw: unknown) {
  requirePerm(actor, "services.manage");
  const input = serviceInput.parse(raw);
  const s = await prisma.service.create({ data: { ...input, code: input.code.toUpperCase() } });
  await logActivity(prisma, actor, "service.create", "service", String(s.id), input);
  return s;
}

/** Ubah tarif/estimasi. Nota lama tidak berubah karena item menyimpan salinan nama, satuan, dan tarif. */
export async function updateService(actor: Actor, id: number, raw: unknown) {
  requirePerm(actor, "services.manage");
  const input = serviceInput.partial().parse(raw);
  const before = await prisma.service.findUniqueOrThrow({ where: { id } });
  const s = await prisma.service.update({ where: { id }, data: { ...input, code: input.code?.toUpperCase() } });
  await logActivity(prisma, actor, "service.update", "service", String(id), { before: { price: before.price, expressPrice: before.expressPrice }, after: input });
  return s;
}

/** Layanan yang sudah dirujuk transaksi diarsipkan, bukan dihapus. */
export async function archiveService(actor: Actor, id: number) {
  requirePerm(actor, "services.manage");
  const used = await prisma.orderItem.count({ where: { serviceId: id } });
  if (used === 0) {
    await prisma.service.delete({ where: { id } });
    await logActivity(prisma, actor, "service.archive", "service", String(id), { deleted: true });
    return { deleted: true };
  }
  await prisma.service.update({ where: { id }, data: { archivedAt: new Date(), active: false } });
  await logActivity(prisma, actor, "service.archive", "service", String(id), { archived: true });
  return { archived: true };
}
