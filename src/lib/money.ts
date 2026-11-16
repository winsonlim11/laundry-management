/** Format rupiah: 36500 → "Rp36.500" */
export function rupiah(n: number | null | undefined): string {
  const v = Math.round(Number(n ?? 0));
  const s = Math.abs(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return (v < 0 ? "-Rp" : "Rp") + s;
}

/** Format jumlah: 2.5 → "2,5" ; 3 → "3" */
export function qty(n: number | string): string {
  const v = typeof n === "string" ? Number(n) : n;
  return v.toLocaleString("id-ID", { maximumFractionDigits: 3 });
}
