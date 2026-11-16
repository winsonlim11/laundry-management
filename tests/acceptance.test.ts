/**
 * UJI PENERIMAAN WAJIB (lihat brief):
 * 2,5 kg × Rp8.000 + 3 pcs × Rp5.000 → subtotal Rp35.000; diskon 10% + ongkir Rp5.000 → Rp36.500;
 * DP tunai Rp10.000 → sisa Rp26.500; hari berikutnya transfer Rp26.500 → Lunas; laporan & ekspor per hari cocok;
 * permintaan pelunasan diulang → tetap satu pelunasan.
 */
import { beforeAll, describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import zlib from "node:zlib";
import { prisma } from "@/server/db";
import { createOrder } from "@/server/services/orders";
import { recordPayment } from "@/server/services/payments";
import { getReceipt } from "@/server/services/receipt";
import { getCustomerProfile } from "@/server/services/customers";
import { getReport } from "@/server/services/reports";
import { reportToPdf, reportToXlsx } from "@/server/exports";
import { newCustomer, resetDb, wib } from "./helpers";

let ctx: Awaited<ReturnType<typeof resetDb>>;
let orderId: number;
let customerId: number;
const DAY1 = "2026-03-10";
const DAY2 = "2026-03-11";

async function xlsxSummary(buf: Buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ArrayBuffer);
  const ws = wb.getWorksheet("Ringkasan")!;
  const header = ws.getRow(4).values as unknown[];
  const totalRow = ws.getRow(ws.rowCount - 2).values as unknown[];
  const col = (label: string) => Number(totalRow[header.indexOf(label)]);
  return { label: totalRow[1], cash: col("Tunai"), transfer: col("Transfer"), qris: col("QRIS"), receipts: col("Penerimaan") };
}

/** Ambil teks dari PDF pdf-lib (string hex di content stream, bisa terkompresi Flate). */
function pdfText(buf: Buffer): string {
  const raw = buf.toString("latin1");
  const chunks: string[] = [raw];
  const re = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let m;
  while ((m = re.exec(raw))) {
    try { chunks.push(zlib.inflateSync(Buffer.from(m[1], "latin1")).toString("latin1")); } catch { /* bukan flate */ }
  }
  const all = chunks.join("\n");
  const hex = [...all.matchAll(/<([0-9A-Fa-f]+)>\s*Tj/g)].map((x) => Buffer.from(x[1], "hex").toString("latin1"));
  const lit = [...all.matchAll(/\(([^)]*)\)\s*Tj/g)].map((x) => x[1]);
  return [...hex, ...lit].join(" | ");
}

describe("Uji penerimaan wajib", () => {
  beforeAll(async () => {
    ctx = await resetDb();
    customerId = (await newCustomer("Ibu Uji", "081299990000")).id;
  });

  it("hari 1: nota multi-item, diskon 10%, ongkir, DP tunai", async () => {
    const { order } = await createOrder(ctx.a.kasir, {
      customerId,
      items: [
        { serviceId: ctx.svc.CS, quantity: "2,5" }, // Cuci Setrika Rp8.000/kg
        { serviceId: ctx.svc.JS, quantity: "3" }, // satuan Rp5.000/pcs
      ],
      discountType: "PERCENT",
      discountValue: 10,
      deliveryFee: 5000,
      handover: "ANTAR",
      initialPayment: { method: "CASH", amount: 10000 },
      idempotencyKey: "acc-order-0001",
    }, wib(`${DAY1}T10:00:00`));
    orderId = order.id;
    expect(order.subtotal).toBe(35000);
    expect(order.discountAmount).toBe(3500);
    expect(order.total).toBe(36500);
    expect(order.paidAmount).toBe(10000);
    expect(order.paymentStatus).toBe("SEBAGIAN");
  });

  it("struk dan profil pelanggan menunjukkan sisa Rp26.500", async () => {
    const r = await getReceipt(ctx.a.kasir, orderId, "https://laundry.test");
    expect(r.remaining).toBe(26500);
    expect(r.qrSvg).toContain("<svg");
    expect(r.barcodeSvg).toContain("<svg");
    expect(r.url).toBe(`https://laundry.test/o/${r.order.refCode}`);
    const p = await getCustomerProfile(ctx.a.kasir, customerId);
    expect(p.stats.outstanding).toBe(26500);
    expect(p.orders[0].total - p.orders[0].paidAmount).toBe(26500);
  });

  it("hari 2: pelunasan transfer → Lunas, saldo nol; retry dengan kunci sama tidak menggandakan", async () => {
    const first = await recordPayment(ctx.a.kasir, orderId, { method: "TRANSFER", amount: 26500, idempotencyKey: "acc-lunas-0001" }, wib(`${DAY2}T14:00:00`));
    expect(first.duplicate).toBe(false);
    const again = await recordPayment(ctx.a.kasir, orderId, { method: "TRANSFER", amount: 26500, idempotencyKey: "acc-lunas-0001" }, wib(`${DAY2}T14:00:05`));
    expect(again.duplicate).toBe(true);
    expect(again.payment.id).toBe(first.payment.id);
    const o = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(o.paymentStatus).toBe("LUNAS");
    expect(o.total - o.paidAmount).toBe(0);
    const transfers = await prisma.payment.count({ where: { orderId, method: "TRANSFER", kind: "PAYMENT" } });
    expect(transfers).toBe(1);
    // tanpa kunci pun, pembayaran ketiga ditolak karena melebihi sisa
    await expect(recordPayment(ctx.a.kasir, orderId, { method: "TRANSFER", amount: 26500 })).rejects.toThrow(/lunas/i);
  });

  it("laporan penerimaan: hari 1 Rp10.000 tunai, hari 2 Rp26.500 transfer", async () => {
    const d1 = await getReport(ctx.a.owner, { from: DAY1, to: DAY1 });
    expect(d1.totals).toMatchObject({ cash: 10000, transfer: 0, qris: 0, receipts: 10000, orders: 1, orderValue: 36500 });
    const d2 = await getReport(ctx.a.owner, { from: DAY2, to: DAY2 });
    expect(d2.totals).toMatchObject({ cash: 0, transfer: 26500, receipts: 26500, orders: 0 });
    const both = await getReport(ctx.a.owner, { from: DAY1, to: DAY2 });
    expect(both.rows.map((r) => [r.period, r.cash, r.transfer])).toEqual([[DAY1, 10000, 0], [DAY2, 0, 26500]]);
  });

  it("ekspor XLSX & PDF tiap hari cocok dengan layar", async () => {
    for (const [day, cash, transfer] of [[DAY1, 10000, 0], [DAY2, 0, 26500]] as const) {
      const rep = await getReport(ctx.a.owner, { from: day, to: day });
      const x = await xlsxSummary(await reportToXlsx(rep, "Laundry"));
      expect(x).toMatchObject({ label: "TOTAL", cash, transfer, receipts: cash + transfer });
      const text = pdfText(await reportToPdf(rep, "Laundry"));
      expect(text).toContain(`Periode ${day} s/d ${day}`);
      expect(text).toContain(cash ? "Rp10.000" : "Rp26.500");
    }
  });

  it("laporan rentang kosong tetap mengembalikan angka nol dari database", async () => {
    const r = await getReport(ctx.a.owner, { from: "2020-01-01", to: "2020-01-03" });
    expect(r.rows).toHaveLength(3);
    expect(r.totals.receipts).toBe(0);
    expect(r.totals.orders).toBe(0);
  });
});
