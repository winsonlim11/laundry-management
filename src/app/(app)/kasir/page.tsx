import { pageActor } from "@/server/page";
import { listServices } from "@/server/services/catalog";
import { listOperators } from "@/server/services/users";
import { getSettings } from "@/server/services/settings";
import { prisma } from "@/server/db";
import { PosForm } from "@/components/kasir/pos-form";

export const metadata = { title: "Kasir" };

export default async function KasirPage({ searchParams }: { searchParams: Promise<{ pickup?: string; customer?: string }> }) {
  const actor = await pageActor("orders.create");
  const sp = await searchParams;
  const [services, operators, settings, pickups, preCustomer] = await Promise.all([
    listServices(),
    actor.permissions.has("production.assign") ? listOperators() : Promise.resolve([]),
    getSettings(),
    prisma.pickupRequest.findMany({ where: { orderId: null, status: { in: ["SUDAH_DIJEMPUT", "DITERIMA_LAUNDRY", "KURIR_MENUJU_LOKASI", "MENUNGGU_DIJEMPUT"] } }, include: { customer: true }, orderBy: { scheduledAt: "desc" }, take: 30 }),
    sp.customer ? prisma.customer.findUnique({ where: { id: Number(sp.customer) || 0 } }) : Promise.resolve(null),
  ]);
  return (
    <PosForm
      services={services.filter((s) => s.active).map((s) => ({ id: s.id, name: s.name, unit: s.unit, price: s.price, expressPrice: s.expressPrice, estimateHours: s.estimateHours, expressEstimateHours: s.expressEstimateHours }))}
      operators={operators.map((o) => ({ id: o.id, name: o.name }))}
      defaults={{ pickupFee: settings.defaultPickupFee, deliveryFee: settings.defaultDeliveryFee }}
      pickups={pickups.map((p) => ({ id: p.id, number: p.number, name: p.name, phone: p.phone, address: p.address, fee: p.fee, status: p.status, customer: p.customer ? { id: p.customer.id, name: p.customer.name, phone: p.customer.phone, address: p.customer.address } : null }))}
      initialPickupId={sp.pickup ? Number(sp.pickup) : undefined}
      initialCustomer={preCustomer ? { id: preCustomer.id, name: preCustomer.name, phone: preCustomer.phone, address: preCustomer.address } : null}
      canPay={actor.permissions.has("payments.create")}
    />
  );
}
