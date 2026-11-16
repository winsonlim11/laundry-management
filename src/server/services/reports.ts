/**
 * LAPORAN — satu fungsi dipakai halaman laporan, dashboard, dan ekspor XLSX/PDF
 * sehingga angka di layar dan file selalu sama.
 * Penerimaan dihitung dari waktu pembayaran TERKONFIRMASI (confirmedAt) pada zona waktu bisnis.
 */
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "../db";
import type { Actor } from "../actor";
import { requirePerm } from "../actor";
import { addDaysKey, BUSINESS_TZ, localDateKey, localRange } from "@/lib/time";

export const reportQuery = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  groupBy: z.enum(["day", "week", "month"]).default("day"),
  serviceId: z.coerce.number().int().positive().optional(),
  paymentStatus: z.enum(["BELUM_BAYAR", "SEBAGIAN", "LUNAS"]).optional(),
});
export type ReportQuery = z.infer<typeof reportQuery>;

const n = (v: unknown) => Number(v ?? 0);

export async function getReport(actor: Actor, raw: unknown) {
  requirePerm(actor, "reports.view");
  const q = reportQuery.parse(raw);
  if (q.from > q.to) throw new Error("Tanggal awal setelah tanggal akhir.");
  return buildReport(q);
}

export async function buildReport(q: ReportQuery) {
  const range = localRange(q.from, q.to);
  const tz = BUSINESS_TZ;
  const trunc = q.groupBy === "day" ? "day" : q.groupBy === "week" ? "week" : "month";
  const orderFilter = Prisma.sql`
    ${q.serviceId ? Prisma.sql`AND EXISTS (SELECT 1 FROM "order_items" oi WHERE oi."orderId" = o."id" AND oi."serviceId" = ${q.serviceId})` : Prisma.empty}
    ${q.paymentStatus ? Prisma.sql`AND o."paymentStatus" = ${q.paymentStatus}::"PaymentStatus"` : Prisma.empty}`;
  const local = (col: Prisma.Sql) => Prisma.sql`((${col} AT TIME ZONE 'UTC') AT TIME ZONE ${tz})`;
  const bucket = (col: Prisma.Sql) => Prisma.sql`to_char(date_trunc(${trunc}, ${local(col)}), 'YYYY-MM-DD')`;

  const [receiptsRows, refundRows, orderRows, doneRows, cancelRows, expenseRows, outstandingRows, staffRows, staffPayRows, staffOrderRows] = await Promise.all([
    prisma.$queryRaw<{ b: string; method: string; amount: bigint; cnt: bigint }[]>`
      SELECT ${bucket(Prisma.sql`p."confirmedAt"`)} AS b, p."method"::text AS method, SUM(p."amount") AS amount, COUNT(*) AS cnt
      FROM "payments" p JOIN "orders" o ON o."id" = p."orderId"
      WHERE p."kind" = 'PAYMENT' AND p."status" = 'CONFIRMED' AND p."confirmedAt" >= ${range.gte} AND p."confirmedAt" < ${range.lt} ${orderFilter}
      GROUP BY 1, 2`,
    prisma.$queryRaw<{ b: string; method: string; amount: bigint; cnt: bigint }[]>`
      SELECT ${bucket(Prisma.sql`p."confirmedAt"`)} AS b, p."method"::text AS method, SUM(p."amount") AS amount, COUNT(*) AS cnt
      FROM "payments" p JOIN "orders" o ON o."id" = p."orderId"
      WHERE p."kind" = 'REFUND' AND p."status" = 'CONFIRMED' AND p."confirmedAt" >= ${range.gte} AND p."confirmedAt" < ${range.lt} ${orderFilter}
      GROUP BY 1, 2`,
    prisma.$queryRaw<{ b: string; cnt: bigint; value: bigint }[]>`
      SELECT ${bucket(Prisma.sql`o."createdAt"`)} AS b, COUNT(*) AS cnt, SUM(o."total") AS value
      FROM "orders" o WHERE o."createdAt" >= ${range.gte} AND o."createdAt" < ${range.lt} AND o."status" <> 'DIBATALKAN' ${orderFilter}
      GROUP BY 1`,
    prisma.$queryRaw<{ b: string; cnt: bigint }[]>`
      SELECT ${bucket(Prisma.sql`o."completedAt"`)} AS b, COUNT(*) AS cnt FROM "orders" o
      WHERE o."status" = 'SELESAI' AND o."completedAt" >= ${range.gte} AND o."completedAt" < ${range.lt} ${orderFilter} GROUP BY 1`,
    prisma.$queryRaw<{ b: string; cnt: bigint }[]>`
      SELECT ${bucket(Prisma.sql`o."cancelledAt"`)} AS b, COUNT(*) AS cnt FROM "orders" o
      WHERE o."status" = 'DIBATALKAN' AND o."cancelledAt" >= ${range.gte} AND o."cancelledAt" < ${range.lt} ${orderFilter} GROUP BY 1`,
    prisma.$queryRaw<{ b: string; category: string; amount: bigint }[]>`
      SELECT to_char(date_trunc(${trunc}, e."date"::timestamp), 'YYYY-MM-DD') AS b, e."category", SUM(e."amount") AS amount
      FROM "expenses" e WHERE e."date" >= ${q.from}::date AND e."date" <= ${q.to}::date GROUP BY 1, 2`,
    prisma.$queryRaw<{ customerId: number; name: string; phone: string; orders: bigint; outstanding: bigint }[]>`
      SELECT c."id" AS "customerId", c."name", c."phone", COUNT(*) AS orders, SUM(o."total" - o."paidAmount") AS outstanding
      FROM "orders" o JOIN "customers" c ON c."id" = o."customerId"
      WHERE o."status" <> 'DIBATALKAN' AND o."total" > o."paidAmount" AND o."createdAt" < ${range.lt} ${orderFilter}
      GROUP BY c."id" ORDER BY outstanding DESC LIMIT 200`,
    prisma.$queryRaw<{ userId: number; userName: string; track: string; cnt: bigint }[]>`
      SELECT h."userId", MAX(h."userName") AS "userName", h."track"::text AS track, COUNT(*) AS cnt
      FROM "order_status_history" h WHERE h."userId" IS NOT NULL AND h."createdAt" >= ${range.gte} AND h."createdAt" < ${range.lt}
      GROUP BY h."userId", h."track"`,
    prisma.$queryRaw<{ userId: number; amount: bigint; cnt: bigint }[]>`
      SELECT p."confirmedById" AS "userId", SUM(p."amount") AS amount, COUNT(*) AS cnt FROM "payments" p
      WHERE p."kind" = 'PAYMENT' AND p."status" = 'CONFIRMED' AND p."confirmedById" IS NOT NULL AND p."confirmedAt" >= ${range.gte} AND p."confirmedAt" < ${range.lt}
      GROUP BY 1`,
    prisma.$queryRaw<{ userId: number; cnt: bigint }[]>`
      SELECT o."createdById" AS "userId", COUNT(*) AS cnt FROM "orders" o
      WHERE o."createdAt" >= ${range.gte} AND o."createdAt" < ${range.lt} GROUP BY 1`,
  ]);

  // susun baris per periode (termasuk periode bernilai nol)
  const buckets: string[] = [];
  {
    let k = q.from;
    const seen = new Set<string>();
    while (k <= q.to) {
      const b = bucketKey(k, q.groupBy);
      if (!seen.has(b)) { seen.add(b); buckets.push(b); }
      k = addDaysKey(k, 1);
    }
  }
  type Row = { period: string; orders: number; orderValue: number; cash: number; qris: number; transfer: number; receipts: number; refunds: number; transactions: number; completed: number; cancelled: number; expOperational: number; expTransport: number; expenses: number; net: number };
  const rows = new Map<string, Row>(buckets.map((b) => [b, { period: b, orders: 0, orderValue: 0, cash: 0, qris: 0, transfer: 0, receipts: 0, refunds: 0, transactions: 0, completed: 0, cancelled: 0, expOperational: 0, expTransport: 0, expenses: 0, net: 0 }]));
  const get = (b: string) => rows.get(b) ?? rows.get(buckets[0])!;
  for (const r of receiptsRows) {
    const row = get(r.b);
    const amt = n(r.amount);
    if (r.method === "CASH") row.cash += amt; else if (r.method === "QRIS") row.qris += amt; else row.transfer += amt;
    row.receipts += amt;
    row.transactions += n(r.cnt);
  }
  for (const r of refundRows) get(r.b).refunds += n(r.amount);
  for (const r of orderRows) { const row = get(r.b); row.orders += n(r.cnt); row.orderValue += n(r.value); }
  for (const r of doneRows) get(r.b).completed += n(r.cnt);
  for (const r of cancelRows) get(r.b).cancelled += n(r.cnt);
  const expByCat = new Map<string, number>();
  for (const r of expenseRows) {
    const row = get(r.b);
    const amt = n(r.amount);
    if (r.category.startsWith("Transportasi")) row.expTransport += amt; else row.expOperational += amt;
    row.expenses += amt;
    expByCat.set(r.category, (expByCat.get(r.category) ?? 0) + amt);
  }
  for (const row of rows.values()) row.net = row.receipts - row.refunds - row.expenses;
  const list = [...rows.values()];
  const sum = (k: keyof Row) => list.reduce((a, r) => a + (r[k] as number), 0);
  const totals = {
    orders: sum("orders"), orderValue: sum("orderValue"), cash: sum("cash"), qris: sum("qris"), transfer: sum("transfer"),
    receipts: sum("receipts"), refunds: sum("refunds"), transactions: sum("transactions"), completed: sum("completed"),
    cancelled: sum("cancelled"), expOperational: sum("expOperational"), expTransport: sum("expTransport"), expenses: sum("expenses"), net: sum("net"),
    receivables: outstandingRows.reduce((a, r) => a + n(r.outstanding), 0),
  };

  // kinerja pegawai
  const staff = new Map<number, { userId: number; name: string; ordersCreated: number; production: number; logistics: number; paymentsCount: number; paymentsAmount: number }>();
  const users = await prisma.user.findMany({ select: { id: true, name: true } });
  const nameOf = new Map(users.map((u) => [u.id, u.name]));
  const s = (id: number) => {
    if (!staff.has(id)) staff.set(id, { userId: id, name: nameOf.get(id) ?? `#${id}`, ordersCreated: 0, production: 0, logistics: 0, paymentsCount: 0, paymentsAmount: 0 });
    return staff.get(id)!;
  };
  for (const r of staffRows) {
    if (r.track === "PRODUCTION") s(r.userId).production += n(r.cnt);
    if (r.track === "PICKUP" || r.track === "DELIVERY") s(r.userId).logistics += n(r.cnt);
  }
  for (const r of staffPayRows) { s(r.userId).paymentsCount += n(r.cnt); s(r.userId).paymentsAmount += n(r.amount); }
  for (const r of staffOrderRows) s(r.userId).ordersCreated += n(r.cnt);

  return {
    query: q,
    rows: list,
    totals,
    expensesByCategory: [...expByCat.entries()].map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount),
    receivables: outstandingRows.map((r) => ({ customerId: r.customerId, name: r.name, phone: r.phone, orders: n(r.orders), outstanding: n(r.outstanding) })),
    staff: [...staff.values()].sort((a, b) => b.ordersCreated + b.production - (a.ordersCreated + a.production)),
  };
}

export type Report = Awaited<ReturnType<typeof buildReport>>;

function bucketKey(dayKey: string, g: "day" | "week" | "month") {
  if (g === "day") return dayKey;
  if (g === "month") return dayKey.slice(0, 8) + "01";
  // ISO week start (Senin) — sama dengan date_trunc('week') PostgreSQL
  const [y, m, d] = dayKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dow = (dt.getUTCDay() + 6) % 7;
  return addDaysKey(dayKey, -dow);
}

// ---------------- Dashboard ----------------

export async function getDashboard(actor: Actor, now = new Date()) {
  requirePerm(actor, "dashboard.view");
  const today = localDateKey(now);
  const monthStart = today.slice(0, 8) + "01";
  const todayRange = localRange(today, today);
  const finance = actor.permissions.has("finance.view");
  const [createdToday, byStatus, recentOrders, recentActivity] = await Promise.all([
    prisma.order.count({ where: { createdAt: { gte: todayRange.gte, lt: todayRange.lt } } }),
    prisma.order.groupBy({ by: ["status"], _count: true }),
    prisma.order.findMany({ orderBy: { createdAt: "desc" }, take: 8, include: { customer: true } }),
    prisma.orderStatusHistory.findMany({ orderBy: { createdAt: "desc" }, take: 10, include: { order: { select: { id: true, number: true } }, pickupRequest: { select: { number: true } }, deliveryRequest: { select: { number: true } } } }),
  ]);
  const count = (keys: string[]) => byStatus.filter((r) => keys.includes(r.status)).reduce((a, r) => a + r._count, 0);
  const completedToday = await prisma.order.count({ where: { status: "SELESAI", completedAt: { gte: todayRange.gte, lt: todayRange.lt } } });
  let financeData = null;
  if (finance) {
    const chartFrom = addDaysKey(today, -13);
    const [day, month, chart] = await Promise.all([
      buildReport({ from: today, to: today, groupBy: "day" }),
      buildReport({ from: monthStart, to: today, groupBy: "month" }),
      buildReport({ from: chartFrom, to: today, groupBy: "day" }),
    ]);
    financeData = {
      todayReceipts: day.totals.receipts,
      monthReceipts: month.totals.receipts,
      receivables: day.totals.receivables,
      chart: chart.rows.map((r) => ({ date: r.period, Penerimaan: r.receipts, Pesanan: r.orders, Selesai: r.completed })),
    };
  } else {
    const chartFrom = addDaysKey(today, -13);
    const chart = await buildReport({ from: chartFrom, to: today, groupBy: "day" });
    financeData = { todayReceipts: null, monthReceipts: null, receivables: null, chart: chart.rows.map((r) => ({ date: r.period, Penerimaan: 0, Pesanan: r.orders, Selesai: r.completed })) };
  }
  return {
    today, monthStart, finance,
    createdToday,
    completedToday,
    queue: {
      baru: count(["BARU"]),
      diproses: count(["MENUNGGU_PROSES", "DICUCI", "DIKERINGKAN", "DISETRIKA", "DIKEMAS"]),
      siap: count(["SIAP_DIAMBIL", "DALAM_PENGANTARAN"]),
    },
    ...financeData,
    recentOrders,
    recentActivity,
  };
}
