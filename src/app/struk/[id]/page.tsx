import { notFound } from "next/navigation";
import { pageActor, baseUrl } from "@/server/page";
import { getReceipt } from "@/server/services/receipt";
import { AppError } from "@/server/errors";
import { rupiah, qty } from "@/lib/money";
import { formatDateTime } from "@/lib/time";
import { METHOD_LABEL, PAYMENT_STATUS_LABEL } from "@/lib/status";
import { PrintButton } from "./print-button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Struk" };

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await pageActor("orders.view_all");
  const { id } = await params;
  let r;
  try { r = await getReceipt(actor, Number(id), await baseUrl()); } catch (e) { if (e instanceof AppError) notFound(); throw e; }
  const { settings: s, order: o } = r;
  const w = s.receiptWidth === 80 ? "80mm" : "58mm";
  return (
    <div className="min-h-dvh bg-slate-100 py-6 print:bg-white print:py-0">
      <style>{`@page { size: ${w} auto; margin: 0; } @media print { .receipt { box-shadow: none !important; margin: 0 !important; } }`}</style>
      <div className="no-print mx-auto mb-4 flex max-w-md items-center justify-between px-4 text-sm">
        <a href={`/pesanan/${o.id}`} className="text-slate-600 hover:underline">← Kembali ke nota</a>
        <PrintButton printer={s.printerName} />
      </div>
      <article className="receipt mx-auto bg-white p-3 font-mono text-[11px] leading-snug text-black shadow" style={{ width: w }}>
        <header className="text-center">
          {s.showLogoOnReceipt && s.logoDataUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={s.logoDataUrl} alt="" className="mx-auto mb-1 max-h-12" />
          )}
          <p className="text-sm font-bold">{s.name}</p>
          {s.address && <p>{s.address}</p>}
          {s.whatsapp && <p>WA {s.whatsapp}</p>}
        </header>
        <hr className="my-2 border-dashed border-black" />
        <p>No. Nota : <b>{o.number}</b></p>
        <p>Tanggal  : {formatDateTime(o.createdAt)}</p>
        <p>Pelanggan: {o.customer.name}</p>
        <p>WA       : {o.customer.phone}</p>
        <p>Estimasi : {formatDateTime(o.estimatedDoneAt)}</p>
        <p>Serah    : {o.handover === "ANTAR" ? "Diantar" : "Ambil di toko"}</p>
        <hr className="my-2 border-dashed border-black" />
        {o.items.map((i) => (
          <div key={i.id} className="mb-1">
            <p>{i.serviceName}</p>
            <p className="flex justify-between"><span>{qty(i.quantity.toString())} {i.unit === "KG" ? "kg" : "pcs"} x {rupiah(i.unitPrice)}</span><span>{rupiah(i.lineTotal)}</span></p>
          </div>
        ))}
        <hr className="my-2 border-dashed border-black" />
        <L k="Subtotal" v={rupiah(o.subtotal)} />
        {o.discountAmount > 0 && <L k={`Diskon${o.discountType === "PERCENT" ? ` ${o.discountValue}%` : ""}`} v={`-${rupiah(o.discountAmount)}`} />}
        {o.extraFee > 0 && <L k="Biaya tambahan" v={rupiah(o.extraFee)} />}
        {o.pickupFee > 0 && <L k="Biaya jemput" v={rupiah(o.pickupFee)} />}
        {o.deliveryFee > 0 && <L k="Biaya antar" v={rupiah(o.deliveryFee)} />}
        <L k="TOTAL" v={rupiah(o.total)} b />
        {r.confirmed.map((p) => <L key={p.id} k={`Bayar ${METHOD_LABEL[p.method]} ${formatDateTime(p.confirmedAt)}`} v={rupiah(p.amount)} />)}
        {r.pending.map((p) => <L key={p.id} k={`QRIS (menunggu verifikasi)`} v={rupiah(p.amount)} />)}
        {r.refunds.map((p) => <L key={p.id} k="Pengembalian dana" v={`-${rupiah(p.amount)}`} />)}
        <L k="SISA" v={rupiah(r.remaining)} b />
        <p className="mt-1 text-center font-bold">{o.status === "DIBATALKAN" ? "DIBATALKAN" : PAYMENT_STATUS_LABEL[o.paymentStatus].toUpperCase()}</p>
        {r.qrisSvg && (
          <div className="mt-2 text-center">
            <p>Bayar via QRIS (sisa {rupiah(r.remaining)})</p>
            <div className="mx-auto mt-1 w-28" dangerouslySetInnerHTML={{ __html: r.qrisSvg }} />
          </div>
        )}
        <hr className="my-2 border-dashed border-black" />
        <div className="flex flex-col items-center gap-1">
          <div className="w-24" dangerouslySetInnerHTML={{ __html: r.qrSvg }} aria-label="QR kode nota" />
          <div className="w-full max-w-[48mm] [&>svg]:h-auto [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: r.barcodeSvg }} aria-label="Barcode kode nota" />
          <p className="text-[9px]">Pindai untuk membuka nota (kode {o.refCode})</p>
        </div>
        <hr className="my-2 border-dashed border-black" />
        <p className="text-center">{s.receiptFooter}</p>
        <p className="mt-2 text-center text-[8px] text-neutral-500">Developed by CHIRP DEV</p>
      </article>
    </div>
  );
}

function L({ k, v, b }: { k: string; v: string; b?: boolean }) {
  return <p className={`flex justify-between gap-2 ${b ? "font-bold" : ""}`}><span>{k}</span><span>{v}</span></p>;
}
