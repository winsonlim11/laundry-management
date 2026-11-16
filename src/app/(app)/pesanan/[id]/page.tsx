import { notFound } from "next/navigation";
import { pageActor } from "@/server/page";
import { getOrderForActor } from "@/server/services/orders";
import { listOperators, listCouriers } from "@/server/services/users";
import { AppError } from "@/server/errors";
import { OrderDetailView } from "@/components/orders/detail";
import { Alert } from "@/components/ui";
import { nextStatus, orderPath, type FlowT, type OrderStatusT } from "@/lib/status";
import { getSettings } from "@/server/services/settings";
import { waLink } from "@/server/services/whatsapp";
import { rupiah } from "@/lib/money";

export const metadata = { title: "Detail pesanan" };

export default async function OrderDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ baru?: string }> }) {
  const actor = await pageActor();
  const { id } = await params;
  const sp = await searchParams;
  let res;
  try {
    res = await getOrderForActor(actor, Number(id));
  } catch (e) {
    if (e instanceof AppError && e.status === 404) notFound();
    if (e instanceof AppError) return <Alert>{e.message}</Alert>;
    throw e;
  }
  const { order, financial } = res;
  const flows = order.items.map((i) => i.flow as FlowT);
  const P = (k: string) => actor.permissions.has(k as never);
  const [operators, couriers, settings] = await Promise.all([
    P("production.assign") ? listOperators() : Promise.resolve([]),
    P("logistics.manage") ? listCouriers() : Promise.resolve([]),
    getSettings(),
  ]);
  const remaining = order.status === "DIBATALKAN" ? 0 : order.total - order.paidAmount;
  const waMsg = `Halo ${order.customer.name}, nota ${order.number} di ${settings.name}.\n` +
    order.items.map((i) => `- ${i.serviceName} ${i.quantity.toString()} ${i.unit.toLowerCase()} = ${rupiah(i.lineTotal)}`).join("\n") +
    `\nTotal ${rupiah(order.total)} · Dibayar ${rupiah(order.paidAmount)} · Sisa ${rupiah(remaining)}.` +
    (order.status === "SIAP_DIAMBIL" ? "\nCucian Anda sudah siap diambil. Terima kasih!" : "");
  const plain = JSON.parse(JSON.stringify(order, (_k, v) => (typeof v === "object" && v && v.constructor?.name === "Decimal" ? v.toString() : v)));
  return (
    <OrderDetailView
      order={plain}
      financial={financial}
      isNew={sp.baru === "1"}
      path={orderPath(flows, order.handover)}
      next={nextStatus(order.status as OrderStatusT, flows, order.handover)}
      operators={operators.map((o) => ({ id: o.id, name: o.name }))}
      couriers={couriers.map((c) => ({ id: c.id, name: c.user.name }))}
      waUrl={waLink(order.customer.phone, waMsg)}
      perms={{
        pay: P("payments.create"), confirm: P("payments.confirm"), cancel: P("orders.cancel"), refund: P("refunds.create"),
        assign: P("production.assign"), logistics: P("logistics.manage"),
        produce: P("production.update_any") || (P("production.update_assigned") && order.assignedOperatorId === actor.id),
        handover: P("orders.view_all") || P("production.update_any"), print: P("orders.view_all"),
      }}
      defaults={{ deliveryFee: settings.defaultDeliveryFee }}
    />
  );
}
