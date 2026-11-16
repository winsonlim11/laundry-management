import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { assignOperator, cancelOrder, createOrder, transitionOrder, getOrderForActor } from "@/server/services/orders";
import { confirmPayment, recordPayment, refund, handleMidtransNotification } from "@/server/services/payments";
import { updateService } from "@/server/services/catalog";
import { advanceDelivery, advancePickup, createDelivery, createPickup, getTask, uploadTaskPhoto } from "@/server/services/logistics";
import { getReport } from "@/server/services/reports";
import { createUser, setRolePermissions, updateUser } from "@/server/services/users";
import { computeBill, parseQuantity, lineTotal } from "@/lib/pricing";
import { orderPath } from "@/lib/status";
import { localDateKey } from "@/lib/time";
import crypto from "node:crypto";
import { newCustomer, resetDb, wib } from "./helpers";

let ctx: Awaited<ReturnType<typeof resetDb>>;
let customerId: number;
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

beforeEach(async () => {
  ctx = await resetDb();
  customerId = (await newCustomer()).id;
});

describe("Aturan harga (unit)", () => {
  it("KG maks 3 desimal, PCS bilangan bulat, pembulatan setengah ke atas", () => {
    expect(parseQuantity("2,5", "KG")).toBe(2500);
    expect(parseQuantity("1.125", "KG")).toBe(1125);
    expect(() => parseQuantity("1.1255", "KG")).toThrow(/3 angka desimal/);
    expect(() => parseQuantity("1.5", "PCS")).toThrow(/bulat/);
    expect(() => parseQuantity("0", "KG")).toThrow();
    expect(() => parseQuantity("-1", "KG")).toThrow();
    expect(lineTotal(7000, 1125)).toBe(7875);
    expect(lineTotal(333, 1500)).toBe(500); // 499,5 → 500
    expect(lineTotal(333, 1499)).toBe(499); // 499,167 → 499
  });
  it("diskon persen dibulatkan, diskon > subtotal & biaya negatif ditolak", () => {
    expect(computeBill({ lines: [{ unitPrice: 8005, quantityMilli: 1000 }], discountType: "PERCENT", discountValue: 10, extraFee: 0, pickupFee: 0, deliveryFee: 0 }).discountAmount).toBe(801);
    expect(() => computeBill({ lines: [{ unitPrice: 5000, quantityMilli: 1000 }], discountType: "NOMINAL", discountValue: 6000, extraFee: 0, pickupFee: 0, deliveryFee: 0 })).toThrow(/melebihi subtotal/);
    expect(() => computeBill({ lines: [{ unitPrice: 5000, quantityMilli: 1000 }], discountType: "NONE", discountValue: 0, extraFee: -1, pickupFee: 0, deliveryFee: 0 })).toThrow(/negatif/);
  });
  it("API menolak diskon melebihi subtotal", async () => {
    await expect(createOrder(ctx.a.kasir, { customerId, items: [{ serviceId: ctx.svc.CK, quantity: "1" }], discountType: "NOMINAL", discountValue: 999999 })).rejects.toThrow(/melebihi subtotal/);
    await expect(createOrder(ctx.a.kasir, { customerId, items: [{ serviceId: ctx.svc.CK, quantity: "1" }], extraFee: -500 })).rejects.toThrow();
  });
});

describe("Pembayaran bersamaan & idempotensi", () => {
  it("dua pembayaran bersamaan terhadap sisa yang sama → hanya satu berhasil", async () => {
    const { order } = await createOrder(ctx.a.kasir, { customerId, items: [{ serviceId: ctx.svc.CS, quantity: "3" }] });
    const results = await Promise.allSettled([
      recordPayment(ctx.a.kasir, order.id, { method: "CASH", amount: order.total, idempotencyKey: "k-aaaaaaaa" }),
      recordPayment(ctx.a.kasir2, order.id, { method: "TRANSFER", amount: order.total, idempotencyKey: "k-bbbbbbbb" }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
    const o = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(o.paidAmount).toBe(o.total);
    expect(await prisma.payment.count({ where: { orderId: order.id } })).toBe(1);
  });

  it("klik ganda (kunci sama, bersamaan) → satu pembayaran", async () => {
    const { order } = await createOrder(ctx.a.kasir, { customerId, items: [{ serviceId: ctx.svc.CS, quantity: "3" }] });
    const rs = await Promise.all([1, 2, 3].map(() => recordPayment(ctx.a.kasir, order.id, { method: "CASH", amount: 5000, idempotencyKey: "same-key-123" })));
    expect(new Set(rs.map((r) => r.payment.id)).size).toBe(1);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).paidAmount).toBe(5000);
  });

  it("menolak nominal melebihi sisa", async () => {
    const { order } = await createOrder(ctx.a.kasir, { customerId, items: [{ serviceId: ctx.svc.CK, quantity: "2" }] });
    await expect(recordPayment(ctx.a.kasir, order.id, { method: "CASH", amount: order.total + 1 })).rejects.toThrow(/melebihi sisa/);
  });

  it("nomor nota unik saat banyak kasir membuat order bersamaan", async () => {
    const rs = await Promise.all(Array.from({ length: 12 }, (_, i) => createOrder(i % 2 ? ctx.a.kasir : ctx.a.kasir2, { customerId, items: [{ serviceId: ctx.svc.CK, quantity: "1" }] })));
    expect(new Set(rs.map((r) => r.order.number)).size).toBe(12);
  });

  it("QRIS manual: menunggu verifikasi, baru dihitung setelah dikonfirmasi petugas", async () => {
    const { order } = await createOrder(ctx.a.kasir, { customerId, items: [{ serviceId: ctx.svc.CK, quantity: "2" }] });
    const { payment } = await recordPayment(ctx.a.kasir, order.id, { method: "QRIS", amount: order.total });
    expect(payment.status).toBe("PENDING");
    expect(payment.qrisCode).toMatch(/^QRIS-/);
    expect(payment.qrisCode).not.toBe(order.refCode);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).paymentStatus).toBe("BELUM_BAYAR");
    // sisa sudah dipesan oleh pembayaran pending
    await expect(recordPayment(ctx.a.kasir, order.id, { method: "CASH", amount: 1000 })).rejects.toThrow();
    await confirmPayment(ctx.a.kasir, payment.id);
    await confirmPayment(ctx.a.kasir, payment.id); // idempoten
    const o = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(o.paymentStatus).toBe("LUNAS");
    expect(o.paidAmount).toBe(o.total);
  });

  it("notifikasi gateway: signature diverifikasi & notifikasi berulang diproses sekali", async () => {
    process.env.MIDTRANS_SERVER_KEY = "SB-test-key";
    const { order } = await createOrder(ctx.a.kasir, { customerId, items: [{ serviceId: ctx.svc.CK, quantity: "2" }] });
    const { payment } = await recordPayment(ctx.a.kasir, order.id, { method: "QRIS", amount: order.total });
    const body = { order_id: payment.qrisCode!, status_code: "200", gross_amount: `${order.total}.00`, transaction_status: "settlement", transaction_id: "trx-1" };
    const sig = crypto.createHash("sha512").update(`${body.order_id}${body.status_code}${body.gross_amount}SB-test-key`).digest("hex");
    await expect(handleMidtransNotification({ ...body, signature_key: "salah" })).rejects.toThrow(/Signature/);
    const r1 = await handleMidtransNotification({ ...body, signature_key: sig });
    const r2 = await handleMidtransNotification({ ...body, signature_key: sig });
    expect(r1.processed).toBe(true);
    expect(r2.processed).toBe(false);
    const o = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(o.paymentStatus).toBe("LUNAS");
    expect(await prisma.payment.count({ where: { orderId: order.id, status: "CONFIRMED" } })).toBe(1);
  });
});

describe("Perubahan tarif setelah nota terbit", () => {
  it("nota lama mempertahankan salinan tarif; nota baru memakai tarif baru", async () => {
    const { order: old } = await createOrder(ctx.a.kasir, { customerId, items: [{ serviceId: ctx.svc.CS, quantity: "2" }] });
    await updateService(ctx.a.admin, ctx.svc.CS, { price: 10000, name: "Cuci Setrika Premium" });
    const oldItems = await prisma.orderItem.findMany({ where: { orderId: old.id } });
    expect(oldItems[0]).toMatchObject({ unitPrice: 8000, lineTotal: 16000, serviceName: "Cuci Setrika" });
    expect((await prisma.order.findUniqueOrThrow({ where: { id: old.id } })).total).toBe(16000);
    const { order: neu } = await createOrder(ctx.a.kasir, { customerId, items: [{ serviceId: ctx.svc.CS, quantity: "2" }] });
    expect(neu.total).toBe(20000);
  });
});

describe("Transisi status pengerjaan", () => {
  it("Setrika Saja + ambil di toko: langsung ke setrika, lompatan tidak sah ditolak", async () => {
    const { order } = await createOrder(ctx.a.kasir, { customerId, items: [{ serviceId: ctx.svc.SS, quantity: "2" }], handover: "AMBIL_SENDIRI" });
    expect(orderPath(["IRON_ONLY"], "AMBIL_SENDIRI")).toEqual(["BARU", "MENUNGGU_PROSES", "DISETRIKA", "DIKEMAS", "SIAP_DIAMBIL", "SELESAI"]);
    await assignOperator(ctx.a.admin, order.id, ctx.a.operator.id);
    await expect(transitionOrder(ctx.a.operator, order.id, "DICUCI")).rejects.toThrow(/tidak sah/);
    await expect(transitionOrder(ctx.a.operator, order.id, "SIAP_DIAMBIL")).rejects.toThrow(/tidak sah/);
    await expect(transitionOrder(ctx.a.operator2, order.id, "DISETRIKA")).rejects.toThrow(/tidak ditugaskan/);
    await transitionOrder(ctx.a.operator, order.id, "DISETRIKA");
    await transitionOrder(ctx.a.operator, order.id, "DIKEMAS");
    await transitionOrder(ctx.a.operator, order.id, "SIAP_DIAMBIL");
    await expect(transitionOrder(ctx.a.operator, order.id, "SELESAI")).rejects.toThrow(/kasir/);
    await transitionOrder(ctx.a.kasir, order.id, "SELESAI");
    const o = await prisma.order.findUniqueOrThrow({ where: { id: order.id }, include: { history: { where: { track: "PRODUCTION" }, orderBy: { id: "asc" } } } });
    expect(o.status).toBe("SELESAI");
    expect(o.completedAt).not.toBeNull();
    expect(o.paymentStatus).toBe("BELUM_BAYAR"); // sisa tagihan tetap terlihat
    expect(o.history.map((h) => h.toStatus)).toEqual(["BARU", "MENUNGGU_PROSES", "DISETRIKA", "DIKEMAS", "SIAP_DIAMBIL", "SELESAI"]);
    expect(o.history.every((h) => h.userName)).toBe(true);
  });

  it("nota campuran Cuci Kering + Setrika Saja melewati semua tahap yang dibutuhkan", () => {
    expect(orderPath(["WASH_DRY", "IRON_ONLY"], "AMBIL_SENDIRI")).toEqual(["BARU", "MENUNGGU_PROSES", "DICUCI", "DIKERINGKAN", "DISETRIKA", "DIKEMAS", "SIAP_DIAMBIL", "SELESAI"]);
    expect(orderPath(["WASH_DRY"], "ANTAR")).toEqual(["BARU", "MENUNGGU_PROSES", "DICUCI", "DIKERINGKAN", "DIKEMAS", "SIAP_DIAMBIL", "DALAM_PENGANTARAN", "SELESAI"]);
  });

  it("operator tidak dapat membuka pesanan yang tidak ditugaskan", async () => {
    const { order } = await createOrder(ctx.a.kasir, { customerId, items: [{ serviceId: ctx.svc.CK, quantity: "2" }] });
    await assignOperator(ctx.a.admin, order.id, ctx.a.operator.id);
    await expect(getOrderForActor(ctx.a.operator2, order.id)).rejects.toThrow(/tidak ditugaskan/);
    const r = await getOrderForActor(ctx.a.operator, order.id);
    expect(r.financial).toBe(false);
  });
});

describe("Poin loyalitas tepat satu kali", () => {
  it("pesanan selesai dulu, lunas belakangan → poin dicatat sekali", async () => {
    const { order } = await createOrder(ctx.a.kasir, { customerId, items: [{ serviceId: ctx.svc.SS, quantity: "5" }] }); // 25.000 → 2 poin
    await assignOperator(ctx.a.admin, order.id, ctx.a.operator.id);
    for (const s of ["DISETRIKA", "DIKEMAS", "SIAP_DIAMBIL"] as const) await transitionOrder(ctx.a.operator, order.id, s);
    await transitionOrder(ctx.a.kasir, order.id, "SELESAI");
    expect((await prisma.customer.findUniqueOrThrow({ where: { id: customerId } })).points).toBe(0);
    await recordPayment(ctx.a.kasir, order.id, { method: "CASH", amount: 10000 });
    await recordPayment(ctx.a.kasir, order.id, { method: "CASH", amount: 15000 });
    expect((await prisma.customer.findUniqueOrThrow({ where: { id: customerId } })).points).toBe(2);
    expect(await prisma.loyaltyLedger.count({ where: { orderId: order.id } })).toBe(1);
  });
});

describe("Pembatalan pesanan ber-DP", () => {
  it("jejak pembayaran tetap; pengembalian dicatat pada tanggal kejadian & dibatasi", async () => {
    const { order } = await createOrder(ctx.a.kasir, { customerId, items: [{ serviceId: ctx.svc.CS, quantity: "3" }], initialPayment: { method: "CASH", amount: 10000 } }, wib("2026-04-01T09:00:00"));
    await expect(cancelOrder(ctx.a.kasir, order.id, { reason: "Batal" })).rejects.toThrow(); // kasir tidak berhak
    await expect(cancelOrder(ctx.a.owner, order.id, { reason: "" })).rejects.toThrow(/Alasan/);
    await cancelOrder(ctx.a.owner, order.id, { reason: "Pelanggan membatalkan" }, wib("2026-04-02T10:00:00"));
    await expect(refund(ctx.a.owner, order.id, { method: "CASH", amount: 10001 }, wib("2026-04-03T11:00:00"))).rejects.toThrow(/dapat dikembalikan/);
    await refund(ctx.a.owner, order.id, { method: "CASH", amount: 6000 }, wib("2026-04-03T11:00:00"));
    await refund(ctx.a.owner, order.id, { method: "CASH", amount: 4000 }, wib("2026-04-03T12:00:00"));
    await expect(refund(ctx.a.owner, order.id, { method: "CASH", amount: 1 })).rejects.toThrow(/Tidak ada dana/);
    await expect(recordPayment(ctx.a.kasir, order.id, { method: "CASH", amount: 1000 })).rejects.toThrow(/dibatalkan/);
    const o = await prisma.order.findUniqueOrThrow({ where: { id: order.id }, include: { payments: { orderBy: { id: "asc" } } } });
    expect(o.status).toBe("DIBATALKAN");
    expect(o.cancelReason).toBe("Pelanggan membatalkan");
    expect(o.payments.map((p) => [p.kind, p.amount])).toEqual([["PAYMENT", 10000], ["REFUND", 6000], ["REFUND", 4000]]);
    const day1 = await getReport(ctx.a.owner, { from: "2026-04-01", to: "2026-04-01" });
    const day2 = await getReport(ctx.a.owner, { from: "2026-04-02", to: "2026-04-02" });
    const day3 = await getReport(ctx.a.owner, { from: "2026-04-03", to: "2026-04-03" });
    expect(day1.totals.receipts).toBe(10000);
    expect(day2.totals.cancelled).toBe(1);
    expect(day3.totals.refunds).toBe(10000);
    expect(day3.totals.receipts).toBe(0);
  });
});

describe("Jemput, antar, dan otorisasi kurir", () => {
  it("jemput sebelum berat diketahui → ditautkan ke nota", async () => {
    const courier = await prisma.courier.findUniqueOrThrow({ where: { userId: ctx.a.kurir.id } });
    const pk = await createPickup(ctx.a.kasir, { name: "Bu Jemput", phone: "081255556666", address: "Jl. Uji 1", scheduledAt: new Date(), courierId: courier.id, fee: 5000, courierPay: 4000 });
    await advancePickup(ctx.a.kurir, pk.id, "KURIR_MENUJU_LOKASI");
    await expect(advancePickup(ctx.a.kurir, pk.id, "SUDAH_DIJEMPUT")).rejects.toThrow(/foto/);
    await uploadTaskPhoto(ctx.a.kurir, "pickup", pk.id, PNG, "image/png");
    await advancePickup(ctx.a.kurir, pk.id, "SUDAH_DIJEMPUT");
    const { order } = await createOrder(ctx.a.kasir, { customerId, items: [{ serviceId: ctx.svc.CK, quantity: "3.2" }], pickupFee: 5000, pickupRequestId: pk.id });
    const p = await prisma.pickupRequest.findUniqueOrThrow({ where: { id: pk.id } });
    expect(p).toMatchObject({ orderId: order.id, status: "DITERIMA_LAUNDRY" });
    expect(order.total).toBe(Math.round(3.2 * 6000) + 5000);
  });

  it("kurir lain ditolak; mulai antar memperbarui pesanan; serah terima menyelesaikan pesanan secara atomik", async () => {
    const c1 = await prisma.courier.findUniqueOrThrow({ where: { userId: ctx.a.kurir.id } });
    const { order } = await createOrder(ctx.a.kasir, { customerId, items: [{ serviceId: ctx.svc.CK, quantity: "2" }], handover: "ANTAR", deliveryFee: 5000, initialPayment: { method: "CASH", amount: 17000 } });
    await assignOperator(ctx.a.admin, order.id, ctx.a.operator.id);
    const d = await createDelivery(ctx.a.kasir, order.id, { name: "Pak Antar", phone: "081200001111", address: "Jl. Antar 2", scheduledAt: new Date(), courierId: c1.id, courierPay: 7000 });
    await expect(advanceDelivery(ctx.a.kurir, d.id, "DALAM_PENGANTARAN")).rejects.toThrow(/belum siap/);
    for (const s of ["DICUCI", "DIKERINGKAN", "DIKEMAS", "SIAP_DIAMBIL"] as const) await transitionOrder(ctx.a.operator, order.id, s);
    await expect(getTask(ctx.a.kurir2, "delivery", d.id)).rejects.toThrow(/bukan milik/);
    await expect(advanceDelivery(ctx.a.kurir2, d.id, "DALAM_PENGANTARAN")).rejects.toThrow(/bukan milik/);
    await expect(uploadTaskPhoto(ctx.a.kurir2, "delivery", d.id, PNG, "image/png")).rejects.toThrow(/bukan milik/);
    await advanceDelivery(ctx.a.kurir, d.id, "DALAM_PENGANTARAN");
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("DALAM_PENGANTARAN");
    await expect(advanceDelivery(ctx.a.kurir, d.id, "BERHASIL_DIANTAR")).rejects.toThrow(/foto/);
    await expect(uploadTaskPhoto(ctx.a.kurir, "delivery", d.id, Buffer.from("<script>alert(1)</script>"), "image/png")).rejects.toThrow(/Format/);
    await uploadTaskPhoto(ctx.a.kurir, "delivery", d.id, PNG, "image/png");
    await advanceDelivery(ctx.a.kurir, d.id, "BERHASIL_DIANTAR");
    const o = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(o.status).toBe("SELESAI");
    expect(o.deliveryFee).toBe(5000); // biaya antar ditagihkan ke pelanggan
    const exp = await prisma.expense.findFirstOrThrow({ where: { deliveryRequestId: d.id } });
    expect(exp.amount).toBe(7000); // ongkos kurir = transaksi terpisah
    const today = localDateKey();
    const rep = await getReport(ctx.a.owner, { from: today, to: today });
    expect(rep.totals.expTransport).toBe(7000);
    expect(rep.totals.receivables).toBe(o.total - o.paidAmount);
  });
});

describe("Hak akses pegawai", () => {
  it("Administrator tidak dapat membuat Owner atau memberi akses finansial", async () => {
    await expect(createUser(ctx.a.admin, { name: "Owner Baru", username: "ownerbaru", password: "rahasia123", roleKey: "OWNER" })).rejects.toThrow(/Owner/);
    await expect(updateUser(ctx.a.admin, ctx.a.owner.id, { name: "Hack" })).rejects.toThrow(/Owner/);
    await expect(setRolePermissions(ctx.a.admin, "KASIR", ["finance.view"])).rejects.toThrow();
    const k = await createUser(ctx.a.admin, { name: "Kasir Baru", username: "kasirbaru", password: "rahasia123", roleKey: "KASIR" });
    expect(k.username).toBe("kasirbaru");
  });
  it("Kasir tidak dapat melihat laporan keuangan; kurir tidak dapat membuat pesanan", async () => {
    await expect(getReport(ctx.a.kasir, { from: "2026-01-01", to: "2026-01-01" })).rejects.toThrow(/akses/);
    await expect(createOrder(ctx.a.kurir, { customerId, items: [{ serviceId: ctx.svc.CK, quantity: "1" }] })).rejects.toThrow(/akses/);
  });
});
