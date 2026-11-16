import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPin, MessageCircle } from "lucide-react";
import { pageActor } from "@/server/page";
import { getCustomerProfile } from "@/server/services/customers";
import { getSettings } from "@/server/services/settings";
import { AppError } from "@/server/errors";
import { waLink } from "@/server/services/whatsapp";
import { Badge, Card, PageHeader } from "@/components/ui";
import { Stat } from "@/components/stat";
import { OrderStatusBadge, PayBadge, TxBadge } from "@/components/status-badge";
import { AdjustPointsButton, EditCustomerButton } from "@/components/customers/forms";
import { rupiah } from "@/lib/money";
import { formatDateTime } from "@/lib/time";
import { METHOD_LABEL } from "@/lib/status";

export const metadata = { title: "Profil pelanggan" };

export default async function CustomerProfile({ params }: { params: Promise<{ id: string }> }) {
  const actor = await pageActor("customers.manage", "orders.view_all");
  const { id } = await params;
  let p;
  try { p = await getCustomerProfile(actor, Number(id)); } catch (e) { if (e instanceof AppError) notFound(); throw e; }
  const s = await getSettings();
  const c = p.customer;
  return (
    <div className="space-y-4">
      <PageHeader title={c.name} subtitle={<span className="flex flex-wrap items-center gap-2">WA {c.phone} <Badge tone="blue">{c.membership}</Badge>{c.archivedAt && <Badge tone="red">Diarsipkan</Badge>}</span>}
        actions={<>
          <a href={waLink(c.phone, `Halo ${c.name}, `)} target="_blank" rel="noopener" className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium shadow-sm hover:bg-slate-50"><MessageCircle className="size-4 text-emerald-600" />WhatsApp</a>
          {actor.permissions.has("customers.manage") && <EditCustomerButton customer={{ id: c.id, name: c.name, phone: c.phone, address: c.address, mapsUrl: c.mapsUrl, notes: c.notes, membership: c.membership }} />}
          {actor.permissions.has("orders.create") && <Link href={`/kasir?customer=${c.id}`} className="inline-flex h-9 items-center rounded-lg bg-brand-600 px-3.5 text-sm font-medium text-white hover:bg-brand-700">+ Nota baru</Link>}
        </>}
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Jumlah transaksi" value={p.stats.transactions} period="Sepanjang waktu" />
        <Stat label="Total belanja" value={rupiah(p.stats.totalSpend)} period="Sepanjang waktu" />
        <Stat label="Sisa tagihan" value={rupiah(p.stats.outstanding)} period="Saat ini" tone="amber" />
        <Stat label="Saldo poin" value={c.points} period={`1 poin / ${rupiah(s.pointsPerAmount)}`} tone="violet" />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Info">
          <dl className="space-y-2 text-sm">
            <div><dt className="text-xs text-slate-500">Alamat</dt><dd>{c.address || "—"}</dd></div>
            {c.mapsUrl && <div><a className="inline-flex items-center gap-1 text-brand-700 hover:underline" href={c.mapsUrl} target="_blank" rel="noopener"><MapPin className="size-3.5" />Buka di Maps</a></div>}
            <div><dt className="text-xs text-slate-500">Catatan</dt><dd>{c.notes || "—"}</dd></div>
            <div><dt className="text-xs text-slate-500">Terdaftar</dt><dd>{formatDateTime(c.createdAt)}</dd></div>
          </dl>
        </Card>
        <Card title="Riwayat pesanan" className="lg:col-span-2" padded={false}>
          {p.orders.length === 0 ? <p className="px-4 py-6 text-center text-sm text-slate-500">Belum ada pesanan.</p> : (
            <div className="max-h-96 overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-50 text-left text-xs text-slate-500"><tr><th className="px-4 py-2 font-medium">Nota</th><th className="px-4 py-2 font-medium">Status</th><th className="px-4 py-2 font-medium">Bayar</th><th className="px-4 py-2 text-right font-medium">Total</th><th className="px-4 py-2 text-right font-medium">Sisa</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {p.orders.map((o) => (
                    <tr key={o.id}><td className="px-4 py-2"><Link className="font-mono text-xs text-brand-700 hover:underline" href={`/pesanan/${o.id}`}>{o.number}</Link><div className="text-[11px] text-slate-400">{formatDateTime(o.createdAt)}</div></td><td className="px-4 py-2"><OrderStatusBadge s={o.status} /></td><td className="px-4 py-2"><PayBadge s={o.paymentStatus} /></td><td className="tabular px-4 py-2 text-right">{rupiah(o.total)}</td><td className="tabular px-4 py-2 text-right font-medium">{o.status === "DIBATALKAN" ? "—" : rupiah(o.total - o.paidAmount)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Riwayat pembayaran" padded={false}>
          {p.payments.length === 0 ? <p className="px-4 py-6 text-center text-sm text-slate-500">Belum ada pembayaran.</p> : (
            <ul className="max-h-80 divide-y divide-slate-100 overflow-auto">
              {p.payments.map((x) => (
                <li key={x.id} className="flex items-center justify-between px-4 py-2 text-sm">
                  <div><p>{x.order.number} · {METHOD_LABEL[x.method]}</p><p className="text-xs text-slate-500">{formatDateTime(x.confirmedAt ?? x.createdAt)}</p></div>
                  <div className="flex items-center gap-2"><TxBadge s={x.status} kind={x.kind} /><span className="tabular font-medium">{x.kind === "REFUND" ? "−" : ""}{rupiah(x.amount)}</span></div>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Mutasi poin" padded={false} actions={actor.permissions.has("customers.manage") && <AdjustPointsButton customerId={c.id} />}>
          {p.loyalty.length === 0 ? <p className="px-4 py-6 text-center text-sm text-slate-500">Belum ada mutasi poin. Poin dicatat otomatis saat pesanan selesai & lunas.</p> : (
            <ul className="max-h-80 divide-y divide-slate-100 overflow-auto">
              {p.loyalty.map((l) => (
                <li key={l.id} className="flex items-center justify-between px-4 py-2 text-sm">
                  <div><p>{l.type === "EARN" ? `Perolehan · ${l.order?.number ?? ""}` : l.note}</p><p className="text-xs text-slate-500">{formatDateTime(l.createdAt)}</p></div>
                  <span className={`tabular font-medium ${l.points < 0 ? "text-red-600" : "text-emerald-700"}`}>{l.points > 0 ? "+" : ""}{l.points}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
