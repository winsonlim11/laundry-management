import { Badge } from "./ui";
import { DELIVERY_STATUS_LABEL, ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL, PICKUP_STATUS_LABEL } from "@/lib/status";

const ORDER_TONE: Record<string, string> = {
  BARU: "violet", MENUNGGU_PROSES: "amber", DICUCI: "blue", DIKERINGKAN: "blue", DISETRIKA: "blue", DIKEMAS: "blue",
  SIAP_DIAMBIL: "green", DALAM_PENGANTARAN: "amber", SELESAI: "gray", DIBATALKAN: "red",
};
export function OrderStatusBadge({ s }: { s: string }) {
  return <Badge tone={ORDER_TONE[s]}>{ORDER_STATUS_LABEL[s as keyof typeof ORDER_STATUS_LABEL] ?? s}</Badge>;
}
export function PayBadge({ s }: { s: string }) {
  return <Badge tone={s === "LUNAS" ? "green" : s === "SEBAGIAN" ? "amber" : "red"}>{PAYMENT_STATUS_LABEL[s as keyof typeof PAYMENT_STATUS_LABEL] ?? s}</Badge>;
}
export function TaskBadge({ s }: { s: string }) {
  const label = (PICKUP_STATUS_LABEL as Record<string, string>)[s] ?? (DELIVERY_STATUS_LABEL as Record<string, string>)[s] ?? s;
  const tone = ["DITERIMA_LAUNDRY", "BERHASIL_DIANTAR"].includes(s) ? "green" : s === "DIBATALKAN" ? "red" : s.startsWith("MENUNGGU") ? "violet" : "amber";
  return <Badge tone={tone}>{label}</Badge>;
}
export function TxBadge({ s, kind }: { s: string; kind?: string }) {
  if (kind === "REFUND") return <Badge tone="red">Pengembalian</Badge>;
  return <Badge tone={s === "CONFIRMED" ? "green" : s === "PENDING" ? "amber" : "red"}>{s === "CONFIRMED" ? "Terkonfirmasi" : s === "PENDING" ? "Menunggu verifikasi" : "Ditolak"}</Badge>;
}
