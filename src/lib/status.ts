/**
 * ATURAN TRANSISI STATUS PENGERJAAN — satu sumber untuk UI dan server.
 * Jalur pesanan = BARU → MENUNGGU_PROSES → (tahap yang dibutuhkan semua item) → DIKEMAS → SIAP_DIAMBIL
 *                → [ANTAR: DALAM_PENGANTARAN] → SELESAI
 * Tahap yang dibutuhkan = gabungan kebutuhan semua item; pesanan baru "siap" setelah semua tahap itu dilalui.
 */

export type OrderStatusT =
  | "BARU" | "MENUNGGU_PROSES" | "DICUCI" | "DIKERINGKAN" | "DISETRIKA" | "DIKEMAS"
  | "SIAP_DIAMBIL" | "DALAM_PENGANTARAN" | "SELESAI" | "DIBATALKAN";
export type FlowT = "WASH_DRY" | "WASH_IRON" | "IRON_ONLY";
export type HandoverT = "AMBIL_SENDIRI" | "ANTAR";

export const ORDER_STATUS_LABEL: Record<OrderStatusT, string> = {
  BARU: "Baru",
  MENUNGGU_PROSES: "Menunggu Proses",
  DICUCI: "Dicuci",
  DIKERINGKAN: "Dikeringkan",
  DISETRIKA: "Disetrika",
  DIKEMAS: "Dikemas",
  SIAP_DIAMBIL: "Siap Diambil",
  DALAM_PENGANTARAN: "Dalam Pengantaran",
  SELESAI: "Selesai",
  DIBATALKAN: "Dibatalkan",
};

export const FLOW_LABEL: Record<FlowT, string> = {
  WASH_DRY: "Cuci → Kering",
  WASH_IRON: "Cuci → Kering → Setrika",
  IRON_ONLY: "Setrika saja",
};

const FLOW_STAGES: Record<FlowT, OrderStatusT[]> = {
  WASH_DRY: ["DICUCI", "DIKERINGKAN"],
  WASH_IRON: ["DICUCI", "DIKERINGKAN", "DISETRIKA"],
  IRON_ONLY: ["DISETRIKA"],
};

const CANONICAL: OrderStatusT[] = ["DICUCI", "DIKERINGKAN", "DISETRIKA"];

export function orderPath(flows: FlowT[], handover: HandoverT): OrderStatusT[] {
  const needed = new Set(flows.flatMap((f) => FLOW_STAGES[f]));
  const stages = CANONICAL.filter((s) => needed.has(s));
  return [
    "BARU", "MENUNGGU_PROSES", ...stages, "DIKEMAS", "SIAP_DIAMBIL",
    ...(handover === "ANTAR" ? (["DALAM_PENGANTARAN"] as OrderStatusT[]) : []),
    "SELESAI",
  ];
}

/** Status berikutnya yang sah (tanpa pembatalan). null jika sudah final. */
export function nextStatus(current: OrderStatusT, flows: FlowT[], handover: HandoverT): OrderStatusT | null {
  if (current === "SELESAI" || current === "DIBATALKAN") return null;
  const path = orderPath(flows, handover);
  const i = path.indexOf(current);
  if (i === -1) return null;
  return path[i + 1] ?? null;
}

/** Status yang hanya boleh diubah lewat modul pengantaran (bukan tombol produksi). */
export const DELIVERY_CONTROLLED: OrderStatusT[] = ["DALAM_PENGANTARAN"];

export function canTransition(from: OrderStatusT, to: OrderStatusT, flows: FlowT[], handover: HandoverT): boolean {
  if (to === "DIBATALKAN") return from !== "SELESAI" && from !== "DIBATALKAN";
  return nextStatus(from, flows, handover) === to;
}

/** Status "produksi" yang dihitung sebagai antrean aktif. */
export const ACTIVE_PRODUCTION: OrderStatusT[] = ["MENUNGGU_PROSES", "DICUCI", "DIKERINGKAN", "DISETRIKA", "DIKEMAS"];

export const PAYMENT_STATUS_LABEL = { BELUM_BAYAR: "Belum Bayar", SEBAGIAN: "Sebagian/DP", LUNAS: "Lunas" } as const;
export const METHOD_LABEL = { CASH: "Tunai", QRIS: "QRIS", TRANSFER: "Transfer Bank" } as const;
export const PICKUP_STATUS_LABEL = {
  MENUNGGU_DIJEMPUT: "Menunggu Dijemput",
  KURIR_MENUJU_LOKASI: "Kurir Menuju Lokasi",
  SUDAH_DIJEMPUT: "Sudah Dijemput",
  DITERIMA_LAUNDRY: "Diterima Laundry",
  DIBATALKAN: "Dibatalkan",
} as const;
export const DELIVERY_STATUS_LABEL = {
  MENUNGGU_DIANTAR: "Menunggu Diantar",
  DALAM_PENGANTARAN: "Dalam Pengantaran",
  BERHASIL_DIANTAR: "Berhasil Diantar",
  DIBATALKAN: "Dibatalkan",
} as const;

export type PickupStatusT = keyof typeof PICKUP_STATUS_LABEL;
export type DeliveryStatusT = keyof typeof DELIVERY_STATUS_LABEL;

export const PICKUP_NEXT: Partial<Record<PickupStatusT, PickupStatusT>> = {
  MENUNGGU_DIJEMPUT: "KURIR_MENUJU_LOKASI",
  KURIR_MENUJU_LOKASI: "SUDAH_DIJEMPUT",
  SUDAH_DIJEMPUT: "DITERIMA_LAUNDRY",
};
export const DELIVERY_NEXT: Partial<Record<DeliveryStatusT, DeliveryStatusT>> = {
  MENUNGGU_DIANTAR: "DALAM_PENGANTARAN",
  DALAM_PENGANTARAN: "BERHASIL_DIANTAR",
};

export const HISTORY_TRACK_LABEL = { PRODUCTION: "Pengerjaan", PAYMENT: "Pembayaran", PICKUP: "Penjemputan", DELIVERY: "Pengantaran" } as const;

export function statusLabel(track: string, s: string | null | undefined): string {
  if (!s) return "-";
  const maps: Record<string, Record<string, string>> = {
    PRODUCTION: ORDER_STATUS_LABEL,
    PAYMENT: { ...PAYMENT_STATUS_LABEL },
    PICKUP: PICKUP_STATUS_LABEL,
    DELIVERY: DELIVERY_STATUS_LABEL,
  };
  return maps[track]?.[s] ?? s;
}
