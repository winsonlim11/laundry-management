"use client";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { rupiah } from "@/lib/money";

const short = (d: string) => { const [, m, day] = d.split("-"); return `${Number(day)}/${Number(m)}`; };
const compact = (v: number) => (v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}jt` : v >= 1000 ? `${Math.round(v / 1000)}rb` : String(v));

export function RevenueChart({ data }: { data: { date: string; Penerimaan: number }[] }) {
  return (
    <div className="h-64" role="img" aria-label="Grafik penerimaan harian">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#eef2f7" />
          <XAxis dataKey="date" tickFormatter={short} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={compact} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} width={44} />
          <Tooltip formatter={(v) => rupiah(Number(v))} labelFormatter={(l) => `Tanggal ${l}`} cursor={{ fill: "#eff6ff" }} />
          <Bar dataKey="Penerimaan" fill="#2563eb" radius={[4, 4, 0, 0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function OrdersChart({ data }: { data: { date: string; Pesanan: number; Selesai: number }[] }) {
  return (
    <div className="h-64" role="img" aria-label="Grafik statistik pesanan">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#eef2f7" />
          <XAxis dataKey="date" tickFormatter={short} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} width={30} />
          <Tooltip labelFormatter={(l) => `Tanggal ${l}`} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line type="monotone" dataKey="Pesanan" name="Pesanan dibuat" stroke="#2563eb" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="Selesai" name="Pesanan selesai" stroke="#10b981" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ReportChart({ data }: { data: { period: string; cash: number; qris: number; transfer: number }[] }) {
  return (
    <div className="h-72" role="img" aria-label="Grafik penerimaan per metode">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#eef2f7" />
          <XAxis dataKey="period" tickFormatter={short} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={compact} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} width={44} />
          <Tooltip formatter={(v) => rupiah(Number(v))} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="cash" name="Tunai" stackId="a" fill="#1d4ed8" />
          <Bar dataKey="qris" name="QRIS" stackId="a" fill="#60a5fa" />
          <Bar dataKey="transfer" name="Transfer" stackId="a" fill="#93c5fd" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
