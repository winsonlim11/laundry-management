import { z } from "zod";
import { prisma } from "../db";
import type { Actor } from "../actor";
import { requirePerm } from "../actor";
import { logActivity } from "./activity";
import { localRange } from "@/lib/time";

export const EXPENSE_CATEGORIES = ["Operasional", "Deterjen & Bahan", "Listrik & Air", "Gaji", "Sewa", "Perawatan Mesin", "Transportasi", "Transportasi - Ongkos Kurir", "Lain-lain"];

export const expenseInput = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal tidak valid."),
  category: z.string().trim().min(2).max(60),
  amount: z.number().int("Nominal harus rupiah bulat.").positive("Nominal harus lebih dari 0."),
  description: z.string().trim().max(300).optional(),
});

export async function createExpense(actor: Actor, raw: unknown) {
  requirePerm(actor, "expenses.manage");
  const input = expenseInput.parse(raw);
  const e = await prisma.expense.create({ data: { ...input, date: new Date(input.date + "T00:00:00Z"), createdById: actor.id } });
  await logActivity(prisma, actor, "expense.create", "expense", String(e.id), input);
  return e;
}

export async function deleteExpense(actor: Actor, id: number) {
  requirePerm(actor, "expenses.manage");
  const e = await prisma.expense.delete({ where: { id } });
  await logActivity(prisma, actor, "expense.delete", "expense", String(id), { amount: e.amount, category: e.category });
}

export async function listExpenses(actor: Actor, from: string, to: string) {
  requirePerm(actor, "expenses.manage", "reports.view");
  void localRange;
  return prisma.expense.findMany({
    where: { date: { gte: new Date(from + "T00:00:00Z"), lte: new Date(to + "T00:00:00Z") } },
    orderBy: [{ date: "desc" }, { id: "desc" }],
  });
}
