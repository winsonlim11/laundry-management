/**
 * ATURAN PEMBAYARAN — dijalankan hanya di server.
 * - Setiap penulisan berjalan dalam transaksi DB dengan baris pesanan dikunci (SELECT … FOR UPDATE),
 *   sehingga dua kasir/retry tidak bisa membuat saldo melebihi tagihan.
 * - Kunci idempotensi (unique) membuat klik ganda / retry mengembalikan pembayaran yang sama.
 * - Status bayar diturunkan dari total pembayaran TERKONFIRMASI.
 * - Pembayaran PENDING (QRIS manual / gateway) ikut "memesan" sisa tagihan agar tidak terjadi kelebihan bayar.
 */
import crypto from "node:crypto";
import { z } from "zod";
import { prisma, type Tx } from "../db";
import type { Actor } from "../actor";
import { requirePerm } from "../actor";
import { badRequest, conflict, notFound } from "../errors";
import { derivePaymentStatus } from "@/lib/pricing";
import { isUniqueViolation, lockOrder, TX_OPTS } from "./common";
import { awardLoyaltyIfEligible } from "./loyalty";
import { logActivity } from "./activity";
import { rupiah } from "@/lib/money";

export const paymentInput = z.object({
  method: z.enum(["CASH", "QRIS", "TRANSFER"], { message: "Metode bayar tidak valid." }),
  amount: z.number({ message: "Nominal wajib diisi." }).int("Nominal harus rupiah bulat.").positive("Nominal harus lebih dari 0."),
  idempotencyKey: z.string().min(8).max(100).optional(),
  note: z.string().max(300).optional(),
});
export type PaymentInput = z.infer<typeof paymentInput>;

async function recomputeOrderPayment(tx: Tx, orderId: number, actor: Actor | null, now: Date) {
  const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
  const agg = await tx.payment.aggregate({
    where: { orderId, kind: "PAYMENT", status: "CONFIRMED" },
    _sum: { amount: true },
  });
  const paid = agg._sum.amount ?? 0;
  const status = derivePaymentStatus(order.total, paid);
  await tx.order.update({ where: { id: orderId }, data: { paidAmount: paid, paymentStatus: status } });
  if (status !== order.paymentStatus) {
    await tx.orderStatusHistory.create({
      data: {
        track: "PAYMENT", orderId, fromStatus: order.paymentStatus, toStatus: status,
        userId: actor?.id ?? null, userName: actor?.name ?? "Payment gateway", createdAt: now,
        note: `Terbayar ${rupiah(paid)} dari ${rupiah(order.total)}`,
      },
    });
  }
  if (status === "LUNAS") await awardLoyaltyIfEligible(tx, orderId);
}

/** Inti pencatatan pembayaran; harus dipanggil di dalam transaksi. */
export async function recordPaymentTx(tx: Tx, actor: Actor, orderId: number, input: PaymentInput, now = new Date()) {
  if (input.idempotencyKey) {
    const existing = await tx.payment.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (existing) {
      if (existing.orderId !== orderId) throw conflict("Kunci idempotensi sudah dipakai untuk nota lain.");
      return { payment: existing, duplicate: true };
    }
  }
  await lockOrder(tx, orderId);
  if (input.idempotencyKey) {
    // periksa ulang setelah kunci: permintaan kembar yang menunggu kunci akan melihat hasil pemenangnya
    const existing = await tx.payment.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (existing) return { payment: existing, duplicate: true };
  }
  const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
  if (order.status === "DIBATALKAN") throw badRequest("Pesanan sudah dibatalkan; tidak dapat menerima pembayaran.");
  const pending = await tx.payment.aggregate({ where: { orderId, kind: "PAYMENT", status: "PENDING" }, _sum: { amount: true } });
  const remaining = order.total - order.paidAmount - (pending._sum.amount ?? 0);
  if (remaining <= 0) throw badRequest("Nota ini sudah lunas atau sisa tagihan sedang menunggu verifikasi.");
  if (input.amount > remaining) throw badRequest(`Nominal melebihi sisa tagihan (${rupiah(remaining)}).`);

  const isQris = input.method === "QRIS";
  const payment = await tx.payment.create({
    data: {
      orderId, kind: "PAYMENT", method: input.method, amount: input.amount,
      status: isQris ? "PENDING" : "CONFIRMED",
      idempotencyKey: input.idempotencyKey ?? null,
      qrisCode: isQris ? `QRIS-${crypto.randomBytes(6).toString("hex").toUpperCase()}` : null,
      note: input.note, createdById: actor.id,
      confirmedById: isQris ? null : actor.id,
      confirmedAt: isQris ? null : now,
      createdAt: now,
    },
  });
  if (!isQris) await recomputeOrderPayment(tx, orderId, actor, now);
  await logActivity(tx, actor, "payment.create", "order", String(orderId), {
    paymentId: payment.id, method: input.method, amount: input.amount, status: payment.status,
  });
  return { payment, duplicate: false };
}

export async function recordPayment(actor: Actor, orderId: number, raw: unknown, now = new Date()) {
  requirePerm(actor, "payments.create");
  const input = paymentInput.parse(raw);
  try {
    return await prisma.$transaction((tx) => recordPaymentTx(tx, actor, orderId, input, now), TX_OPTS);
  } catch (e) {
    // dua permintaan identik yang benar-benar bersamaan: yang kalah melihat unique violation → kembalikan yang menang
    if (input.idempotencyKey && isUniqueViolation(e)) {
      const existing = await prisma.payment.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
      if (existing && existing.orderId === orderId) return { payment: existing, duplicate: true };
    }
    throw e;
  }
}

async function confirmPendingTx(tx: Tx, paymentId: number, actor: Actor | null, now: Date, gatewayRef?: string) {
  const p = await tx.payment.findUnique({ where: { id: paymentId } });
  if (!p) throw notFound("Pembayaran tidak ditemukan.");
  await lockOrder(tx, p.orderId);
  const fresh = await tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
  if (fresh.status === "CONFIRMED") return fresh; // idempoten
  if (fresh.status !== "PENDING") throw badRequest("Pembayaran ini sudah ditolak.");
  const order = await tx.order.findUniqueOrThrow({ where: { id: p.orderId } });
  if (order.paidAmount + fresh.amount > order.total) throw badRequest("Konfirmasi akan melebihi tagihan.");
  const updated = await tx.payment.update({
    where: { id: paymentId },
    data: { status: "CONFIRMED", confirmedAt: now, confirmedById: actor?.id ?? null, gatewayRef: gatewayRef ?? fresh.gatewayRef },
  });
  await recomputeOrderPayment(tx, p.orderId, actor, now);
  await logActivity(tx, actor, "payment.confirm", "order", String(p.orderId), { paymentId, amount: fresh.amount });
  return updated;
}

export async function confirmPayment(actor: Actor, paymentId: number, now = new Date()) {
  requirePerm(actor, "payments.confirm");
  return prisma.$transaction((tx) => confirmPendingTx(tx, paymentId, actor, now), TX_OPTS);
}

export async function rejectPayment(actor: Actor, paymentId: number, reason?: string) {
  requirePerm(actor, "payments.confirm");
  return prisma.$transaction(async (tx) => {
    const p = await tx.payment.findUnique({ where: { id: paymentId } });
    if (!p) throw notFound("Pembayaran tidak ditemukan.");
    await lockOrder(tx, p.orderId);
    const fresh = await tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
    if (fresh.status !== "PENDING") throw badRequest("Hanya pembayaran menunggu verifikasi yang dapat ditolak.");
    const u = await tx.payment.update({ where: { id: paymentId }, data: { status: "REJECTED", note: reason ?? fresh.note } });
    await logActivity(tx, actor, "payment.reject", "order", String(p.orderId), { paymentId, reason: reason ?? null });
    return u;
  }, TX_OPTS);
}

export const refundInput = z.object({
  method: z.enum(["CASH", "QRIS", "TRANSFER"]),
  amount: z.number().int("Nominal harus rupiah bulat.").positive("Nominal harus lebih dari 0."),
  note: z.string().max(300).optional(),
  idempotencyKey: z.string().min(8).max(100).optional(),
});

/** Pengembalian dana: dicatat sebagai transaksi terpisah pada tanggal kejadian, maks. dana yang masih dapat dikembalikan. */
export async function refundTx(tx: Tx, actor: Actor, orderId: number, raw: unknown, now = new Date()) {
  const input = refundInput.parse(raw);
  if (input.idempotencyKey) {
    const ex = await tx.payment.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (ex) return ex;
  }
  await lockOrder(tx, orderId);
  const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
  if (order.status !== "DIBATALKAN") throw badRequest("Pengembalian dana hanya untuk pesanan yang dibatalkan.");
  const refundable = order.paidAmount - order.refundedAmount;
  if (refundable <= 0) throw badRequest("Tidak ada dana yang dapat dikembalikan.");
  if (input.amount > refundable) throw badRequest(`Nominal melebihi dana yang dapat dikembalikan (${rupiah(refundable)}).`);
  const refund = await tx.payment.create({
    data: {
      orderId, kind: "REFUND", method: input.method, amount: input.amount, status: "CONFIRMED",
      idempotencyKey: input.idempotencyKey ?? null, note: input.note, createdById: actor.id,
      confirmedById: actor.id, confirmedAt: now, createdAt: now,
    },
  });
  await tx.order.update({ where: { id: orderId }, data: { refundedAmount: { increment: input.amount } } });
  await tx.orderStatusHistory.create({
    data: { track: "PAYMENT", orderId, fromStatus: order.paymentStatus, toStatus: order.paymentStatus, userId: actor.id, userName: actor.name, note: `Pengembalian dana ${rupiah(input.amount)}`, createdAt: now },
  });
  await logActivity(tx, actor, "payment.refund", "order", String(orderId), { amount: input.amount, method: input.method });
  return refund;
}

export async function refund(actor: Actor, orderId: number, raw: unknown, now = new Date()) {
  requirePerm(actor, "refunds.create");
  return prisma.$transaction((tx) => refundTx(tx, actor, orderId, raw, now), TX_OPTS);
}

// ---------------- Payment gateway (Midtrans QRIS) ----------------

export function gatewayStatus() {
  const provider = process.env.QRIS_GATEWAY?.trim();
  const configured = provider === "midtrans" && !!process.env.MIDTRANS_SERVER_KEY;
  return { provider: provider || null, configured };
}

export function verifyMidtransSignature(body: Record<string, unknown>, serverKey: string): boolean {
  const { order_id, status_code, gross_amount, signature_key } = body as Record<string, string>;
  if (!order_id || !status_code || !gross_amount || !signature_key) return false;
  const expected = crypto.createHash("sha512").update(`${order_id}${status_code}${gross_amount}${serverKey}`).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(String(signature_key));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * Proses notifikasi Midtrans. Notifikasi berulang (transaction_id + status sama) diproses satu kali
 * berkat unique constraint di gateway_notifications.
 */
export async function handleMidtransNotification(body: Record<string, unknown>, now = new Date()) {
  const serverKey = process.env.MIDTRANS_SERVER_KEY;
  if (!serverKey) throw badRequest("Gateway belum dikonfigurasi.");
  if (!verifyMidtransSignature(body, serverKey)) throw badRequest("Signature tidak valid.");
  const qrisCode = String(body.order_id);
  const txStatus = String(body.transaction_status ?? "");
  const externalId = String(body.transaction_id ?? qrisCode);
  return prisma.$transaction(async (tx) => {
    const ins = await tx.$queryRaw<{ id: number }[]>`
      INSERT INTO "gateway_notifications"("provider", "externalId", "status", "payload")
      VALUES ('midtrans', ${externalId}, ${txStatus}, ${JSON.stringify(body)}::jsonb)
      ON CONFLICT ("provider", "externalId", "status") DO NOTHING RETURNING "id"`;
    if (ins.length === 0) return { processed: false, reason: "duplikat" };
    const payment = await tx.payment.findUnique({ where: { qrisCode } });
    if (!payment) return { processed: false, reason: "pembayaran tidak dikenal" };
    if (Number(body.gross_amount) !== payment.amount) throw badRequest("Nominal notifikasi tidak cocok.");
    if (txStatus === "settlement" || txStatus === "capture") {
      await confirmPendingTx(tx, payment.id, null, now, externalId);
      return { processed: true, status: "CONFIRMED" };
    }
    if (["expire", "cancel", "deny", "failure"].includes(txStatus) && payment.status === "PENDING") {
      await tx.payment.update({ where: { id: payment.id }, data: { status: "REJECTED", note: `Gateway: ${txStatus}` } });
      await logActivity(tx, null, "payment.gateway", "order", String(payment.orderId), { txStatus });
      return { processed: true, status: "REJECTED" };
    }
    return { processed: true, status: payment.status };
  }, TX_OPTS);
}
