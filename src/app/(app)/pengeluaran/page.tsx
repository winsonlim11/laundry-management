import { Wallet } from "lucide-react";
import { pageActor } from "@/server/page";
import { listExpenses, EXPENSE_CATEGORIES } from "@/server/services/expenses";
import { Card, Empty, PageHeader } from "@/components/ui";
import { rupiah } from "@/lib/money";
import { formatCalendarDate, localDateKey } from "@/lib/time";
import { ExpenseForm, DeleteExpense } from "./form";

export const metadata = { title: "Pengeluaran" };

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const actor = await pageActor("expenses.manage");
  const sp = await searchParams;
  const today = localDateKey();
  const from = sp.from ?? today.slice(0, 8) + "01", to = sp.to ?? today;
  const list = await listExpenses(actor, from, to);
  const total = list.reduce((a, e) => a + e.amount, 0);
  return (
    <div className="space-y-4">
      <PageHeader title="Pengeluaran" subtitle="Pengeluaran operasional & transportasi. Ongkos kurir tercatat otomatis saat tugas selesai." />
      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <Card title="Catat pengeluaran"><ExpenseForm categories={EXPENSE_CATEGORIES} today={today} /></Card>
        <Card title={`Daftar · ${rupiah(total)}`} padded={false} actions={
          <form className="flex items-center gap-1 text-xs">
            <input type="date" name="from" defaultValue={from} aria-label="Dari" className="h-8 rounded-md border border-slate-300 px-1.5" />
            <span>–</span>
            <input type="date" name="to" defaultValue={to} aria-label="Sampai" className="h-8 rounded-md border border-slate-300 px-1.5" />
            <button className="h-8 rounded-md border border-slate-300 bg-white px-2 font-medium">OK</button>
          </form>}>
          {list.length === 0 ? <Empty icon={<Wallet className="size-8" />} title="Belum ada pengeluaran pada periode ini" /> : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs text-slate-500"><tr><th className="px-4 py-2 font-medium">Tanggal</th><th className="px-4 py-2 font-medium">Kategori</th><th className="px-4 py-2 font-medium">Keterangan</th><th className="px-4 py-2 text-right font-medium">Nominal</th><th /></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {list.map((e) => <tr key={e.id}><td className="px-4 py-2 text-xs">{formatCalendarDate(e.date)}</td><td className="px-4 py-2">{e.category}</td><td className="px-4 py-2 text-slate-600">{e.description}</td><td className="tabular px-4 py-2 text-right">{rupiah(e.amount)}</td><td className="px-2 py-2 text-right"><DeleteExpense id={e.id} /></td></tr>)}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </div>
  );
}
