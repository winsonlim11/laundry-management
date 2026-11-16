import Link from "next/link";
import { redirect } from "next/navigation";
import { Activity, ReceiptText } from "lucide-react";
import { pageActor } from "@/server/page";
import { getDashboard } from "@/server/services/reports";
import { Alert, Card, Empty } from "@/components/ui";
import { Stat } from "@/components/stat";
import { OrdersChart, RevenueChart } from "@/components/charts";
import { OrderStatusBadge, PayBadge } from "@/components/status-badge";
import { rupiah } from "@/lib/money";
import { formatDate, formatDateTime } from "@/lib/time";
import { HISTORY_TRACK_LABEL, statusLabel } from "@/lib/status";

export const metadata = { title: "Dashboard" };

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const actor = await pageActor();
  const sp = await searchParams;
  if (!actor.permissions.has("dashboard.view")) {
    if (actor.permissions.has("courier.tasks")) redirect("/kurir");
    if (actor.permissions.has("production.update_assigned")) redirect("/produksi");
  }
  const d = await getDashboard(actor);
  const monthLabel = new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(d.monthStart));
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-slate-500">Hari ini {formatDate(new Date())} · zona waktu WIB</p>
        </div>
        {actor.permissions.has("orders.create") && <Link href="/kasir" className="inline-flex h-9 items-center rounded-lg bg-brand-600 px-3.5 text-sm font-medium text-white hover:bg-brand-700">+ Nota baru</Link>}
      </div>
      {sp.denied && <Alert tone="amber">Anda tidak memiliki akses ke halaman tersebut.</Alert>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Pesanan dibuat" value={d.createdToday} period="Hari ini" />
        <Stat label="Pesanan selesai" value={d.completedToday} period="Hari ini" tone="green" />
        {d.finance ? (
          <>
            <Stat label="Penerimaan" value={rupiah(d.todayReceipts)} period="Hari ini" />
            <Stat label="Penerimaan" value={rupiah(d.monthReceipts)} period={monthLabel} tone="violet" />
          </>
        ) : null}
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Baru" value={d.queue.baru} period="Antrean aktif" tone="violet" href="/pesanan?status=BARU" />
        <Stat label="Diproses" value={d.queue.diproses} period="Antrean aktif" tone="amber" href="/produksi" />
        <Stat label="Siap diambil / diantar" value={d.queue.siap} period="Antrean aktif" tone="green" href="/pesanan?status=SIAP_DIAMBIL" />
      </div>
      {d.finance && d.receivables !== null && (
        <p className="text-xs text-slate-500">Piutang pelanggan saat ini: <span className="tabular font-medium text-slate-700">{rupiah(d.receivables)}</span></p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {d.finance && <Card title="Penerimaan · 14 hari terakhir"><RevenueChart data={d.chart} /></Card>}
        <Card title="Statistik pesanan · 14 hari terakhir"><OrdersChart data={d.chart} /></Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card title="Pesanan terbaru" className="lg:col-span-3" padded={false} actions={<Link href="/pesanan" className="text-xs font-medium text-brand-700 hover:underline">Lihat semua</Link>}>
          {d.recentOrders.length === 0 ? <Empty icon={<ReceiptText className="size-8" />} title="Belum ada pesanan">Pesanan baru dari kasir akan muncul di sini.</Empty> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs text-slate-500"><tr><th className="px-4 py-2 font-medium">Nota</th><th className="px-4 py-2 font-medium">Pelanggan</th><th className="px-4 py-2 font-medium">Status</th><th className="px-4 py-2 font-medium">Bayar</th><th className="px-4 py-2 text-right font-medium">Total</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {d.recentOrders.map((o) => (
                    <tr key={o.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2"><Link href={`/pesanan/${o.id}`} className="font-mono text-xs font-medium text-brand-700 hover:underline">{o.number}</Link><div className="text-[11px] text-slate-400">{formatDateTime(o.createdAt)}</div></td>
                      <td className="px-4 py-2">{o.customer.name}</td>
                      <td className="px-4 py-2"><OrderStatusBadge s={o.status} /></td>
                      <td className="px-4 py-2"><PayBadge s={o.paymentStatus} /></td>
                      <td className="tabular px-4 py-2 text-right">{rupiah(o.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        <Card title="Aktivitas terbaru" className="lg:col-span-2">
          {d.recentActivity.length === 0 ? <Empty icon={<Activity className="size-8" />} title="Belum ada aktivitas" /> : (
            <ol className="space-y-3">
              {d.recentActivity.map((h) => (
                <li key={h.id} className="flex gap-3 text-sm">
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-brand-500" aria-hidden />
                  <div className="min-w-0">
                    <p className="truncate">
                      <span className="font-medium">{h.userName ?? "Sistem"}</span>{" · "}
                      {HISTORY_TRACK_LABEL[h.track]} → {statusLabel(h.track, h.toStatus)}
                    </p>
                    <p className="text-xs text-slate-500">
                      {h.order ? <Link className="text-brand-700 hover:underline" href={`/pesanan/${h.order.id}`}>{h.order.number}</Link> : h.pickupRequest?.number ?? h.deliveryRequest?.number} · {formatDateTime(h.createdAt)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>
    </div>
  );
}
