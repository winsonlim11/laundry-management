import { api, body } from "@/server/http";
import { createOrderInput, priceOrder } from "@/server/services/orders";
import { prisma } from "@/server/db";
import { requirePerm } from "@/server/actor";
/** Pratinjau tagihan memakai tarif & aturan yang sama dengan penyimpanan. */
export const POST = api(async ({ req, actor }) => {
  requirePerm(actor, "orders.create");
  const input = createOrderInput.parse(await body(req));
  const { lines, bill, maxHours } = await priceOrder(prisma, input);
  return { bill, lines: lines.map((l, i) => ({ serviceName: l.s.name, unitPrice: l.unitPrice, lineTotal: bill.lineTotals[i] })), estimateHours: maxHours };
});
