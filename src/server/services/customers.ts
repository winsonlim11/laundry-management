import { z } from "zod";
import { prisma } from "../db";
import type { Actor } from "../actor";
import { can, requirePerm } from "../actor";
import { badRequest, notFound } from "../errors";
import { logActivity } from "./activity";
import type { Prisma } from "@/generated/prisma/client";

/** Normalisasi nomor WhatsApp Indonesia → 62xxxxxxxx */
export function normalizePhone(p: string): string {
  let d = p.replace(/\D/g, "");
  if (d.startsWith("0")) d = "62" + d.slice(1);
  else if (d.startsWith("8")) d = "62" + d;
  return d;
}

export const customerInput = z.object({
  name: z.string().trim().min(2, "Nama minimal 2 karakter.").max(100),
  phone: z.string().trim().min(8, "Nomor WhatsApp tidak valid.").max(20),
  address: z.string().trim().max(500).optional().nullable(),
  mapsUrl: z.string().trim().max(500).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
  membership: z.enum(["REGULER", "SILVER", "GOLD"]).optional(),
});

export async function searchCustomers(actor: Actor, q: string, take = 20) {
  if (!can(actor, "customers.manage") && !can(actor, "orders.view_all") && !can(actor, "logistics.manage")) requirePerm(actor, "customers.manage");
  const s = q.trim();
  const digits = s.replace(/\D/g, "");
  const where: Prisma.CustomerWhereInput = { archivedAt: null };
  if (s) {
    where.OR = [{ name: { contains: s, mode: "insensitive" } }];
    if (digits.length >= 3) where.OR.push({ phone: { contains: normalizePhone(digits).slice(digits.startsWith("0") ? 2 : 0) } }, { phone: { contains: digits } });
  }
  return prisma.customer.findMany({ where, orderBy: [{ updatedAt: "desc" }], take });
}

export async function createCustomer(actor: Actor, raw: unknown) {
  requirePerm(actor, "customers.manage");
  const input = customerInput.parse(raw);
  const phone = normalizePhone(input.phone);
  if (phone.length < 10) throw badRequest("Nomor WhatsApp tidak valid.");
  const c = await prisma.customer.create({ data: { ...input, phone, membership: input.membership ?? "REGULER" } });
  await logActivity(prisma, actor, "customer.create", "customer", String(c.id), { name: c.name });
  return c;
}

export async function updateCustomer(actor: Actor, id: number, raw: unknown) {
  requirePerm(actor, "customers.manage");
  const input = customerInput.partial().parse(raw);
  const data = { ...input, phone: input.phone ? normalizePhone(input.phone) : undefined };
  const c = await prisma.customer.update({ where: { id }, data });
  await logActivity(prisma, actor, "customer.update", "customer", String(id), data as Prisma.InputJsonValue);
  return c;
}

export async function archiveCustomer(actor: Actor, id: number) {
  requirePerm(actor, "customers.manage");
  const c = await prisma.customer.update({ where: { id }, data: { archivedAt: new Date() } });
  await logActivity(prisma, actor, "customer.archive", "customer", String(id));
  return c;
}

export async function getCustomerProfile(actor: Actor, id: number) {
  if (!can(actor, "customers.manage") && !can(actor, "orders.view_all")) requirePerm(actor, "customers.manage");
  const customer = await prisma.customer.findUnique({ where: { id } });
  if (!customer) throw notFound("Pelanggan tidak ditemukan.");
  const [orders, payments, loyalty, stats] = await Promise.all([
    prisma.order.findMany({ where: { customerId: id }, orderBy: { createdAt: "desc" }, take: 100, include: { items: true } }),
    prisma.payment.findMany({ where: { order: { customerId: id } }, orderBy: { createdAt: "desc" }, take: 100, include: { order: { select: { number: true } } } }),
    prisma.loyaltyLedger.findMany({ where: { customerId: id }, orderBy: { createdAt: "desc" }, take: 100, include: { order: { select: { number: true } } } }),
    prisma.order.aggregate({ where: { customerId: id, status: { not: "DIBATALKAN" } }, _count: true, _sum: { total: true, paidAmount: true } }),
  ]);
  return {
    customer, orders, payments, loyalty,
    stats: {
      transactions: stats._count,
      totalSpend: stats._sum.total ?? 0,
      outstanding: (stats._sum.total ?? 0) - (stats._sum.paidAmount ?? 0),
    },
  };
}

export async function adjustPoints(actor: Actor, customerId: number, points: number, note: string) {
  requirePerm(actor, "customers.manage");
  if (!Number.isInteger(points) || points === 0) throw badRequest("Poin penyesuaian harus bilangan bulat bukan nol.");
  return prisma.$transaction(async (tx) => {
    const c = await tx.customer.findUniqueOrThrow({ where: { id: customerId } });
    if (c.points + points < 0) throw badRequest("Saldo poin tidak boleh negatif.");
    await tx.loyaltyLedger.create({ data: { customerId, type: "ADJUST", points, note: note || "Penyesuaian" } });
    await tx.customer.update({ where: { id: customerId }, data: { points: { increment: points } } });
    await logActivity(tx, actor, "loyalty.adjust", "customer", String(customerId), { points, note });
  });
}
