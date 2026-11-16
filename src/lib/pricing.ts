/**
 * ATURAN HARGA — satu-satunya implementasi. Dipakai pratinjau kasir (klien) dan server saat menyimpan.
 * - Nominal rupiah bulat (integer).
 * - KG: pecahan positif, maks. 3 desimal. PCS: bilangan bulat positif.
 * - Pembulatan ke rupiah terdekat, setengah ke atas.
 * - Semua perhitungan memakai integer (jumlah disimpan dalam "mili" = ×1000) agar bebas galat float.
 */

export type UnitT = "KG" | "PCS";
export type DiscountTypeT = "NONE" | "NOMINAL" | "PERCENT";

export class PricingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PricingError";
  }
}

/** Ubah input jumlah (string/angka, koma atau titik) → mili-unit integer. Lempar PricingError bila tidak sah. */
export function parseQuantity(input: string | number, unit: UnitT): number {
  const raw = String(input).trim().replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(raw)) throw new PricingError("Jumlah harus berupa angka positif.");
  const [intPart, frac = ""] = raw.split(".");
  if (unit === "PCS" && frac.replace(/0+$/, "").length > 0)
    throw new PricingError("Jumlah PCS harus bilangan bulat.");
  if (frac.replace(/0+$/, "").length > 3) throw new PricingError("Berat maksimal 3 angka desimal.");
  const milli = Number(intPart) * 1000 + Number((frac + "000").slice(0, 3));
  if (!Number.isSafeInteger(milli) || milli <= 0) throw new PricingError("Jumlah harus lebih dari 0.");
  if (milli > 9_999_999_999) throw new PricingError("Jumlah terlalu besar.");
  return milli;
}

export function milliToString(milli: number): string {
  const i = Math.floor(milli / 1000);
  const f = (milli % 1000).toString().padStart(3, "0").replace(/0+$/, "");
  return f ? `${i}.${f}` : `${i}`;
}

/** round-half-up untuk pembagian integer non-negatif: round(a / b) */
export function divRoundHalfUp(a: number, b: number): number {
  if (a < 0 || b <= 0) throw new PricingError("Nilai tidak valid.");
  return Math.floor((a * 2 + b) / (2 * b));
}

export function lineTotal(unitPrice: number, quantityMilli: number): number {
  assertMoney(unitPrice, "Tarif");
  return divRoundHalfUp(unitPrice * quantityMilli, 1000);
}

export function assertMoney(v: number, label: string) {
  if (!Number.isInteger(v)) throw new PricingError(`${label} harus berupa rupiah bulat.`);
  if (v < 0) throw new PricingError(`${label} tidak boleh negatif.`);
}

export interface BillInput {
  lines: { unitPrice: number; quantityMilli: number }[];
  discountType: DiscountTypeT;
  discountValue: number; // rupiah untuk NOMINAL, persen (0–100) untuk PERCENT
  extraFee: number;
  pickupFee: number;
  deliveryFee: number;
}

export interface Bill {
  lineTotals: number[];
  subtotal: number;
  discountAmount: number;
  extraFee: number;
  pickupFee: number;
  deliveryFee: number;
  total: number;
}

export function computeBill(input: BillInput): Bill {
  if (input.lines.length === 0) throw new PricingError("Nota harus memuat minimal satu layanan.");
  const lineTotals = input.lines.map((l) => lineTotal(l.unitPrice, l.quantityMilli));
  const subtotal = lineTotals.reduce((a, b) => a + b, 0);
  assertMoney(input.extraFee, "Biaya tambahan");
  assertMoney(input.pickupFee, "Biaya jemput");
  assertMoney(input.deliveryFee, "Biaya antar");
  let discountAmount = 0;
  if (input.discountType === "NOMINAL") {
    assertMoney(input.discountValue, "Diskon");
    discountAmount = input.discountValue;
  } else if (input.discountType === "PERCENT") {
    if (!Number.isInteger(input.discountValue) || input.discountValue < 0 || input.discountValue > 100)
      throw new PricingError("Diskon persen harus bilangan bulat 0–100.");
    discountAmount = divRoundHalfUp(subtotal * input.discountValue, 100);
  }
  if (discountAmount > subtotal) throw new PricingError("Diskon melebihi subtotal layanan.");
  const total = subtotal - discountAmount + input.extraFee + input.pickupFee + input.deliveryFee;
  return {
    lineTotals,
    subtotal,
    discountAmount,
    extraFee: input.extraFee,
    pickupFee: input.pickupFee,
    deliveryFee: input.deliveryFee,
    total,
  };
}

/** Status bayar diturunkan dari pembayaran terkonfirmasi terhadap tagihan. */
export function derivePaymentStatus(total: number, paid: number): "BELUM_BAYAR" | "SEBAGIAN" | "LUNAS" {
  if (paid <= 0) return total === 0 ? "LUNAS" : "BELUM_BAYAR";
  if (paid >= total) return "LUNAS";
  return "SEBAGIAN";
}
