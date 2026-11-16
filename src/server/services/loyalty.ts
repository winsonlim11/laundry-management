import type { Tx } from "../db";

/**
 * Catat poin untuk pesanan yang SELESAI dan LUNAS — tepat satu kali.
 * Dijamin oleh unique constraint loyalty_ledger(orderId, type) + INSERT … ON CONFLICT DO NOTHING.
 * Dipanggil setelah pelunasan maupun setelah serah terima, mana pun yang terjadi terakhir.
 */
export async function awardLoyaltyIfEligible(tx: Tx, orderId: number): Promise<number> {
  const order = await tx.order.findUnique({ where: { id: orderId } });
  if (!order || order.status !== "SELESAI" || order.paymentStatus !== "LUNAS") return 0;
  const settings = await tx.businessSetting.findUnique({ where: { id: 1 } });
  if (!settings?.pointsEnabled || settings.pointsPerAmount <= 0) return 0;
  const base = order.subtotal - order.discountAmount;
  const points = Math.floor(base / settings.pointsPerAmount);
  if (points <= 0) return 0;
  const inserted = await tx.$queryRaw<{ id: number }[]>`
    INSERT INTO "loyalty_ledger"("customerId", "orderId", "type", "points", "note")
    VALUES (${order.customerId}, ${order.id}, 'EARN'::"LoyaltyType", ${points}, ${"Poin nota " + order.number})
    ON CONFLICT ("orderId", "type") DO NOTHING RETURNING "id"`;
  if (inserted.length === 0) return 0;
  await tx.customer.update({ where: { id: order.customerId }, data: { points: { increment: points } } });
  return points;
}
