import { Prisma } from "@/generated/prisma/client";
import type { Tx } from "../db";
import { notFound } from "../errors";

export function isUniqueViolation(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

/** Kunci baris pesanan (SELECT … FOR UPDATE) sampai transaksi selesai. */
export async function lockOrder(tx: Tx, orderId: number) {
  const rows = await tx.$queryRaw<{ id: number }[]>`SELECT "id" FROM "orders" WHERE "id" = ${orderId} FOR UPDATE`;
  if (rows.length === 0) throw notFound("Pesanan tidak ditemukan.");
}

export const TX_OPTS = { timeout: 20000, maxWait: 10000 } as const;
