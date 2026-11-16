import Link from "next/link";
import { Search, Users } from "lucide-react";
import { pageActor } from "@/server/page";
import { prisma } from "@/server/db";
import { searchCustomers } from "@/server/services/customers";
import { Badge, Card, Empty, PageHeader } from "@/components/ui";
import { NewCustomerButton } from "@/components/customers/forms";
import { rupiah } from "@/lib/money";

export const metadata = { title: "Pelanggan" };

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const actor = await pageActor("customers.manage");
  const { q = "" } = await searchParams;
  const list = await searchCustomers(actor, q, 100);
  const stats = await prisma.order.groupBy({ by: ["customerId"], where: { customerId: { in: list.map((c) => c.id) }, status: { not: "DIBATALKAN" } }, _count: true, _sum: { total: true, paidAmount: true } });
  const byId = new Map(stats.map((s) => [s.customerId, s]));
  return (
    <div>
      <PageHeader title="Pelanggan" subtitle={`${list.length} ditampilkan`} actions={<NewCustomerButton />} />
      <form className="mb-4" role="search">
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-slate-400" aria-hidden />
          <input name="q" defaultValue={q} placeholder="Cari nama atau WhatsApp…" aria-label="Cari pelanggan" className="h-9 w-full rounded-lg border border-slate-300 bg-white pl-8 pr-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100" />
        </div>
      </form>
      <Card padded={false}>
        {list.length === 0 ? <Empty icon={<Users className="size-8" />} title="Belum ada pelanggan">Tambahkan pelanggan baru dari tombol di atas atau saat membuat nota.</Empty> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs text-slate-500"><tr><th className="px-4 py-2 font-medium">Nama</th><th className="px-4 py-2 font-medium">WhatsApp</th><th className="px-4 py-2 font-medium">Membership</th><th className="px-4 py-2 text-right font-medium">Transaksi</th><th className="px-4 py-2 text-right font-medium">Total belanja</th><th className="px-4 py-2 text-right font-medium">Piutang</th><th className="px-4 py-2 text-right font-medium">Poin</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {list.map((c) => { const s = byId.get(c.id); const out = (s?._sum.total ?? 0) - (s?._sum.paidAmount ?? 0); return (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5"><Link href={`/pelanggan/${c.id}`} className="font-medium text-brand-700 hover:underline">{c.name}</Link>{c.address && <div className="max-w-xs truncate text-xs text-slate-500">{c.address}</div>}</td>
                    <td className="px-4 py-2.5 text-slate-600">{c.phone}</td>
                    <td className="px-4 py-2.5"><Badge tone={c.membership === "GOLD" ? "amber" : c.membership === "SILVER" ? "gray" : "blue"}>{c.membership}</Badge></td>
                    <td className="tabular px-4 py-2.5 text-right">{s?._count ?? 0}</td>
                    <td className="tabular px-4 py-2.5 text-right">{rupiah(s?._sum.total ?? 0)}</td>
                    <td className="tabular px-4 py-2.5 text-right">{out > 0 ? <span className="font-medium text-amber-700">{rupiah(out)}</span> : "—"}</td>
                    <td className="tabular px-4 py-2.5 text-right">{c.points}</td>
                  </tr>
                ); })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
