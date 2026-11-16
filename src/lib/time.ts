/** Zona waktu bisnis. Asia/Jakarta = UTC+7 tanpa DST. */
export const BUSINESS_TZ = process.env.BUSINESS_TZ || process.env.NEXT_PUBLIC_BUSINESS_TZ || "Asia/Jakarta";

function tzOffsetMinutes(date: Date, tz = BUSINESS_TZ): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(date);
  const g = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUTC = Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"), g("second"));
  return Math.round((asUTC - Math.floor(date.getTime() / 1000) * 1000) / 60000);
}

/** "YYYY-MM-DD" tanggal lokal bisnis dari sebuah instant. */
export function localDateKey(d: Date = new Date(), tz = BUSINESS_TZ): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/** Instant UTC dari awal hari lokal "YYYY-MM-DD". */
export function startOfLocalDay(key: string, tz = BUSINESS_TZ): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) throw new Error("Format tanggal harus YYYY-MM-DD");
  const [y, m, d] = key.split("-").map(Number);
  const guess = new Date(Date.UTC(y, m - 1, d));
  const off = tzOffsetMinutes(guess, tz);
  return new Date(guess.getTime() - off * 60000);
}

export function addDaysKey(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

/** Rentang [from, to) UTC untuk tanggal lokal inklusif fromKey..toKey */
export function localRange(fromKey: string, toKey: string, tz = BUSINESS_TZ): { gte: Date; lt: Date } {
  return { gte: startOfLocalDay(fromKey, tz), lt: startOfLocalDay(addDaysKey(toKey, 1), tz) };
}

export function monthStartKey(key: string): string {
  return key.slice(0, 8) + "01";
}

export function formatDateTime(d: Date | string | null | undefined, tz = BUSINESS_TZ): string {
  if (!d) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: tz, day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(new Date(d));
}

export function formatDate(d: Date | string | null | undefined, tz = BUSINESS_TZ): string {
  if (!d) return "-";
  return new Intl.DateTimeFormat("id-ID", { timeZone: tz, day: "2-digit", month: "short", year: "numeric" }).format(new Date(d));
}

/** Tanggal kalender (kolom DATE) tanpa geser zona waktu. */
export function formatCalendarDate(d: Date | string): string {
  return new Intl.DateTimeFormat("id-ID", { timeZone: "UTC", day: "2-digit", month: "short", year: "numeric" }).format(new Date(d));
}

/** Nilai untuk <input type="datetime-local"> dalam zona bisnis. */
export function toLocalInputValue(d: Date, tz = BUSINESS_TZ): string {
  const off = tzOffsetMinutes(d, tz);
  return new Date(d.getTime() + off * 60000).toISOString().slice(0, 16);
}

export function fromLocalInputValue(v: string, tz = BUSINESS_TZ): Date {
  const [date, time = "00:00"] = v.split("T");
  const base = startOfLocalDay(date, tz);
  const [hh, mm] = time.split(":").map(Number);
  return new Date(base.getTime() + (hh * 60 + mm) * 60000);
}
