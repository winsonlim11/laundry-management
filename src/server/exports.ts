import ExcelJS from "exceljs";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { Report } from "./services/reports";
import { rupiah } from "@/lib/money";
import { PAYMENT_STATUS_LABEL } from "@/lib/status";

const GROUP_LABEL = { day: "Harian", week: "Mingguan", month: "Bulanan" } as const;

export function reportFilterText(r: Report, serviceName?: string) {
  const parts = [`Periode ${r.query.from} s/d ${r.query.to}`, `Kelompok: ${GROUP_LABEL[r.query.groupBy]}`];
  if (serviceName) parts.push(`Layanan: ${serviceName}`);
  if (r.query.paymentStatus) parts.push(`Status bayar: ${PAYMENT_STATUS_LABEL[r.query.paymentStatus]}`);
  return parts.join(" | ");
}

const COLS: { key: keyof Report["rows"][number]; label: string; money?: boolean }[] = [
  { key: "period", label: "Periode" },
  { key: "orders", label: "Pesanan" },
  { key: "orderValue", label: "Nilai Pesanan", money: true },
  { key: "cash", label: "Tunai", money: true },
  { key: "qris", label: "QRIS", money: true },
  { key: "transfer", label: "Transfer", money: true },
  { key: "receipts", label: "Penerimaan", money: true },
  { key: "refunds", label: "Pengembalian", money: true },
  { key: "transactions", label: "Transaksi" },
  { key: "completed", label: "Selesai" },
  { key: "cancelled", label: "Batal" },
  { key: "expOperational", label: "Peng. Operasional", money: true },
  { key: "expTransport", label: "Peng. Transportasi", money: true },
  { key: "net", label: "Bersih", money: true },
];

export async function reportToXlsx(r: Report, businessName: string, serviceName?: string): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = businessName;
  const ws = wb.addWorksheet("Ringkasan");
  ws.addRow([`Laporan ${businessName}`]).font = { bold: true, size: 14 };
  ws.addRow([reportFilterText(r, serviceName)]);
  ws.addRow([]);
  const header = ws.addRow(COLS.map((c) => c.label));
  header.font = { bold: true };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDBEAFE" } };
  for (const row of r.rows) ws.addRow(COLS.map((c) => row[c.key]));
  const t = r.totals as Record<string, number>;
  const totalRow = ws.addRow(COLS.map((c, i) => (i === 0 ? "TOTAL" : t[c.key as string] ?? "")));
  totalRow.font = { bold: true };
  COLS.forEach((c, i) => {
    ws.getColumn(i + 1).width = i === 0 ? 14 : 16;
    if (c.money) ws.getColumn(i + 1).numFmt = '"Rp"#,##0';
  });
  ws.addRow([]);
  ws.addRow(["Piutang pelanggan (per akhir periode)", r.totals.receivables]).font = { bold: true };
  ws.getCell(`B${ws.rowCount}`).numFmt = '"Rp"#,##0';

  const ws2 = wb.addWorksheet("Piutang");
  ws2.addRow(["Pelanggan", "WhatsApp", "Jumlah Nota", "Sisa Tagihan"]).font = { bold: true };
  for (const x of r.receivables) ws2.addRow([x.name, x.phone, x.orders, x.outstanding]);
  ws2.getColumn(4).numFmt = '"Rp"#,##0';
  ws2.columns.forEach((c) => (c.width = 22));

  const ws3 = wb.addWorksheet("Pengeluaran");
  ws3.addRow(["Kategori", "Nominal"]).font = { bold: true };
  for (const x of r.expensesByCategory) ws3.addRow([x.category, x.amount]);
  ws3.addRow(["TOTAL", r.totals.expenses]).font = { bold: true };
  ws3.getColumn(2).numFmt = '"Rp"#,##0';
  ws3.columns.forEach((c) => (c.width = 28));

  const ws4 = wb.addWorksheet("Kinerja Pegawai");
  ws4.addRow(["Pegawai", "Nota Dibuat", "Update Produksi", "Update Jemput/Antar", "Pembayaran Diterima", "Nominal Diterima"]).font = { bold: true };
  for (const s of r.staff) ws4.addRow([s.name, s.ordersCreated, s.production, s.logistics, s.paymentsCount, s.paymentsAmount]);
  ws4.getColumn(6).numFmt = '"Rp"#,##0';
  ws4.columns.forEach((c) => (c.width = 20));

  return Buffer.from(await wb.xlsx.writeBuffer());
}

export async function reportToPdf(r: Report, businessName: string, serviceName?: string): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const W = 842, H = 595, M = 30; // A4 landscape
  let page = pdf.addPage([W, H]);
  let y = H - M;
  const text = (p: PDFPage, s: string, x: number, yy: number, f: PDFFont = font, size = 8, color = rgb(0.1, 0.1, 0.15)) =>
    p.drawText(s, { x, y: yy, size, font: f, color });

  text(page, `Laporan ${businessName}`, M, y, bold, 14); y -= 18;
  text(page, reportFilterText(r, serviceName), M, y, font, 9); y -= 20;

  const cols = COLS;
  const colW = (W - 2 * M) / cols.length;
  const drawHeader = () => {
    page.drawRectangle({ x: M, y: y - 4, width: W - 2 * M, height: 14, color: rgb(0.86, 0.92, 0.99) });
    cols.forEach((c, i) => text(page, c.label, M + i * colW + 2, y, bold, 6.5));
    y -= 14;
  };
  drawHeader();
  const fmt = (c: (typeof COLS)[number], v: unknown) => (c.money ? rupiah(Number(v)) : String(v));
  for (const row of r.rows) {
    if (y < M + 40) { page = pdf.addPage([W, H]); y = H - M; drawHeader(); }
    cols.forEach((c, i) => text(page, fmt(c, row[c.key]), M + i * colW + 2, y, font, 7));
    y -= 12;
  }
  const t = r.totals as Record<string, number>;
  page.drawLine({ start: { x: M, y: y + 8 }, end: { x: W - M, y: y + 8 }, thickness: 0.5 });
  cols.forEach((c, i) => text(page, i === 0 ? "TOTAL" : fmt(c, t[c.key as string] ?? 0), M + i * colW + 2, y, bold, 7));
  y -= 22;

  const section = (title: string, lines: [string, string][]) => {
    if (y < M + 30 + lines.length * 11) { page = pdf.addPage([W, H]); y = H - M; }
    text(page, title, M, y, bold, 10); y -= 14;
    for (const [a, b] of lines) {
      if (y < M + 20) { page = pdf.addPage([W, H]); y = H - M; }
      text(page, a, M, y, font, 8); text(page, b, M + 300, y, font, 8); y -= 11;
    }
    y -= 8;
  };
  section("Ringkasan", [
    ["Nilai pesanan", rupiah(r.totals.orderValue)],
    ["Penerimaan (Tunai / QRIS / Transfer)", `${rupiah(r.totals.receipts)} (${rupiah(r.totals.cash)} / ${rupiah(r.totals.qris)} / ${rupiah(r.totals.transfer)})`],
    ["Pengembalian dana", rupiah(r.totals.refunds)],
    ["Pengeluaran (Operasional / Transportasi)", `${rupiah(r.totals.expenses)} (${rupiah(r.totals.expOperational)} / ${rupiah(r.totals.expTransport)})`],
    ["Piutang pelanggan (per akhir periode)", rupiah(r.totals.receivables)],
  ]);
  if (r.receivables.length) section("Piutang pelanggan", r.receivables.slice(0, 40).map((x) => [`${x.name} (${x.phone}) — ${x.orders} nota`, rupiah(x.outstanding)]));
  if (r.expensesByCategory.length) section("Pengeluaran per kategori", r.expensesByCategory.map((x) => [x.category, rupiah(x.amount)]));
  if (r.staff.length) section("Kinerja pegawai", r.staff.map((s) => [s.name, `Nota ${s.ordersCreated} · Produksi ${s.production} · Logistik ${s.logistics} · Bayar ${s.paymentsCount} (${rupiah(s.paymentsAmount)})`]));

  const pages = pdf.getPages();
  pages.forEach((p, i) => text(p, `Halaman ${i + 1}/${pages.length} · Developed by CHIRP DEV`, M, 14, font, 7, rgb(0.5, 0.5, 0.55)));
  return Buffer.from(await pdf.save());
}
