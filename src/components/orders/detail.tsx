"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Ban, CheckCircle2, MessageCircle, Printer, Truck, Undo2, UserCheck, Wallet } from "lucide-react";
import { Alert, Badge, Button, Card, Field, Input, Modal, Select, Textarea, cx, useToast } from "../ui";
import { OrderStatusBadge, PayBadge, TaskBadge, TxBadge } from "../status-badge";
import { apiFetch, newKey } from "@/lib/client";
import { rupiah, qty } from "@/lib/money";
import { formatDateTime, toLocalInputValue, fromLocalInputValue } from "@/lib/time";
import { HISTORY_TRACK_LABEL, METHOD_LABEL, ORDER_STATUS_LABEL, statusLabel, type OrderStatusT } from "@/lib/status";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Order = any;

export function OrderDetailView({ order, financial, isNew, path, next, operators, couriers, waUrl, perms, defaults }: {
  order: Order; financial: boolean; isNew: boolean; path: OrderStatusT[]; next: OrderStatusT | null;
  operators: { id: number; name: string }[]; couriers: { id: number; name: string }[]; waUrl: string;
  perms: Record<"pay" | "confirm" | "cancel" | "refund" | "assign" | "logistics" | "produce" | "handover" | "print", boolean>;
  defaults: { deliveryFee: number };
}) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const [deliveryOpen, setDeliveryOpen] = useState(false);

  const remaining = order.status === "DIBATALKAN" ? 0 : order.total - order.paidAmount;
  const refundable = order.paidAmount - order.refundedAmount;
  const final = order.status === "SELESAI" || order.status === "DIBATALKAN";

  async function act(label: string, fn: () => Promise<unknown>, ok: string) {
    setErr(null); setBusy(label);
    try { await fn(); toast("green", ok); router.refresh(); } catch (e) { setErr((e as Error).message); toast("red", (e as Error).message); }
    setBusy(null);
  }

  const isHandover = order.status === "SIAP_DIAMBIL" && next === "SELESAI";
  const canAdvance = next && next !== "DALAM_PENGANTARAN" && !(order.handover === "ANTAR" && next === "SELESAI") && (isHandover ? perms.handover : perms.produce);
  const stepIdx = path.indexOf(order.status);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href={financial ? "/pesanan" : "/produksi"} className="mb-1 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800"><ArrowLeft className="size-3" /> Kembali</Link>
          <h1 className="flex flex-wrap items-center gap-2 text-xl font-semibold tracking-tight">
            <span className="font-mono">{order.number}</span><OrderStatusBadge s={order.status} />{financial && <PayBadge s={order.paymentStatus} />}
          </h1>
          <p className="text-sm text-slate-500">Dibuat {formatDateTime(order.createdAt)} · Estimasi selesai {formatDateTime(order.estimatedDoneAt)} · Kode nota <span className="font-mono">{order.refCode}</span></p>
        </div>
        <div className="flex flex-wrap gap-2">
          {perms.print && <a href={`/struk/${order.id}`} target="_blank" rel="noopener" className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium shadow-sm hover:bg-slate-50"><Printer className="size-4" /> Cetak struk</a>}
          {financial && <a href={waUrl} target="_blank" rel="noopener" className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium shadow-sm hover:bg-slate-50"><MessageCircle className="size-4 text-emerald-600" /> Buka WhatsApp</a>}
        </div>
      </div>
      {isNew && <Alert tone="green">Nota tersimpan. <a className="font-medium underline" href={`/struk/${order.id}`} target="_blank" rel="noopener">Cetak struk sekarang</a>.</Alert>}
      {order.status === "SELESAI" && remaining > 0 && <Alert tone="amber">Pesanan sudah diserahkan, tetapi masih ada sisa tagihan {rupiah(remaining)}.</Alert>}
      {order.status === "DIBATALKAN" && <Alert>Dibatalkan {formatDateTime(order.cancelledAt)} — {order.cancelReason}</Alert>}
      {err && <Alert>{err}</Alert>}

      {/* progres tahapan */}
      <Card>
        <ol className="flex flex-wrap items-center gap-y-2 text-xs" aria-label="Tahapan pengerjaan">
          {path.map((s, i) => (
            <li key={s} className="flex items-center">
              <span className={cx("flex items-center gap-1.5 rounded-full px-2.5 py-1", order.status === "DIBATALKAN" ? "text-slate-400" : i < stepIdx ? "text-emerald-700" : i === stepIdx ? "bg-brand-600 font-medium text-white" : "text-slate-400")} aria-current={i === stepIdx ? "step" : undefined}>
                {i < stepIdx && order.status !== "DIBATALKAN" ? <CheckCircle2 className="size-3.5" /> : <span className="size-1.5 rounded-full bg-current" />}{ORDER_STATUS_LABEL[s]}
              </span>
              {i < path.length - 1 && <span className="mx-1 h-px w-4 bg-slate-200" aria-hidden />}
            </li>
          ))}
        </ol>
        <div className="mt-3 flex flex-wrap gap-2">
          {canAdvance && next && (
            <Button size="lg" loading={busy === "adv"} icon={isHandover ? <UserCheck className="size-4" /> : <CheckCircle2 className="size-4" />}
              onClick={() => act("adv", () => apiFetch(`/api/orders/${order.id}/status`, { body: { to: next } }), `Status: ${ORDER_STATUS_LABEL[next]}`)}>
              {isHandover ? "Serahkan ke pelanggan (Selesai)" : `Lanjut ke "${ORDER_STATUS_LABEL[next]}"`}
            </Button>
          )}
          {order.handover === "ANTAR" && order.status === "SIAP_DIAMBIL" && <p className="self-center text-xs text-slate-500">Pesanan antar: kurir memulai pengantaran dari layar Tugas Kurir.</p>}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          <Card title={`Item (${order.items.length})`} padded={false}>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs text-slate-500"><tr><th className="px-4 py-2 font-medium">Layanan</th><th className="px-4 py-2 text-right font-medium">Jumlah</th>{financial && <><th className="px-4 py-2 text-right font-medium">Tarif</th><th className="px-4 py-2 text-right font-medium">Nilai</th></>}</tr></thead>
              <tbody className="divide-y divide-slate-100">
                {order.items.map((i: any) => (
                  <tr key={i.id}><td className="px-4 py-2">{i.serviceName}{i.express && <Badge tone="amber">Express</Badge>}{i.notes && <div className="text-xs text-slate-500">{i.notes}</div>}</td><td className="tabular px-4 py-2 text-right">{qty(i.quantity)} {i.unit === "KG" ? "kg" : "pcs"}</td>{financial && <><td className="tabular px-4 py-2 text-right">{rupiah(i.unitPrice)}</td><td className="tabular px-4 py-2 text-right">{rupiah(i.lineTotal)}</td></>}</tr>
                ))}
              </tbody>
            </table>
            {financial && (
              <dl className="tabular space-y-1 border-t border-slate-100 px-4 py-3 text-sm">
                <Row k="Subtotal" v={rupiah(order.subtotal)} />
                {order.discountAmount > 0 && <Row k={`Diskon${order.discountType === "PERCENT" ? ` ${order.discountValue}%` : ""}`} v={`−${rupiah(order.discountAmount)}`} />}
                {order.extraFee > 0 && <Row k={`Biaya tambahan${order.extraFeeNote ? ` (${order.extraFeeNote})` : ""}`} v={rupiah(order.extraFee)} />}
                {order.pickupFee > 0 && <Row k="Biaya jemput" v={rupiah(order.pickupFee)} />}
                {order.deliveryFee > 0 && <Row k="Biaya antar" v={rupiah(order.deliveryFee)} />}
                <Row k="Total tagihan" v={rupiah(order.total)} strong />
                <Row k="Dibayar (terkonfirmasi)" v={rupiah(order.paidAmount)} />
                {order.refundedAmount > 0 && <Row k="Dikembalikan" v={`−${rupiah(order.refundedAmount)}`} />}
                <Row k="Sisa tagihan" v={rupiah(remaining)} strong />
              </dl>
            )}
            {order.notes && <p className="border-t border-slate-100 px-4 py-2 text-xs text-slate-600">Catatan: {order.notes}</p>}
          </Card>

          {financial && (
            <Card title="Riwayat transaksi" padded={false} actions={perms.pay && remaining > 0 && <Button size="sm" icon={<Wallet className="size-3.5" />} onClick={() => setPayOpen(true)}>Terima pembayaran</Button>}>
              {order.payments.length === 0 ? <p className="px-4 py-6 text-center text-sm text-slate-500">Belum ada pembayaran.</p> : (
                <ul className="divide-y divide-slate-100">
                  {order.payments.map((p: any) => (
                    <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
                      <div>
                        <p className="font-medium">{p.kind === "REFUND" ? "Pengembalian dana" : "Pembayaran"} · {METHOD_LABEL[p.method as keyof typeof METHOD_LABEL]}</p>
                        <p className="text-xs text-slate-500">{formatDateTime(p.confirmedAt ?? p.createdAt)}{p.qrisCode ? ` · ${p.qrisCode}` : ""}{p.note ? ` · ${p.note}` : ""}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <TxBadge s={p.status} kind={p.kind} />
                        <span className={cx("tabular font-medium", p.kind === "REFUND" && "text-red-600")}>{p.kind === "REFUND" ? "−" : ""}{rupiah(p.amount)}</span>
                        {p.status === "PENDING" && perms.confirm && (
                          <>
                            <Button size="sm" variant="success" loading={busy === `c${p.id}`} onClick={() => act(`c${p.id}`, () => apiFetch(`/api/payments/${p.id}/confirm`, { method: "POST" }), "Pembayaran dikonfirmasi.")}>Verifikasi</Button>
                            <Button size="sm" variant="secondary" loading={busy === `r${p.id}`} onClick={() => act(`r${p.id}`, () => apiFetch(`/api/payments/${p.id}/reject`, { body: {} }), "Pembayaran ditolak.")}>Tolak</Button>
                          </>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}

          <Card title="Timeline">
            <ol className="relative space-y-3 border-l border-slate-200 pl-4">
              {order.history.map((h: any) => (
                <li key={h.id} className="text-sm">
                  <span className={cx("absolute -left-[5px] mt-1.5 size-2.5 rounded-full ring-2 ring-white", { PRODUCTION: "bg-brand-500", PAYMENT: "bg-emerald-500", PICKUP: "bg-violet-500", DELIVERY: "bg-amber-500" }[h.track as string])} aria-hidden />
                  <p><span className="text-xs font-medium text-slate-500">{HISTORY_TRACK_LABEL[h.track as keyof typeof HISTORY_TRACK_LABEL]}</span> · <span className="font-medium">{h.fromStatus && h.fromStatus !== h.toStatus ? `${statusLabel(h.track, h.fromStatus)} → ` : ""}{statusLabel(h.track, h.toStatus)}</span></p>
                  <p className="text-xs text-slate-500">{formatDateTime(h.createdAt)} · {h.userName ?? "Sistem"}{h.note ? ` · ${h.note}` : ""}</p>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Pelanggan">
            <p className="font-medium">{financial ? <Link className="text-brand-700 hover:underline" href={`/pelanggan/${order.customer.id}`}>{order.customer.name}</Link> : order.customer.name}</p>
            {financial && <p className="text-sm text-slate-600">WA {order.customer.phone}</p>}
            {order.customer.address && financial && <p className="text-sm text-slate-600">{order.customer.address}</p>}
            <p className="mt-2 text-xs text-slate-500">Serah terima: <span className="font-medium text-slate-700">{order.handover === "ANTAR" ? "Diantar kurir" : "Ambil sendiri di toko"}</span></p>
          </Card>

          {perms.assign && !final && (
            <Card title="Operator">
              <Select aria-label="Operator" defaultValue={order.assignedOperatorId ?? ""} disabled={busy === "asg"} onChange={(e) => act("asg", () => apiFetch(`/api/orders/${order.id}/assign`, { body: { operatorId: e.target.value ? Number(e.target.value) : null } }), "Operator diperbarui.")}>
                <option value="">— Belum ditugaskan —</option>
                {operators.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </Select>
            </Card>
          )}

          {(order.delivery || (perms.logistics && !final)) && (
            <Card title="Pengantaran" actions={<Truck className="size-4 text-slate-400" />}>
              {order.delivery && order.delivery.status !== "DIBATALKAN" ? (
                <div className="space-y-1 text-sm">
                  <p className="flex items-center justify-between"><span className="font-mono text-xs">{order.delivery.number}</span><TaskBadge s={order.delivery.status} /></p>
                  <p className="text-slate-600">{order.delivery.address}</p>
                  <p className="text-xs text-slate-500">Jadwal {formatDateTime(order.delivery.scheduledAt)} · Kurir {order.delivery.courier?.user?.name ?? "belum ditentukan"}</p>
                  {financial && <p className="text-xs text-slate-500">Ongkos kurir {rupiah(order.delivery.courierPay)} (dicatat sebagai pengeluaran saat terkirim)</p>}
                  {perms.logistics && <Link href={`/kurir/delivery/${order.delivery.id}`} className="text-xs font-medium text-brand-700 hover:underline">Buka tugas antar →</Link>}
                </div>
              ) : (
                <Button variant="secondary" className="w-full" icon={<Truck className="size-4" />} onClick={() => setDeliveryOpen(true)}>Jadwalkan antar</Button>
              )}
            </Card>
          )}

          {order.pickup && (
            <Card title="Penjemputan">
              <p className="flex items-center justify-between text-sm"><span className="font-mono text-xs">{order.pickup.number}</span><TaskBadge s={order.pickup.status} /></p>
            </Card>
          )}

          {financial && (perms.cancel || perms.refund) && (
            <Card title="Tindakan lain">
              <div className="space-y-2">
                {perms.cancel && !final && <Button variant="secondary" className="w-full text-red-700" icon={<Ban className="size-4" />} onClick={() => setCancelOpen(true)}>Batalkan pesanan</Button>}
                {perms.refund && order.status === "DIBATALKAN" && refundable > 0 && <Button variant="secondary" className="w-full" icon={<Undo2 className="size-4" />} onClick={() => setRefundOpen(true)}>Catat pengembalian dana ({rupiah(refundable)})</Button>}
                {order.status === "DIBATALKAN" && refundable <= 0 && <p className="text-xs text-slate-500">Tidak ada dana yang perlu dikembalikan.</p>}
              </div>
            </Card>
          )}
        </div>
      </div>

      <PaymentModal open={payOpen} onClose={() => setPayOpen(false)} orderId={order.id} remaining={remaining} onDone={() => { setPayOpen(false); router.refresh(); }} />
      <CancelModal open={cancelOpen} onClose={() => setCancelOpen(false)} orderId={order.id} paid={order.paidAmount} canRefund={perms.refund} onDone={() => { setCancelOpen(false); router.refresh(); }} />
      <RefundModal open={refundOpen} onClose={() => setRefundOpen(false)} orderId={order.id} max={refundable} onDone={() => { setRefundOpen(false); router.refresh(); }} />
      <DeliveryModal open={deliveryOpen} onClose={() => setDeliveryOpen(false)} order={order} couriers={couriers} defaultFee={defaults.deliveryFee} onDone={() => { setDeliveryOpen(false); router.refresh(); }} />
    </div>
  );
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return <div className={cx("flex justify-between", strong && "font-semibold")}><dt className="text-slate-600">{k}</dt><dd>{v}</dd></div>;
}

function PaymentModal({ open, onClose, orderId, remaining, onDone }: { open: boolean; onClose: () => void; orderId: number; remaining: number; onDone: () => void }) {
  const toast = useToast();
  const [method, setMethod] = useState<"CASH" | "QRIS" | "TRANSFER">("CASH");
  const [amount, setAmount] = useState(String(remaining));
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [key, setKey] = useState(newKey);
  const n = Number(amount || 0);
  async function submit() {
    setErr(null); setSaving(true);
    try {
      const r = await apiFetch<{ payment: { status: string }; duplicate: boolean }>(`/api/orders/${orderId}/payments`, { body: { method, amount: n, note: note || undefined }, idempotencyKey: key });
      toast("green", r.payment.status === "PENDING" ? "QRIS dicatat — menunggu verifikasi." : r.duplicate ? "Pembayaran ini sudah tercatat sebelumnya." : "Pembayaran tercatat.");
      setKey(newKey());
      onDone();
    } catch (e) { setErr((e as Error).message); }
    setSaving(false);
  }
  return (
    <Modal open={open} onClose={onClose} title="Terima pembayaran" footer={<><Button variant="ghost" onClick={onClose}>Batal</Button><Button loading={saving} disabled={n <= 0 || n > remaining} onClick={submit}>Simpan pembayaran</Button></>}>
      <div className="space-y-3">
        {err && <Alert>{err}</Alert>}
        <p className="tabular text-sm">Sisa tagihan: <span className="font-semibold">{rupiah(remaining)}</span></p>
        <Field label="Metode" htmlFor="pm">
          <Select id="pm" value={method} onChange={(e) => setMethod(e.target.value as typeof method)}><option value="CASH">Tunai</option><option value="QRIS">QRIS</option><option value="TRANSFER">Transfer Bank</option></Select>
        </Field>
        <Field label="Nominal (Rp)" htmlFor="pa" error={n > remaining ? "Nominal melebihi sisa tagihan." : null}>
          <div className="flex gap-2"><Input id="pa" inputMode="numeric" className="tabular" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))} invalid={n > remaining} /><Button variant="secondary" onClick={() => setAmount(String(remaining))}>Lunasi</Button></div>
        </Field>
        <Field label="Catatan" htmlFor="pn"><Input id="pn" value={note} onChange={(e) => setNote(e.target.value)} placeholder="mis. no. referensi transfer" /></Field>
        {method === "QRIS" && <Alert tone="blue">QRIS manual dicatat “menunggu verifikasi”. Konfirmasi setelah dana masuk terlihat di aplikasi bank/merchant.</Alert>}
      </div>
    </Modal>
  );
}

function CancelModal({ open, onClose, orderId, paid, canRefund, onDone }: { open: boolean; onClose: () => void; orderId: number; paid: number; canRefund: boolean; onDone: () => void }) {
  const toast = useToast();
  const [reason, setReason] = useState("");
  const [refund, setRefund] = useState(false);
  const [amount, setAmount] = useState(String(paid));
  const [method, setMethod] = useState("CASH");
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  async function submit() {
    setErr(null); setSaving(true);
    try {
      await apiFetch(`/api/orders/${orderId}/cancel`, { body: { reason, refund: refund && Number(amount) > 0 ? { method, amount: Number(amount) } : undefined } });
      toast("green", "Pesanan dibatalkan.");
      onDone();
    } catch (e) { setErr((e as Error).message); }
    setSaving(false);
  }
  return (
    <Modal open={open} onClose={onClose} title="Batalkan pesanan" footer={<><Button variant="ghost" onClick={onClose}>Kembali</Button><Button variant="danger" loading={saving} disabled={reason.trim().length < 3} onClick={submit}>Batalkan pesanan</Button></>}>
      <div className="space-y-3">
        {err && <Alert>{err}</Alert>}
        <Field label="Alasan pembatalan" htmlFor="cr" required><Textarea id="cr" value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
        <p className="text-xs text-slate-500">Riwayat pembayaran tetap tersimpan. Dana yang sudah diterima: {rupiah(paid)}.</p>
        {canRefund && paid > 0 && (
          <div className="space-y-2 rounded-lg border border-slate-200 p-3">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={refund} onChange={(e) => setRefund(e.target.checked)} /> Kembalikan dana sekarang</label>
            {refund && <div className="grid grid-cols-2 gap-2">
              <Select aria-label="Metode pengembalian" value={method} onChange={(e) => setMethod(e.target.value)}><option value="CASH">Tunai</option><option value="TRANSFER">Transfer</option><option value="QRIS">QRIS</option></Select>
              <Input aria-label="Nominal pengembalian" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))} />
            </div>}
          </div>
        )}
      </div>
    </Modal>
  );
}

function RefundModal({ open, onClose, orderId, max, onDone }: { open: boolean; onClose: () => void; orderId: number; max: number; onDone: () => void }) {
  const toast = useToast();
  const [amount, setAmount] = useState(String(max));
  const [method, setMethod] = useState("CASH");
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [key, setKey] = useState(newKey);
  async function submit() {
    setErr(null); setSaving(true);
    try { await apiFetch(`/api/orders/${orderId}/refunds`, { body: { method, amount: Number(amount), note: note || undefined }, idempotencyKey: key }); setKey(newKey()); toast("green", "Pengembalian dana dicatat."); onDone(); }
    catch (e) { setErr((e as Error).message); }
    setSaving(false);
  }
  return (
    <Modal open={open} onClose={onClose} title="Pengembalian dana" footer={<><Button variant="ghost" onClick={onClose}>Batal</Button><Button loading={saving} disabled={Number(amount) <= 0 || Number(amount) > max} onClick={submit}>Simpan</Button></>}>
      <div className="space-y-3">
        {err && <Alert>{err}</Alert>}
        <p className="text-sm">Maksimal yang dapat dikembalikan: <span className="tabular font-semibold">{rupiah(max)}</span>. Dicatat pada tanggal hari ini.</p>
        <Field label="Metode" htmlFor="rm"><Select id="rm" value={method} onChange={(e) => setMethod(e.target.value)}><option value="CASH">Tunai</option><option value="TRANSFER">Transfer</option><option value="QRIS">QRIS</option></Select></Field>
        <Field label="Nominal" htmlFor="ra"><Input id="ra" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))} /></Field>
        <Field label="Catatan" htmlFor="rn"><Input id="rn" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      </div>
    </Modal>
  );
}

function DeliveryModal({ open, onClose, order, couriers, defaultFee, onDone }: { open: boolean; onClose: () => void; order: Order; couriers: { id: number; name: string }[]; defaultFee: number; onDone: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({
    name: order.customer.name, phone: order.customer.phone, address: order.customer.address ?? "", mapsUrl: order.customer.mapsUrl ?? "",
    scheduledAt: toLocalInputValue(new Date(Date.now() + 3600000)), courierId: couriers[0]?.id ? String(couriers[0].id) : "",
    fee: String(order.deliveryFee || defaultFee), courierPay: "5000", notes: "", applyFeeToOrder: order.deliveryFee === 0,
  });
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  async function submit() {
    setErr(null); setSaving(true);
    try {
      await apiFetch(`/api/orders/${order.id}/delivery`, { body: { ...f, scheduledAt: fromLocalInputValue(f.scheduledAt).toISOString(), courierId: f.courierId ? Number(f.courierId) : null, fee: Number(f.fee || 0), courierPay: Number(f.courierPay || 0), mapsUrl: f.mapsUrl || undefined } });
      toast("green", "Jadwal antar dibuat."); onDone();
    } catch (e) { setErr((e as Error).message); }
    setSaving(false);
  }
  return (
    <Modal wide open={open} onClose={onClose} title="Jadwalkan pengantaran" footer={<><Button variant="ghost" onClick={onClose}>Batal</Button><Button loading={saving} onClick={submit}>Simpan jadwal</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        {err && <div className="sm:col-span-2"><Alert>{err}</Alert></div>}
        <Field label="Nama penerima" htmlFor="dn" required><Input id="dn" value={f.name} onChange={set("name")} /></Field>
        <Field label="WhatsApp" htmlFor="dp" required><Input id="dp" value={f.phone} onChange={set("phone")} /></Field>
        <div className="sm:col-span-2"><Field label="Alamat" htmlFor="da" required><Textarea id="da" rows={2} value={f.address} onChange={set("address")} /></Field></div>
        <div className="sm:col-span-2"><Field label="Tautan Google Maps" htmlFor="dm" hint="Tempel tautan dari aplikasi Google Maps (opsional)"><Input id="dm" value={f.mapsUrl} onChange={set("mapsUrl")} placeholder="https://maps.app.goo.gl/…" /></Field></div>
        <Field label="Jadwal" htmlFor="ds" required><Input id="ds" type="datetime-local" value={f.scheduledAt} onChange={set("scheduledAt")} /></Field>
        <Field label="Kurir" htmlFor="dc"><Select id="dc" value={f.courierId} onChange={set("courierId")}><option value="">— Belum ditentukan —</option>{couriers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
        <Field label="Biaya antar ke pelanggan (Rp)" htmlFor="df"><Input id="df" inputMode="numeric" value={f.fee} onChange={set("fee")} /></Field>
        <Field label="Ongkos dibayar ke kurir (Rp)" htmlFor="dk" hint="Dicatat sebagai pengeluaran transportasi"><Input id="dk" inputMode="numeric" value={f.courierPay} onChange={set("courierPay")} /></Field>
        <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={f.applyFeeToOrder} onChange={(e) => setF({ ...f, applyFeeToOrder: e.target.checked })} /> Tambahkan/ubah biaya antar pada tagihan nota</label>
        <div className="sm:col-span-2"><Field label="Catatan untuk kurir" htmlFor="dnote"><Textarea id="dnote" rows={2} value={f.notes} onChange={set("notes")} /></Field></div>
      </div>
    </Modal>
  );
}
