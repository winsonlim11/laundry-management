import { z } from "zod";
import { prisma, type Tx } from "../db";
import type { Actor } from "../actor";
import { can, requirePerm } from "../actor";
import { badRequest, forbidden, notFound } from "../errors";
import { DELIVERY_NEXT, PICKUP_NEXT, DELIVERY_STATUS_LABEL, PICKUP_STATUS_LABEL, type DeliveryStatusT, type PickupStatusT } from "@/lib/status";
import { derivePaymentStatus } from "@/lib/pricing";
import { lockOrder, TX_OPTS } from "./common";
import { nextDocNumber } from "./sequence";
import { logActivity } from "./activity";
import { awardLoyaltyIfEligible } from "./loyalty";
import { localDateKey } from "@/lib/time";

const mapsUrl = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v === "" || /^https:\/\/(www\.)?(google\.[a-z.]+\/maps|maps\.google\.[a-z.]+|maps\.app\.goo\.gl|goo\.gl\/maps)/i.test(v), "Tautan harus berupa tautan Google Maps (https).")
  .optional();

const taskBase = {
  name: z.string().trim().min(2, "Nama wajib diisi.").max(100),
  phone: z.string().trim().min(8, "Nomor WhatsApp tidak valid.").max(20),
  address: z.string().trim().min(5, "Alamat wajib diisi.").max(500),
  mapsUrl,
  scheduledAt: z.coerce.date({ message: "Jadwal tidak valid." }),
  courierId: z.number().int().positive().nullable().optional(),
  fee: z.number().int().min(0, "Biaya tidak boleh negatif.").default(0),
  courierPay: z.number().int().min(0, "Ongkos kurir tidak boleh negatif.").default(0),
  notes: z.string().max(500).optional(),
};

export const pickupInput = z.object({ ...taskBase, customerId: z.number().int().positive().optional() });
export const deliveryInput = z.object({ ...taskBase, applyFeeToOrder: z.boolean().default(false) });

async function assertCourier(tx: Tx, courierId: number | null | undefined) {
  if (!courierId) return;
  const c = await tx.courier.findUnique({ where: { id: courierId }, include: { user: true } });
  if (!c || !c.active || !c.user.active) throw badRequest("Kurir tidak aktif.");
}

export async function createPickup(actor: Actor, raw: unknown, now = new Date()) {
  requirePerm(actor, "logistics.manage");
  const input = pickupInput.parse(raw);
  return prisma.$transaction(async (tx) => {
    await assertCourier(tx, input.courierId);
    const number = await nextDocNumber(tx, "JMP", now);
    const p = await tx.pickupRequest.create({
      data: {
        number, customerId: input.customerId ?? null, name: input.name, phone: input.phone.replace(/[^\d+]/g, ""),
        address: input.address, mapsUrl: input.mapsUrl || null, scheduledAt: input.scheduledAt,
        courierId: input.courierId ?? null, fee: input.fee, courierPay: input.courierPay, notes: input.notes, createdById: actor.id,
        history: { create: { track: "PICKUP", toStatus: "MENUNGGU_DIJEMPUT", userId: actor.id, userName: actor.name, createdAt: now, note: "Permintaan jemput dibuat" } },
      },
    });
    await logActivity(tx, actor, "pickup.create", "pickup", String(p.id), { number });
    return p;
  }, TX_OPTS);
}

export async function createDelivery(actor: Actor, orderId: number, raw: unknown, now = new Date()) {
  requirePerm(actor, "logistics.manage");
  const input = deliveryInput.parse(raw);
  return prisma.$transaction(async (tx) => {
    await lockOrder(tx, orderId);
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { delivery: true } });
    if (order.status === "SELESAI" || order.status === "DIBATALKAN") throw badRequest("Pesanan sudah final.");
    if (order.delivery && order.delivery.status !== "DIBATALKAN") throw badRequest("Pesanan ini sudah memiliki jadwal antar.");
    await assertCourier(tx, input.courierId);
    if (order.delivery) await tx.deliveryRequest.delete({ where: { id: order.delivery.id } }).catch(() => {
      throw badRequest("Jadwal antar lama masih memiliki riwayat; hubungi admin.");
    });
    const number = await nextDocNumber(tx, "ANT", now);
    // biaya antar ke pelanggan (bagian tagihan) — terpisah dari ongkos kurir (pengeluaran)
    const data: Record<string, unknown> = { handover: "ANTAR" };
    if (input.applyFeeToOrder && input.fee !== order.deliveryFee) {
      const total = order.subtotal - order.discountAmount + order.extraFee + order.pickupFee + input.fee;
      if (total < order.paidAmount) throw badRequest("Biaya antar baru membuat tagihan lebih kecil dari yang sudah dibayar.");
      data.deliveryFee = input.fee;
      data.total = total;
      data.paymentStatus = derivePaymentStatus(total, order.paidAmount);
      if (data.paymentStatus !== order.paymentStatus) {
        await tx.orderStatusHistory.create({
          data: { track: "PAYMENT", orderId, fromStatus: order.paymentStatus, toStatus: data.paymentStatus as string, userId: actor.id, userName: actor.name, createdAt: now, note: "Biaya antar ditambahkan" },
        });
      }
    }
    await tx.order.update({ where: { id: orderId }, data });
    const d = await tx.deliveryRequest.create({
      data: {
        number, orderId, name: input.name, phone: input.phone.replace(/[^\d+]/g, ""), address: input.address,
        mapsUrl: input.mapsUrl || null, scheduledAt: input.scheduledAt, courierId: input.courierId ?? null,
        fee: input.applyFeeToOrder ? input.fee : order.deliveryFee, courierPay: input.courierPay, notes: input.notes, createdById: actor.id,
        history: { create: { track: "DELIVERY", orderId, toStatus: "MENUNGGU_DIANTAR", userId: actor.id, userName: actor.name, createdAt: now, note: "Jadwal antar dibuat" } },
      },
    });
    await logActivity(tx, actor, "delivery.create", "delivery", String(d.id), { number, orderId });
    return d;
  }, TX_OPTS);
}

export async function assignTaskCourier(actor: Actor, type: "pickup" | "delivery", id: number, courierId: number | null) {
  requirePerm(actor, "logistics.manage");
  return prisma.$transaction(async (tx) => {
    await assertCourier(tx, courierId);
    const r = type === "pickup"
      ? await tx.pickupRequest.update({ where: { id }, data: { courierId } })
      : await tx.deliveryRequest.update({ where: { id }, data: { courierId } });
    await logActivity(tx, actor, `${type}.status`, type, String(id), { courierId });
    return r;
  });
}

/** Otorisasi per objek tugas: staf logistik, atau kurir pemilik tugas. */
function assertTaskAccess(actor: Actor, courierId: number | null) {
  if (can(actor, "logistics.manage")) return;
  if (can(actor, "courier.tasks") && actor.courierId && courierId === actor.courierId) return;
  throw forbidden("Tugas ini bukan milik Anda.");
}

export async function advancePickup(actor: Actor, id: number, to: PickupStatusT, now = new Date()) {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ id: number }[]>`SELECT "id" FROM "pickup_requests" WHERE "id" = ${id} FOR UPDATE`;
    if (!rows.length) throw notFound("Tugas jemput tidak ditemukan.");
    const p = await tx.pickupRequest.findUniqueOrThrow({ where: { id } });
    assertTaskAccess(actor, p.courierId);
    if (to === "DIBATALKAN") {
      requirePerm(actor, "logistics.manage");
      if (p.status === "DITERIMA_LAUNDRY" || p.status === "DIBATALKAN") throw badRequest("Tugas jemput sudah final.");
    } else if (PICKUP_NEXT[p.status] !== to) {
      throw badRequest(`Status jemput "${PICKUP_STATUS_LABEL[p.status]}" tidak dapat langsung menjadi "${PICKUP_STATUS_LABEL[to]}".`);
    }
    if (to === "SUDAH_DIJEMPUT") {
      const photos = await tx.taskPhoto.count({ where: { pickupRequestId: id } });
      if (!photos) throw badRequest("Unggah foto bukti penjemputan terlebih dahulu.");
    }
    await tx.pickupRequest.update({ where: { id }, data: { status: to } });
    await tx.orderStatusHistory.create({
      data: { track: "PICKUP", pickupRequestId: id, orderId: p.orderId, fromStatus: p.status, toStatus: to, userId: actor.id, userName: actor.name, createdAt: now },
    });
    if (to === "DITERIMA_LAUNDRY" && p.courierPay > 0) {
      await tx.expense.create({
        data: { date: new Date(localDateKey(now) + "T00:00:00Z"), category: "Transportasi - Ongkos Kurir", amount: p.courierPay, description: `Ongkos jemput ${p.number}`, pickupRequestId: id, createdById: actor.id },
      });
    }
    await logActivity(tx, actor, "pickup.status", "pickup", String(id), { from: p.status, to });
    return tx.pickupRequest.findUniqueOrThrow({ where: { id } });
  }, TX_OPTS);
}

/**
 * Pengantaran. Mulai antar → status pesanan ikut menjadi Dalam Pengantaran.
 * Konfirmasi serah terima → pesanan Selesai, riwayat, poin, dan ongkos kurir dicatat dalam satu transaksi.
 */
export async function advanceDelivery(actor: Actor, id: number, to: DeliveryStatusT, now = new Date()) {
  return prisma.$transaction(async (tx) => {
    const d0 = await tx.deliveryRequest.findUnique({ where: { id } });
    if (!d0) throw notFound("Tugas antar tidak ditemukan.");
    await lockOrder(tx, d0.orderId);
    const d = await tx.deliveryRequest.findUniqueOrThrow({ where: { id } });
    assertTaskAccess(actor, d.courierId);
    const order = await tx.order.findUniqueOrThrow({ where: { id: d.orderId } });
    if (to === "DIBATALKAN") {
      requirePerm(actor, "logistics.manage");
      if (d.status === "BERHASIL_DIANTAR" || d.status === "DIBATALKAN") throw badRequest("Tugas antar sudah final.");
      await tx.deliveryRequest.update({ where: { id }, data: { status: "DIBATALKAN" } });
      await tx.orderStatusHistory.create({ data: { track: "DELIVERY", orderId: d.orderId, deliveryRequestId: id, fromStatus: d.status, toStatus: to, userId: actor.id, userName: actor.name, createdAt: now } });
      if (order.status === "DALAM_PENGANTARAN") {
        await tx.order.update({ where: { id: order.id }, data: { status: "SIAP_DIAMBIL" } });
        await tx.orderStatusHistory.create({ data: { track: "PRODUCTION", orderId: order.id, fromStatus: "DALAM_PENGANTARAN", toStatus: "SIAP_DIAMBIL", userId: actor.id, userName: actor.name, createdAt: now, note: "Pengantaran dibatalkan" } });
      }
      await tx.order.update({ where: { id: order.id }, data: { handover: "AMBIL_SENDIRI" } });
      await logActivity(tx, actor, "delivery.status", "delivery", String(id), { from: d.status, to });
      return tx.deliveryRequest.findUniqueOrThrow({ where: { id } });
    }
    if (DELIVERY_NEXT[d.status] !== to)
      throw badRequest(`Status antar "${DELIVERY_STATUS_LABEL[d.status]}" tidak dapat langsung menjadi "${DELIVERY_STATUS_LABEL[to]}".`);
    if (order.status === "DIBATALKAN") throw badRequest("Pesanan sudah dibatalkan.");

    if (to === "DALAM_PENGANTARAN") {
      if (order.status !== "SIAP_DIAMBIL") throw badRequest("Pesanan belum siap; selesaikan pengerjaan dahulu.");
      await tx.order.update({ where: { id: order.id }, data: { status: "DALAM_PENGANTARAN" } });
      await tx.orderStatusHistory.create({ data: { track: "PRODUCTION", orderId: order.id, fromStatus: order.status, toStatus: "DALAM_PENGANTARAN", userId: actor.id, userName: actor.name, createdAt: now, note: `Dibawa kurir (${d.number})` } });
    }
    if (to === "BERHASIL_DIANTAR") {
      const photos = await tx.taskPhoto.count({ where: { deliveryRequestId: id } });
      if (!photos) throw badRequest("Unggah foto bukti serah terima terlebih dahulu.");
      await tx.order.update({ where: { id: order.id }, data: { status: "SELESAI", completedAt: now } });
      await tx.orderStatusHistory.create({ data: { track: "PRODUCTION", orderId: order.id, fromStatus: order.status, toStatus: "SELESAI", userId: actor.id, userName: actor.name, createdAt: now, note: "Diterima pelanggan" } });
      await awardLoyaltyIfEligible(tx, order.id);
      if (d.courierPay > 0) {
        await tx.expense.create({
          data: { date: new Date(localDateKey(now) + "T00:00:00Z"), category: "Transportasi - Ongkos Kurir", amount: d.courierPay, description: `Ongkos antar ${d.number}`, deliveryRequestId: id, createdById: actor.id },
        });
      }
    }
    await tx.deliveryRequest.update({ where: { id }, data: { status: to } });
    await tx.orderStatusHistory.create({ data: { track: "DELIVERY", orderId: d.orderId, deliveryRequestId: id, fromStatus: d.status, toStatus: to, userId: actor.id, userName: actor.name, createdAt: now } });
    await logActivity(tx, actor, "delivery.status", "delivery", String(id), { from: d.status, to });
    return tx.deliveryRequest.findUniqueOrThrow({ where: { id } });
  }, TX_OPTS);
}

export async function getTask(actor: Actor, type: "pickup" | "delivery", id: number) {
  if (type === "pickup") {
    const t = await prisma.pickupRequest.findUnique({
      where: { id },
      include: { photos: { select: { id: true, createdAt: true, mime: true, size: true } }, history: { orderBy: { createdAt: "asc" } }, courier: { include: { user: true } }, order: { select: { id: true, number: true } } },
    });
    if (!t) throw notFound("Tugas tidak ditemukan.");
    assertTaskAccess(actor, t.courierId);
    return { type, task: t };
  }
  const t = await prisma.deliveryRequest.findUnique({
    where: { id },
    include: {
      photos: { select: { id: true, createdAt: true, mime: true, size: true } }, history: { orderBy: { createdAt: "asc" } }, courier: { include: { user: true } },
      order: { select: { id: true, number: true, total: true, paidAmount: true, paymentStatus: true, status: true } },
    },
  });
  if (!t) throw notFound("Tugas tidak ditemukan.");
  assertTaskAccess(actor, t.courierId);
  return { type, task: t };
}

export async function listCourierTasks(actor: Actor) {
  requirePerm(actor, "courier.tasks");
  if (!actor.courierId) return { pickups: [], deliveries: [] };
  const [pickups, deliveries] = await Promise.all([
    prisma.pickupRequest.findMany({ where: { courierId: actor.courierId }, orderBy: [{ scheduledAt: "asc" }], take: 100 }),
    prisma.deliveryRequest.findMany({
      where: { courierId: actor.courierId }, orderBy: [{ scheduledAt: "asc" }], take: 100,
      include: { order: { select: { number: true, total: true, paidAmount: true, paymentStatus: true, status: true } } },
    }),
  ]);
  return { pickups, deliveries };
}

export async function listLogistics(actor: Actor) {
  requirePerm(actor, "logistics.manage");
  const [pickups, deliveries] = await Promise.all([
    prisma.pickupRequest.findMany({ orderBy: { scheduledAt: "desc" }, take: 100, include: { courier: { include: { user: true } }, order: { select: { id: true, number: true } } } }),
    prisma.deliveryRequest.findMany({ orderBy: { scheduledAt: "desc" }, take: 100, include: { courier: { include: { user: true } }, order: { select: { id: true, number: true, status: true } } } }),
  ]);
  return { pickups, deliveries };
}

// ---------------- Foto bukti ----------------

export const MAX_PHOTO_BYTES = 3 * 1024 * 1024;

export function sniffImage(buf: Buffer): string | null {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.length > 12 && buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WEBP") return "image/webp";
  return null;
}

export async function uploadTaskPhoto(actor: Actor, type: "pickup" | "delivery", id: number, buf: Buffer, declaredMime: string) {
  if (buf.length === 0) throw badRequest("File kosong.");
  if (buf.length > MAX_PHOTO_BYTES) throw badRequest("Ukuran foto maksimal 3 MB.");
  const mime = sniffImage(buf);
  if (!mime) throw badRequest("Format foto harus JPG, PNG, atau WEBP.");
  if (declaredMime && !["image/jpeg", "image/png", "image/webp"].includes(declaredMime)) throw badRequest("Tipe file tidak diizinkan.");
  const { task } = await getTask(actor, type, id);
  const photo = await prisma.taskPhoto.create({
    data: { [type === "pickup" ? "pickupRequestId" : "deliveryRequestId"]: task.id, mime, size: buf.length, data: new Uint8Array(buf), uploadedById: actor.id },
    select: { id: true, createdAt: true },
  });
  await logActivity(prisma, actor, "task.photo", type, String(id), { photoId: photo.id, size: buf.length });
  return photo;
}

export async function getTaskPhoto(actor: Actor, photoId: number) {
  const p = await prisma.taskPhoto.findUnique({ where: { id: photoId }, include: { pickupRequest: true, deliveryRequest: true } });
  if (!p) throw notFound("Foto tidak ditemukan.");
  const courierId = p.pickupRequest?.courierId ?? p.deliveryRequest?.courierId ?? null;
  if (!can(actor, "orders.view_all")) assertTaskAccess(actor, courierId);
  return p;
}
