import { pageActor } from "@/server/page";
import { getReport } from "@/server/services/reports";
import { listServices } from "@/server/services/catalog";
import { Card, PageHeader } from "@/components/ui";
import { Stat } from "@/components/stat";
import { ReportChart } from "@/components/charts";
import { rupiah } from "@/lib/money";
import { addDaysKey, localDateKey } from "@/lib/time";
import { PAYMENT_STATUS_LABEL } from "@/lib/status";
import { Download, FileText } from "lucide-react";

export const metadata = { title: "Laporan" };

export default async function ReportPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const actor = await pageActor("reports.view");
  const sp = await searchParams;
  const today = localDateKey();
  const preset = sp.preset ?? (sp.from ? "custom" : "month");
  let from = sp.from, to = sp.to, groupBy = sp.groupBy;
  if (preset === "today") { from = to = today; groupBy ??= "day"; }
  if (preset === "week") { from = addDaysKey(today, -6); to = today; groupBy ??= "day"; }
  if (preset === "month") { from = today.slice(0, 8) + "01"; to = today; groupBy ??= "day"; }
  if (preset === "year") { from = today.slice(0, 5) + "01-01"; to = today; groupBy ??= "month"; }
  const q = { from: from ?? today, to: to ?? today, groupBy: groupBy ?? "day", serviceId: sp.serviceId || undefined, paymentStatus: sp.paymentStatus || undefined };
  const [r, services] = await Promise.all([getReport(actor, q), listServices(true)]);
  const qs = new URLSearchParams(Object.entries(q).filter(([, v]) => v) as [string, string][]).toString();
  const t = r.totals;
  const presetBtn = (k: string, label: string) => <a href={`?preset=${k}`} className={`rounded-md px-2.5 py-1 text-xs font-medium ${preset === k ? "bg-brand-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"}`}>{label}</a>;
  return (
    <div className="space-y-4">
      <PageHeader title="Laporan" subtitle={`Periode ${q.from} s/d ${q.to} · penerimaan dihitung dari waktu pembayaran terkonfirmasi (WIB)`}
        actions={<>
          <a href={`/api/reports/export?format=xlsx&${qs}`} className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium shadow-sm hover:bg-slate-50"><Download className="size-4" />Excel</a>
          <a href={`/api/reports/export?format=pdf&${qs}`} className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium shadow-sm hover:bg-slate-50"><FileText className="size-4" />PDF</a>
        </>} />
      <div className="flex flex-wrap gap-1.5">{presetBtn("today", "Hari ini")}{presetBtn("week", "7 hari")}{presetBtn("month", "Bulan ini")}{presetBtn("year", "Tahun ini")}</div>
      <form className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-white p-3">
        <input type="hidden" name="preset" value="custom" />
        <label className="text-xs text-slate-600">Dari<input type="date" name="from" defaultValue={q.from} className="mt-1 block h-9 rounded-lg border border-slate-300 px-2 text-sm" /></label>
        <label className="text-xs text-slate-600">Sampai<input type="date" name="to" defaultValue={q.to} className="mt-1 block h-9 rounded-lg border border-slate-300 px-2 text-sm" /></label>
        <label className="text-xs text-slate-600">Kelompok<select name="groupBy" defaultValue={q.groupBy} className="mt-1 block h-9 rounded-lg border border-slate-300 px-2 text-sm"><option value="day">Harian</option><option value="week">Mingguan</option><option value="month">Bulanan</option></select></label>
        <label className="text-xs text-slate-600">Layanan<select name="serviceId" defaultValue={q.serviceId ?? ""} className="mt-1 block h-9 rounded-lg border border-slate-300 px-2 text-sm"><option value="">Semua</option>{services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        <label className="text-xs text-slate-600">Status bayar<select name="paymentStatus" defaultValue={q.paymentStatus ?? ""} className="mt-1 block h-9 rounded-lg border border-slate-300 px-2 text-sm"><option value="">Semua</option>{Object.entries(PAYMENT_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <button className="h-9 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700">Terapkan</button>
      </form>
      <p className="text-xs text-slate-500">Filter layanan & status bayar berlaku untuk pesanan, penerimaan, pengembalian, dan piutang; pengeluaran selalu mencakup semua kategori. Ekspor mengikuti filter yang sama.</p>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Nilai pesanan" value={rupiah(t.orderValue)} period={`${t.orders} nota dibuat`} />
        <Stat label="Penerimaan" value={rupiah(t.receipts)} period={`${t.transactions} transaksi`} tone="green" />
        <Stat label="Pengembalian dana" value={rupiah(t.refunds)} period="Periode" tone="amber" />
        <Stat label="Pengeluaran" value={rupiah(t.expenses)} period="Periode" tone="violet" />
        <Stat label="Tunai" value={rupiah(t.cash)} period="Penerimaan" />
        <Stat label="QRIS" value={rupiah(t.qris)} period="Penerimaan" />
        <Stat label="Transfer" value={rupiah(t.transfer)} period="Penerimaan" />
        <Stat label="Piutang pelanggan" value={rupiah(t.receivables)} period={`per ${q.to}`} tone="amber" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Pesanan selesai" value={t.completed} period="Periode" tone="green" />
        <Stat label="Pesanan batal" value={t.cancelled} period="Periode" tone="amber" />
        <Stat label="Bersih (terima − kembali − keluar)" value={rupiah(t.net)} period="Periode" tone="violet" />
      </div>
      <Card title="Penerimaan per metode"><ReportChart data={r.rows} /></Card>
      <Card title="Rincian per periode" padded={false}>
        <div className="overflow-x-auto">
          <table className="tabular w-full text-sm">
            <thead className="bg-slate-50 text-right text-xs text-slate-500"><tr><th className="px-3 py-2 text-left font-medium">Periode</th><th className="px-3 py-2 font-medium">Nota</th><th className="px-3 py-2 font-medium">Nilai pesanan</th><th className="px-3 py-2 font-medium">Tunai</th><th className="px-3 py-2 font-medium">QRIS</th><th className="px-3 py-2 font-medium">Transfer</th><th className="px-3 py-2 font-medium">Penerimaan</th><th className="px-3 py-2 font-medium">Kembali</th><th className="px-3 py-2 font-medium">Selesai</th><th className="px-3 py-2 font-medium">Batal</th><th className="px-3 py-2 font-medium">Operasional</th><th className="px-3 py-2 font-medium">Transportasi</th></tr></thead>
            <tbody className="divide-y divide-slate-100 text-right">
              {r.rows.map((x) => (
                <tr key={x.period} className="hover:bg-slate-50"><td className="px-3 py-2 text-left">{x.period}</td><td className="px-3 py-2">{x.orders}</td><td className="px-3 py-2">{rupiah(x.orderValue)}</td><td className="px-3 py-2">{rupiah(x.cash)}</td><td className="px-3 py-2">{rupiah(x.qris)}</td><td className="px-3 py-2">{rupiah(x.transfer)}</td><td className="px-3 py-2 font-medium">{rupiah(x.receipts)}</td><td className="px-3 py-2">{rupiah(x.refunds)}</td><td className="px-3 py-2">{x.completed}</td><td className="px-3 py-2">{x.cancelled}</td><td className="px-3 py-2">{rupiah(x.expOperational)}</td><td className="px-3 py-2">{rupiah(x.expTransport)}</td></tr>
              ))}
            </tbody>
            <tfoot className="border-t border-slate-200 bg-slate-50 text-right font-semibold"><tr><td className="px-3 py-2 text-left">Total</td><td className="px-3 py-2">{t.orders}</td><td className="px-3 py-2">{rupiah(t.orderValue)}</td><td className="px-3 py-2">{rupiah(t.cash)}</td><td className="px-3 py-2">{rupiah(t.qris)}</td><td className="px-3 py-2">{rupiah(t.transfer)}</td><td className="px-3 py-2">{rupiah(t.receipts)}</td><td className="px-3 py-2">{rupiah(t.refunds)}</td><td className="px-3 py-2">{t.completed}</td><td className="px-3 py-2">{t.cancelled}</td><td className="px-3 py-2">{rupiah(t.expOperational)}</td><td className="px-3 py-2">{rupiah(t.expTransport)}</td></tr></tfoot>
          </table>
        </div>
      </Card>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Piutang pelanggan" padded={false}>
          {r.receivables.length === 0 ? <p className="px-4 py-6 text-center text-sm text-slate-500">Tidak ada piutang.</p> : (
            <ul className="max-h-80 divide-y divide-slate-100 overflow-auto text-sm">{r.receivables.map((x) => <li key={x.customerId} className="flex justify-between px-4 py-2"><a href={`/pelanggan/${x.customerId}`} className="text-brand-700 hover:underline">{x.name} <span className="text-xs text-slate-500">({x.orders} nota)</span></a><span className="tabular font-medium">{rupiah(x.outstanding)}</span></li>)}</ul>
          )}
        </Card>
        <Card title="Pengeluaran per kategori" padded={false}>
          {r.expensesByCategory.length === 0 ? <p className="px-4 py-6 text-center text-sm text-slate-500">Tidak ada pengeluaran.</p> : (
            <ul className="divide-y divide-slate-100 text-sm">{r.expensesByCategory.map((x) => <li key={x.category} className="flex justify-between px-4 py-2"><span>{x.category}</span><span className="tabular">{rupiah(x.amount)}</span></li>)}</ul>
          )}
        </Card>
        <Card title="Kinerja pegawai" padded={false}>
          {r.staff.length === 0 ? <p className="px-4 py-6 text-center text-sm text-slate-500">Belum ada aktivitas.</p> : (
            <table className="tabular w-full text-xs"><thead className="bg-slate-50 text-slate-500"><tr><th className="px-3 py-2 text-left font-medium">Pegawai</th><th className="px-2 py-2 text-right font-medium">Nota</th><th className="px-2 py-2 text-right font-medium">Produksi</th><th className="px-2 py-2 text-right font-medium">Logistik</th><th className="px-3 py-2 text-right font-medium">Terima</th></tr></thead>
              <tbody className="divide-y divide-slate-100">{r.staff.map((s) => <tr key={s.userId}><td className="px-3 py-2">{s.name}</td><td className="px-2 py-2 text-right">{s.ordersCreated}</td><td className="px-2 py-2 text-right">{s.production}</td><td className="px-2 py-2 text-right">{s.logistics}</td><td className="px-3 py-2 text-right">{rupiah(s.paymentsAmount)}</td></tr>)}</tbody></table>
          )}
        </Card>
      </div>
    </div>
  );
}
