import { z } from "zod";
import { prisma, type Tx } from "../db";
import type { Actor } from "../actor";
import { can, requirePerm } from "../actor";
import { badRequest, forbidden, notFound } from "../errors";
import { computeBill, milliToString, parseQuantity, PricingError } from "@/lib/pricing";
import { canTransition, DELIVERY_CONTROLLED, nextStatus, ORDER_STATUS_LABEL, type FlowT, type OrderStatusT } from "@/lib/status";
import { isUniqueViolation, lockOrder, TX_OPTS } from "./common";
import { newRefCode, nextDocNumber } from "./sequence";
import { logActivity } from "./activity";
import { paymentInput, recordPaymentTx, refundTx } from "./payments";
import { awardLoyaltyIfEligible } from "./loyalty";
import type { Prisma } from "@/generated/prisma/client";

const money = (label: string) =>
  z.number({ message: `${label} wajib angka.` }).int(`${label} harus rupiah bulat.`).min(0, `${label} tidak boleh negatif.`);

export const createOrderInput = z.object({
  customerId: z.number().int().positive({ message: "Pilih pelanggan." }),
  items: z
    .array(
      z.object({
        serviceId: z.number().int().positive(),
        quantity: z.union([z.string(), z.number()]),
        express: z.boolean().default(false),
        notes: z.string().max(200).optional(),
      }),
    )
    .min(1, "Tambahkan minimal satu layanan.")
    .max(30),
  discountType: z.enum(["NONE", "NOMINAL", "PERCENT"]).default("NONE"),
  discountValue: z.number().int("Diskon harus bilangan bulat.").min(0, "Diskon tidak boleh negatif.").default(0),
  extraFee: money("Biaya tambahan").default(0),
  extraFeeNote: z.string().max(100).optional(),
  pickupFee: money("Biaya jemput").default(0),
  deliveryFee: money("Biaya antar").default(0),
  handover: z.enum(["AMBIL_SENDIRI", "ANTAR"]).default("AMBIL_SENDIRI"),
  notes: z.string().max(500).optional(),
  pickupRequestId: z.number().int().positive().optional(),
  assignedOperatorId: z.number().int().positive().optional(),
  initialPayment: paymentInput.optional(),
  idempotencyKey: z.string().min(8).max(100).optional(),
});
export type CreateOrderInput = z.input<typeof createOrderInput>;

/** Ambil tarif berlaku & hitung tagihan. Dipakai saat simpan dan endpoint pratinjau. */
export async function priceOrder(db: Tx | typeof prisma, input: z.infer<typeof createOrderInput>) {
  const ids = [...new Set(input.items.map((i) => i.serviceId))];
  const services = await db.service.findMany({ where: { id: { in: ids } } });
  const byId = new Map(services.map((s) => [s.id, s]));
  const lines = input.items.map((it) => {
    const s = byId.get(it.serviceId);
    if (!s || !s.active || s.archivedAt) throw badRequest("Layanan tidak tersedia.");
    let milli: number;
    try {
      milli = parseQuantity(it.quantity, s.unit);
    } catch (e) {
      throw badRequest(`${s.name}: ${(e as Error).message}`);
    }
    const unitPrice = it.express ? s.expressPrice : s.price;
    const hours = it.express ? s.expressEstimateHours : s.estimateHours;
    return { it, s, milli, unitPrice, hours };
  });
  let bill;
  try {
    bill = computeBill({
      lines: lines.map((l) => ({ unitPrice: l.unitPrice, quantityMilli: l.milli })),
      discountType: input.discountType,
      discountValue: input.discountValue,
      extraFee: input.extraFee,
      pickupFee: input.pickupFee,
      deliveryFee: input.deliveryFee,
    });
  } catch (e) {
    if (e instanceof PricingError) throw badRequest(e.message);
    throw e;
  }
  const maxHours = Math.max(...lines.map((l) => l.hours));
  return { lines, bill, maxHours };
}

export async function createOrder(actor: Actor, raw: unknown, now = new Date()) {
  requirePerm(actor, "orders.create");
  const input = createOrderInput.parse(raw);
  if (input.initialPayment) requirePerm(actor, "payments.create");
  if (input.assignedOperatorId) requirePerm(actor, "production.assign", "orders.create");
  const run = () =>
    prisma.$transaction(async (tx) => {
      if (input.idempotencyKey) {
        const ex = await tx.order.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
        if (ex) return { order: ex, duplicate: true };
      }
      const customer = await tx.customer.findUnique({ where: { id: input.customerId } });
      if (!customer || customer.archivedAt) throw badRequest("Pelanggan tidak ditemukan.");
      const { lines, bill, maxHours } = await priceOrder(tx, input);
      if (input.assignedOperatorId) await assertOperator(tx, input.assignedOperatorId);

      const number = await nextDocNumber(tx, "LND", now);
      const order = await tx.order.create({
        data: {
          number,
          refCode: newRefCode(),
          idempotencyKey: input.idempotencyKey ?? null,
          customerId: customer.id,
          createdById: actor.id,
          assignedOperatorId: input.assignedOperatorId ?? null,
          status: "BARU",
          handover: input.handover,
          subtotal: bill.subtotal,
          discountType: input.discountType,
          discountValue: input.discountType === "NONE" ? 0 : input.discountValue,
          discountAmount: bill.discountAmount,
          extraFee: bill.extraFee,
          extraFeeNote: input.extraFeeNote,
          pickupFee: bill.pickupFee,
          deliveryFee: bill.deliveryFee,
          total: bill.total,
          estimatedDoneAt: new Date(now.getTime() + maxHours * 3600000),
          notes: input.notes,
          createdAt: now,
          items: {
            create: lines.map((l, i) => ({
              serviceId: l.s.id,
              serviceName: l.s.name + (l.it.express ? " (Express)" : ""),
              unit: l.s.unit,
              flow: l.s.flow,
              express: l.it.express,
              unitPrice: l.unitPrice,
              quantity: milliToString(l.milli),
              lineTotal: bill.lineTotals[i],
              notes: l.it.notes,
            })),
          },
          history: {
            create: [
              { track: "PRODUCTION", toStatus: "BARU", userId: actor.id, userName: actor.name, createdAt: now, note: "Pesanan dibuat" },
              { track: "PAYMENT", toStatus: bill.total === 0 ? "LUNAS" : "BELUM_BAYAR", userId: actor.id, userName: actor.name, createdAt: now },
            ],
          },
        },
      });
      if (bill.total === 0) await tx.order.update({ where: { id: order.id }, data: { paymentStatus: "LUNAS" } });

      if (input.pickupRequestId) {
        const pk = await tx.pickupRequest.findUnique({ where: { id: input.pickupRequestId } });
        if (!pk || pk.orderId) throw badRequest("Permintaan jemput tidak valid atau sudah ditautkan.");
        if (pk.status === "DIBATALKAN") throw badRequest("Permintaan jemput sudah dibatalkan.");
        await tx.pickupRequest.update({
          where: { id: pk.id },
          data: { orderId: order.id, customerId: customer.id, status: "DITERIMA_LAUNDRY" },
        });
        if (pk.status !== "DITERIMA_LAUNDRY") {
          await tx.orderStatusHistory.create({
            data: { track: "PICKUP", orderId: order.id, pickupRequestId: pk.id, fromStatus: pk.status, toStatus: "DITERIMA_LAUNDRY", userId: actor.id, userName: actor.name, createdAt: now, note: `Ditautkan ke ${number}` },
          });
        }
        await logActivity(tx, actor, "pickup.link", "pickup", String(pk.id), { orderId: order.id });
      }
      if (input.assignedOperatorId) {
        await tx.order.update({ where: { id: order.id }, data: { status: "MENUNGGU_PROSES" } });
        await tx.orderStatusHistory.create({
          data: { track: "PRODUCTION", orderId: order.id, fromStatus: "BARU", toStatus: "MENUNGGU_PROSES", userId: actor.id, userName: actor.name, createdAt: now, note: "Ditugaskan ke operator" },
        });
      }
      await logActivity(tx, actor, "order.create", "order", String(order.id), { number, total: bill.total });
      if (input.initialPayment) {
        const pay = { ...input.initialPayment, idempotencyKey: input.initialPayment.idempotencyKey ?? (input.idempotencyKey ? input.idempotencyKey + ":dp" : undefined) };
        await recordPaymentTx(tx, actor, order.id, pay, now);
      }
      return { order: await tx.order.findUniqueOrThrow({ where: { id: order.id } }), duplicate: false };
    }, TX_OPTS);
  try {
    return await run();
  } catch (e) {
    if (input.idempotencyKey && isUniqueViolation(e)) {
      const ex = await prisma.order.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
      if (ex) return { order: ex, duplicate: true };
    }
    throw e;
  }
}

async function assertOperator(tx: Tx, userId: number) {
  const u = await tx.user.findUnique({ where: { id: userId }, include: { role: { include: { permissions: { include: { permission: true } } } } } });
  const ok = u?.active && u.role.permissions.some((rp) => rp.permission.key.startsWith("production.update"));
  if (!ok) throw badRequest("Pegawai yang dipilih bukan operator aktif.");
}

// ---------------- Akses baca ----------------

const orderDetailInclude = {
  customer: true,
  items: { orderBy: { id: "asc" } },
  payments: { orderBy: { createdAt: "asc" } },
  history: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
  pickup: true,
  delivery: { include: { courier: { include: { user: true } } } },
} satisfies Prisma.OrderInclude;

export type OrderDetail = Prisma.OrderGetPayload<{ include: typeof orderDetailInclude }>;

/** Otorisasi per objek: kasir/admin melihat semua; operator hanya pesanan yang ditugaskan. */
export async function getOrderForActor(actor: Actor, id: number) {
  const order = await prisma.order.findUnique({ where: { id }, include: orderDetailInclude });
  if (!order) throw notFound("Pesanan tidak ditemukan.");
  if (can(actor, "orders.view_all")) return { order, financial: true };
  if ((can(actor, "production.update_assigned") || can(actor, "production.update_any")) &&
      (order.assignedOperatorId === actor.id || can(actor, "production.update_any")))
    return { order, financial: false };
  throw forbidden("Pesanan ini tidak ditugaskan kepada Anda.");
}

export async function findOrderByRef(actor: Actor, code: string) {
  const c = code.trim().toUpperCase();
  const o = await prisma.order.findFirst({ where: { OR: [{ refCode: c }, { number: c }] }, select: { id: true } });
  if (!o) throw notFound("Nota tidak ditemukan.");
  await getOrderForActor(actor, o.id);
  return o.id;
}

export const listOrdersQuery = z.object({
  q: z.string().optional(),
  status: z.string().optional(),
  paymentStatus: z.enum(["BELUM_BAYAR", "SEBAGIAN", "LUNAS"]).optional(),
  scope: z.enum(["all", "active", "mine"]).default("all"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export async function listOrders(actor: Actor, raw: unknown) {
  const q = listOrdersQuery.parse(raw);
  const where: Prisma.OrderWhereInput = {};
  if (!can(actor, "orders.view_all")) {
    if (can(actor, "production.update_any")) {
      /* boleh semua untuk produksi */
    } else if (can(actor, "production.update_assigned")) where.assignedOperatorId = actor.id;
    else throw forbidden();
  }
  if (q.scope === "mine") where.assignedOperatorId = actor.id;
  if (q.scope === "active") where.status = { notIn: ["SELESAI", "DIBATALKAN"] };
  if (q.status && q.status in ORDER_STATUS_LABEL) where.status = q.status as OrderStatusT;
  if (q.paymentStatus) where.paymentStatus = q.paymentStatus;
  if (q.q) {
    const s = q.q.trim();
    where.OR = [
      { number: { contains: s, mode: "insensitive" } },
      { refCode: { equals: s.toUpperCase() } },
      { customer: { name: { contains: s, mode: "insensitive" } } },
      { customer: { phone: { contains: s.replace(/\D/g, "") || s } } },
    ];
  }
  const [rows, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: { customer: true, items: true },
      orderBy: { createdAt: "desc" },
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    }),
    prisma.order.count({ where }),
  ]);
  return { rows, total, page: q.page, pageSize: q.pageSize };
}

// ---------------- Produksi ----------------

export async function assignOperator(actor: Actor, orderId: number, operatorId: number | null, now = new Date()) {
  requirePerm(actor, "production.assign");
  return prisma.$transaction(async (tx) => {
    await lockOrder(tx, orderId);
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
    if (order.status === "SELESAI" || order.status === "DIBATALKAN") throw badRequest("Pesanan sudah final.");
    let opName = "-";
    if (operatorId) {
      await assertOperator(tx, operatorId);
      opName = (await tx.user.findUniqueOrThrow({ where: { id: operatorId } })).name;
    }
    await tx.order.update({ where: { id: orderId }, data: { assignedOperatorId: operatorId } });
    if (operatorId && order.status === "BARU") {
      await tx.order.update({ where: { id: orderId }, data: { status: "MENUNGGU_PROSES" } });
      await tx.orderStatusHistory.create({
        data: { track: "PRODUCTION", orderId, fromStatus: "BARU", toStatus: "MENUNGGU_PROSES", userId: actor.id, userName: actor.name, createdAt: now, note: `Ditugaskan ke ${opName}` },
      });
    }
    await logActivity(tx, actor, "order.assign", "order", String(orderId), { operatorId, operator: opName });
    return tx.order.findUniqueOrThrow({ where: { id: orderId } });
  }, TX_OPTS);
}

/** Satu-satunya jalur perubahan status pengerjaan (selain modul antar). Menolak lompatan status di server. */
export async function transitionOrder(actor: Actor, orderId: number, to: OrderStatusT, note?: string, now = new Date()) {
  if (to === "DIBATALKAN") throw badRequest("Gunakan fitur pembatalan.");
  if (DELIVERY_CONTROLLED.includes(to)) throw badRequest("Status ini diubah otomatis oleh modul pengantaran.");
  return prisma.$transaction(async (tx) => {
    await lockOrder(tx, orderId);
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
    const isAssigned = order.assignedOperatorId === actor.id;
    const handoverStep = order.status === "SIAP_DIAMBIL" && to === "SELESAI";
    const allowed = handoverStep
      ? can(actor, "orders.view_all") || can(actor, "production.update_any")
      : can(actor, "production.update_any") || (can(actor, "production.update_assigned") && isAssigned);
    if (!allowed) throw forbidden(handoverStep ? "Serah terima dilakukan oleh kasir." : "Pesanan ini tidak ditugaskan kepada Anda.");
    if (handoverStep && order.handover === "ANTAR") throw badRequest("Pesanan antar diselesaikan melalui konfirmasi kurir.");
    const flows = order.items.map((i) => i.flow as FlowT);
    if (!canTransition(order.status as OrderStatusT, to, flows, order.handover)) {
      const nx = nextStatus(order.status as OrderStatusT, flows, order.handover);
      throw badRequest(
        `Perubahan status dari "${ORDER_STATUS_LABEL[order.status as OrderStatusT]}" ke "${ORDER_STATUS_LABEL[to]}" tidak sah.` +
          (nx ? ` Status berikutnya: "${ORDER_STATUS_LABEL[nx]}".` : ""),
      );
    }
    await tx.order.update({
      where: { id: orderId },
      data: { status: to, completedAt: to === "SELESAI" ? now : undefined },
    });
    await tx.orderStatusHistory.create({
      data: { track: "PRODUCTION", orderId, fromStatus: order.status, toStatus: to, userId: actor.id, userName: actor.name, note, createdAt: now },
    });
    if (to === "SELESAI") await awardLoyaltyIfEligible(tx, orderId);
    await logActivity(tx, actor, "order.status", "order", String(orderId), { from: order.status, to });
    return tx.order.findUniqueOrThrow({ where: { id: orderId } });
  }, TX_OPTS);
}

export const cancelInput = z.object({
  reason: z.string().trim().min(3, "Alasan pembatalan wajib diisi (min. 3 karakter).").max(300),
  refund: z
    .object({ method: z.enum(["CASH", "QRIS", "TRANSFER"]), amount: z.number().int().positive(), note: z.string().max(300).optional() })
    .optional(),
});

/** Pembatalan menyimpan alasan; riwayat pembayaran tetap utuh. Pengembalian dana opsional, dicatat terpisah. */
export async function cancelOrder(actor: Actor, orderId: number, raw: unknown, now = new Date()) {
  requirePerm(actor, "orders.cancel");
  const input = cancelInput.parse(raw);
  if (input.refund) requirePerm(actor, "refunds.create");
  return prisma.$transaction(async (tx) => {
    await lockOrder(tx, orderId);
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { delivery: true, pickup: true } });
    if (order.status === "SELESAI") throw badRequest("Pesanan yang sudah selesai tidak dapat dibatalkan.");
    if (order.status === "DIBATALKAN") throw badRequest("Pesanan sudah dibatalkan.");
    await tx.order.update({ where: { id: orderId }, data: { status: "DIBATALKAN", cancelReason: input.reason, cancelledAt: now } });
    await tx.orderStatusHistory.create({
      data: { track: "PRODUCTION", orderId, fromStatus: order.status, toStatus: "DIBATALKAN", userId: actor.id, userName: actor.name, note: input.reason, createdAt: now },
    });
    // tolak pembayaran yang masih menunggu verifikasi
    await tx.payment.updateMany({ where: { orderId, status: "PENDING" }, data: { status: "REJECTED", note: "Pesanan dibatalkan" } });
    if (order.delivery && order.delivery.status !== "BERHASIL_DIANTAR" && order.delivery.status !== "DIBATALKAN") {
      await tx.deliveryRequest.update({ where: { id: order.delivery.id }, data: { status: "DIBATALKAN" } });
      await tx.orderStatusHistory.create({
        data: { track: "DELIVERY", orderId, deliveryRequestId: order.delivery.id, fromStatus: order.delivery.status, toStatus: "DIBATALKAN", userId: actor.id, userName: actor.name, createdAt: now },
      });
    }
    await logActivity(tx, actor, "order.cancel", "order", String(orderId), { reason: input.reason });
    if (input.refund) await refundTx(tx, actor, orderId, input.refund, now);
    return tx.order.findUniqueOrThrow({ where: { id: orderId } });
  }, TX_OPTS);
}
