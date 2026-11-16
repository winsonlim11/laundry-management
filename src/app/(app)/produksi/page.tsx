import { WashingMachine } from "lucide-react";
import { pageActor } from "@/server/page";
import { prisma } from "@/server/db";
import { listOperators } from "@/server/services/users";
import { Empty, PageHeader } from "@/components/ui";
import { nextStatus, ORDER_STATUS_LABEL, type FlowT, type OrderStatusT } from "@/lib/status";
import { ProductionBoard } from "./board";
import type { Prisma } from "@/generated/prisma/client";

export const metadata = { title: "Produksi" };
const COLS: OrderStatusT[] = ["BARU", "MENUNGGU_PROSES", "DICUCI", "DIKERINGKAN", "DISETRIKA", "DIKEMAS", "SIAP_DIAMBIL"];

export default async function ProductionPage({ searchParams }: { searchParams: Promise<{ semua?: string }> }) {
  const actor = await pageActor("production.update_assigned", "production.update_any", "production.assign");
  const sp = await searchParams;
  const seeAll = actor.permissions.has("production.update_any") || actor.permissions.has("production.assign");
  const where: Prisma.OrderWhereInput = { status: { in: COLS } };
  if (!seeAll || sp.semua === "0") where.assignedOperatorId = actor.id;
  const [orders, operators] = await Promise.all([
    prisma.order.findMany({ where, include: { items: true, customer: { select: { name: true } } }, orderBy: [{ estimatedDoneAt: "asc" }] }),
    actor.permissions.has("production.assign") ? listOperators() : Promise.resolve([]),
  ]);
  const opName = new Map(operators.map((o) => [o.id, o.name]));
  const cards = orders.map((o) => {
    const flows = o.items.map((i) => i.flow as FlowT);
    const nx = nextStatus(o.status as OrderStatusT, flows, o.handover);
    const canMove = actor.permissions.has("production.update_any") || (actor.permissions.has("production.update_assigned") && o.assignedOperatorId === actor.id);
    return {
      id: o.id, number: o.number, customer: o.customer.name, status: o.status, handover: o.handover,
      items: o.items.map((i) => `${i.serviceName} ${i.quantity.toString()}${i.unit === "KG" ? "kg" : "pcs"}`),
      express: o.items.some((i) => i.express), due: o.estimatedDoneAt?.toISOString() ?? null,
      next: nx && nx !== "DALAM_PENGANTARAN" && !(o.status === "SIAP_DIAMBIL") ? nx : null,
      canMove, operatorId: o.assignedOperatorId, operator: o.assignedOperatorId ? opName.get(o.assignedOperatorId) ?? null : null,
    };
  });
  return (
    <div>
      <PageHeader title="Produksi" subtitle={seeAll ? "Semua pesanan aktif" : "Pekerjaan yang ditugaskan kepada Anda"} />
      {cards.length === 0 ? <Empty icon={<WashingMachine className="size-10" />} title="Tidak ada pekerjaan aktif">{seeAll ? "Pesanan baru dari kasir akan muncul di sini." : "Belum ada pesanan yang ditugaskan kepada Anda."}</Empty> :
        <ProductionBoard cols={COLS.map((c) => ({ key: c, label: ORDER_STATUS_LABEL[c] }))} cards={cards} operators={operators.map((o) => ({ id: o.id, name: o.name }))} canAssign={actor.permissions.has("production.assign")} />}
    </div>
  );
}
