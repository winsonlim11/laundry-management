import Link from "next/link";
import { Truck } from "lucide-react";
import { pageActor } from "@/server/page";
import { listLogistics } from "@/server/services/logistics";
import { listCouriers } from "@/server/services/users";
import { getSettings } from "@/server/services/settings";
import { Card, Empty, PageHeader } from "@/components/ui";
import { TaskBadge } from "@/components/status-badge";
import { CourierSelect, NewPickupButton } from "@/components/logistics/forms";
import { formatDateTime } from "@/lib/time";
import { rupiah } from "@/lib/money";

export const metadata = { title: "Jemput & Antar" };

export default async function LogisticsPage() {
  const actor = await pageActor("logistics.manage");
  const [{ pickups, deliveries }, couriers, s] = await Promise.all([listLogistics(actor), listCouriers(), getSettings()]);
  const cs = couriers.map((c) => ({ id: c.id, name: c.user.name }));
  return (
    <div className="space-y-5">
      <PageHeader title="Jemput & Antar" subtitle="Jadwal, penugasan kurir, dan riwayat tugas" actions={<NewPickupButton couriers={cs} defaultFee={s.defaultPickupFee} />} />
      <Card title={`Penjemputan (${pickups.length})`} padded={false}>
        {pickups.length === 0 ? <Empty icon={<Truck className="size-8" />} title="Belum ada permintaan jemput">Buat permintaan jemput sebelum berat cucian diketahui; tautkan ke nota saat cucian diterima.</Empty> : (
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500"><tr><th className="px-4 py-2 font-medium">No.</th><th className="px-4 py-2 font-medium">Pelanggan & alamat</th><th className="px-4 py-2 font-medium">Jadwal</th><th className="px-4 py-2 font-medium">Kurir</th><th className="px-4 py-2 font-medium">Status</th><th className="px-4 py-2 font-medium">Nota</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {pickups.map((p) => (
                <tr key={p.id} className="align-top">
                  <td className="px-4 py-2.5"><Link className="font-mono text-xs text-brand-700 hover:underline" href={`/kurir/pickup/${p.id}`}>{p.number}</Link><div className="text-[11px] text-slate-400">Biaya {rupiah(p.fee)}</div></td>
                  <td className="px-4 py-2.5"><div className="font-medium">{p.name} · {p.phone}</div><div className="max-w-xs text-xs text-slate-500">{p.address}</div></td>
                  <td className="px-4 py-2.5 text-xs">{formatDateTime(p.scheduledAt)}</td>
                  <td className="px-4 py-2.5"><CourierSelect type="pickup" id={p.id} value={p.courierId} couriers={cs} disabled={p.status === "DITERIMA_LAUNDRY" || p.status === "DIBATALKAN"} /></td>
                  <td className="px-4 py-2.5"><TaskBadge s={p.status} /></td>
                  <td className="px-4 py-2.5 text-xs">{p.order ? <Link className="font-mono text-brand-700 hover:underline" href={`/pesanan/${p.order.id}`}>{p.order.number}</Link> : p.status !== "DIBATALKAN" && actor.permissions.has("orders.create") ? <Link className="font-medium text-brand-700 hover:underline" href={`/kasir?pickup=${p.id}`}>Buat nota →</Link> : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </Card>
      <Card title={`Pengantaran (${deliveries.length})`} padded={false}>
        {deliveries.length === 0 ? <Empty icon={<Truck className="size-8" />} title="Belum ada jadwal antar">Jadwalkan pengantaran dari halaman detail pesanan.</Empty> : (
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500"><tr><th className="px-4 py-2 font-medium">No.</th><th className="px-4 py-2 font-medium">Penerima & alamat</th><th className="px-4 py-2 font-medium">Jadwal</th><th className="px-4 py-2 font-medium">Kurir</th><th className="px-4 py-2 font-medium">Status</th><th className="px-4 py-2 font-medium">Nota</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {deliveries.map((d) => (
                <tr key={d.id} className="align-top">
                  <td className="px-4 py-2.5"><Link className="font-mono text-xs text-brand-700 hover:underline" href={`/kurir/delivery/${d.id}`}>{d.number}</Link><div className="text-[11px] text-slate-400">Tagih {rupiah(d.fee)} · Kurir {rupiah(d.courierPay)}</div></td>
                  <td className="px-4 py-2.5"><div className="font-medium">{d.name} · {d.phone}</div><div className="max-w-xs text-xs text-slate-500">{d.address}</div></td>
                  <td className="px-4 py-2.5 text-xs">{formatDateTime(d.scheduledAt)}</td>
                  <td className="px-4 py-2.5"><CourierSelect type="delivery" id={d.id} value={d.courierId} couriers={cs} disabled={d.status === "BERHASIL_DIANTAR" || d.status === "DIBATALKAN"} /></td>
                  <td className="px-4 py-2.5"><TaskBadge s={d.status} /></td>
                  <td className="px-4 py-2.5"><Link className="font-mono text-xs text-brand-700 hover:underline" href={`/pesanan/${d.order.id}`}>{d.order.number}</Link></td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </Card>
    </div>
  );
}
