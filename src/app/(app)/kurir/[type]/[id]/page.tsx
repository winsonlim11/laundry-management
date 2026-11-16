import { notFound } from "next/navigation";
import { pageActor } from "@/server/page";
import { getTask } from "@/server/services/logistics";
import { AppError } from "@/server/errors";
import { Alert } from "@/components/ui";
import { TaskView } from "./task-view";
import { normalizePhone } from "@/server/services/customers";

export const metadata = { title: "Detail tugas" };

export default async function TaskPage({ params }: { params: Promise<{ type: string; id: string }> }) {
  const actor = await pageActor("courier.tasks", "logistics.manage");
  const { type, id } = await params;
  if (type !== "pickup" && type !== "delivery") notFound();
  let r;
  try { r = await getTask(actor, type, Number(id)); } catch (e) {
    if (e instanceof AppError && e.status === 404) notFound();
    if (e instanceof AppError) return <Alert>{e.message}</Alert>;
    throw e;
  }
  const t = r.task as typeof r.task & { order?: { id: number; number: string; total?: number; paidAmount?: number; paymentStatus?: string; status?: string } | null };
  const mapsHref = t.mapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(t.address)}`;
  return (
    <TaskView
      type={type}
      task={{
        id: t.id, number: t.number, name: t.name, phone: normalizePhone(t.phone), address: t.address, mapsHref, notes: t.notes, status: t.status,
        scheduledAt: t.scheduledAt.toISOString(), courier: t.courier?.user.name ?? null,
        photos: t.photos.map((p) => ({ id: p.id, at: p.createdAt.toISOString() })),
        history: t.history.map((h) => ({ id: h.id, from: h.fromStatus, to: h.toStatus, at: h.createdAt.toISOString(), by: h.userName })),
        order: t.order ? { id: t.order.id, number: t.order.number, due: t.order.total !== undefined && t.order.paidAmount !== undefined ? t.order.total - t.order.paidAmount : null, status: t.order.status ?? null } : null,
      }}
      isStaff={actor.permissions.has("logistics.manage")}
    />
  );
}
