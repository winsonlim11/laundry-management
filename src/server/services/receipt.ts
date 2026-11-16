import QRCode from "qrcode";
import bwipjs from "bwip-js/node";
import type { Actor } from "../actor";
import { requirePerm } from "../actor";
import { getOrderForActor } from "./orders";
import { getSettings } from "./settings";

/**
 * Data struk. QR berisi URL nota (/o/<refCode>) dan barcode Code128 berisi refCode.
 * refCode adalah kode referensi nota — TERPISAH dari kode transaksi QRIS (payments.qrisCode).
 * Membuka URL/scan tetap memerlukan login & hak akses.
 */
export async function getReceipt(actor: Actor, orderId: number, baseUrl: string) {
  requirePerm(actor, "orders.view_all");
  const { order } = await getOrderForActor(actor, orderId);
  const settings = await getSettings();
  const confirmed = order.payments.filter((p) => p.kind === "PAYMENT" && p.status === "CONFIRMED");
  const pending = order.payments.filter((p) => p.kind === "PAYMENT" && p.status === "PENDING");
  const refunds = order.payments.filter((p) => p.kind === "REFUND" && p.status === "CONFIRMED");
  const remaining = order.status === "DIBATALKAN" ? 0 : order.total - order.paidAmount;
  const url = `${baseUrl.replace(/\/$/, "")}/o/${order.refCode}`;
  const qrSvg = await QRCode.toString(url, { type: "svg", margin: 0, errorCorrectionLevel: "M", width: 120 });
  const barcodeSvg = bwipjs.toSVG({ bcid: "code128", text: order.refCode, height: 9, includetext: true, textxalign: "center", textsize: 8 });
  let qrisSvg: string | null = null;
  if (settings.qrisStaticPayload && remaining > 0) {
    qrisSvg = await QRCode.toString(settings.qrisStaticPayload, { type: "svg", margin: 0, width: 140 });
  }
  return { settings, order, confirmed, pending, refunds, remaining, url, qrSvg, barcodeSvg, qrisSvg };
}
