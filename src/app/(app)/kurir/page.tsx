import Link from "next/link";
import { Bike, ChevronRight, MapPin } from "lucide-react";
import { pageActor } from "@/server/page";
import { listCourierTasks } from "@/server/services/logistics";
import { Empty, PageHeader } from "@/components/ui";
import { TaskBadge } from "@/components/status-badge";
import { formatDateTime } from "@/lib/time";

export const metadata = { title: "Tugas kurir" };

export default async function CourierHome() {
  const actor = await pageActor("courier.tasks");
  const { pickups, deliveries } = await listCourierTasks(actor);
  const tasks = [
    ...pickups.map((p) => ({ type: "pickup" as const, id: p.id, number: p.number, name: p.name, address: p.address, at: p.scheduledAt, status: p.status, done: p.status === "DITERIMA_LAUNDRY" || p.status === "DIBATALKAN" })),
    ...deliveries.map((d) => ({ type: "delivery" as const, id: d.id, number: d.number, name: d.name, address: d.address, at: d.scheduledAt, status: d.status, done: d.status === "BERHASIL_DIANTAR" || d.status === "DIBATALKAN" })),
  ].sort((a, b) => +a.at - +b.at);
  const active = tasks.filter((t) => !t.done);
  const done = tasks.filter((t) => t.done).reverse().slice(0, 20);
  const Item = ({ t }: { t: (typeof tasks)[number] }) => (
    <li>
      <Link href={`/kurir/${t.type}/${t.id}`} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm active:bg-slate-50">
        <div className={`flex size-11 shrink-0 items-center justify-center rounded-full text-xs font-bold ${t.type === "pickup" ? "bg-violet-100 text-violet-700" : "bg-amber-100 text-amber-700"}`}>{t.type === "pickup" ? "JEMPUT" : "ANTAR"}</div>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 font-semibold">{t.name} <TaskBadge s={t.status} /></p>
          <p className="flex items-start gap-1 text-sm text-slate-600"><MapPin className="mt-0.5 size-3.5 shrink-0" /><span className="line-clamp-2">{t.address}</span></p>
          <p className="text-xs text-slate-500">{formatDateTime(t.at)} · {t.number}</p>
        </div>
        <ChevronRight className="size-5 text-slate-400" />
      </Link>
    </li>
  );
  return (
    <div className="mx-auto max-w-lg">
      <PageHeader title="Tugas saya" subtitle={`${active.length} tugas aktif`} />
      {active.length === 0 ? <Empty icon={<Bike className="size-10" />} title="Tidak ada tugas aktif">Tugas jemput/antar yang ditugaskan kepada Anda akan muncul di sini.</Empty> : <ul className="space-y-3">{active.map((t) => <Item key={`${t.type}${t.id}`} t={t} />)}</ul>}
      {done.length > 0 && (<><h2 className="mb-2 mt-8 text-sm font-semibold text-slate-600">Riwayat tugas</h2><ul className="space-y-2 opacity-80">{done.map((t) => <Item key={`${t.type}${t.id}`} t={t} />)}</ul></>)}
    </div>
  );
}
