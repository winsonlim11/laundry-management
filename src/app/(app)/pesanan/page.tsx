import Link from "next/link";
import { ReceiptText, Search } from "lucide-react";
import { pageActor } from "@/server/page";
import { listOrders } from "@/server/services/orders";
import { Card, Empty, PageHeader } from "@/components/ui";
import { OrderStatusBadge, PayBadge } from "@/components/status-badge";
import { rupiah, qty } from "@/lib/money";
import { formatDateTime } from "@/lib/time";
import { ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL } from "@/lib/status";

export const metadata = { title: "Pesanan" };

export default async function OrdersPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const actor = await pageActor("orders.view_all");
  const sp = await searchParams;
  const data = await listOrders(actor, { q: sp.q, status: sp.status, paymentStatus: sp.pay || undefined, page: sp.page ?? 1, scope: sp.scope === "active" ? "active" : "all" });
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
  const qs = (p: Record<string, string | number | undefined>) => "?" + new URLSearchParams(Object.entries({ ...sp, ...p }).filter(([, v]) => v !== undefined && v !== "").map(([k, v]) => [k, String(v)])).toString();
  return (
    <div>
      <PageHeader title="Pesanan" subtitle={`${data.total} nota`} actions={actor.permissions.has("orders.create") ? <Link href="/kasir" className="inline-flex h-9 items-center rounded-lg bg-brand-600 px-3.5 text-sm font-medium text-white hover:bg-brand-700">+ Nota baru</Link> : null} />
      <form className="mb-4 flex flex-wrap gap-2" role="search">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-slate-400" aria-hidden />
          <input name="q" defaultValue={sp.q} placeholder="No. nota, kode, nama, atau WA…" aria-label="Cari pesanan" className="h-9 w-full rounded-lg border border-slate-300 bg-white pl-8 pr-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100" />
        </div>
        <select name="status" defaultValue={sp.status ?? ""} aria-label="Filter status" className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-sm">
          <option value="">Semua status</option>
          {Object.entries(ORDER_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select name="pay" defaultValue={sp.pay ?? ""} aria-label="Filter status bayar" className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-sm">
          <option value="">Semua pembayaran</option>
          {Object.entries(PAYMENT_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium shadow-sm hover:bg-slate-50">Terapkan</button>
      </form>
      <Card padded={false}>
        {data.rows.length === 0 ? <Empty icon={<ReceiptText className="size-8" />} title="Tidak ada pesanan">Coba ubah filter atau buat nota baru di Kasir.</Empty> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs text-slate-500">
                <tr><th className="px-4 py-2 font-medium">Nota</th><th className="px-4 py-2 font-medium">Pelanggan</th><th className="hidden px-4 py-2 font-medium md:table-cell">Layanan</th><th className="px-4 py-2 font-medium">Status</th><th className="px-4 py-2 font-medium">Bayar</th><th className="px-4 py-2 text-right font-medium">Total</th><th className="px-4 py-2 text-right font-medium">Sisa</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.rows.map((o) => (
                  <tr key={o.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5"><Link href={`/pesanan/${o.id}`} className="font-mono text-xs font-medium text-brand-700 hover:underline">{o.number}</Link><div className="text-[11px] text-slate-400">{formatDateTime(o.createdAt)}</div></td>
                    <td className="px-4 py-2.5"><div className="font-medium">{o.customer.name}</div><div className="text-xs text-slate-500">{o.customer.phone}</div></td>
                    <td className="hidden px-4 py-2.5 text-xs text-slate-600 md:table-cell">{o.items.map((i) => `${i.serviceName} ${qty(i.quantity.toString())}${i.unit === "KG" ? "kg" : "pcs"}`).join(", ")}</td>
                    <td className="px-4 py-2.5"><OrderStatusBadge s={o.status} /></td>
                    <td className="px-4 py-2.5"><PayBadge s={o.paymentStatus} /></td>
                    <td className="tabular px-4 py-2.5 text-right">{rupiah(o.total)}</td>
                    <td className="tabular px-4 py-2.5 text-right font-medium">{o.status === "DIBATALKAN" ? "—" : rupiah(o.total - o.paidAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {pages > 1 && (
        <nav className="mt-4 flex items-center justify-between text-sm" aria-label="Halaman">
          <span className="text-slate-500">Halaman {data.page} dari {pages}</span>
          <div className="flex gap-2">
            {data.page > 1 && <Link className="rounded-lg border border-slate-300 bg-white px-3 py-1.5" href={qs({ page: data.page - 1 })}>Sebelumnya</Link>}
            {data.page < pages && <Link className="rounded-lg border border-slate-300 bg-white px-3 py-1.5" href={qs({ page: data.page + 1 })}>Berikutnya</Link>}
          </div>
        </nav>
      )}
    </div>
  );
}
