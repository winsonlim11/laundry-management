"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus, Trash2, Zap } from "lucide-react";
import { Alert, Badge, Button, Card, Field, Input, Select, Textarea, cx, useToast } from "../ui";
import { CustomerPicker, type CustomerLite } from "./customer-picker";
import { apiFetch, newKey } from "@/lib/client";
import { computeBill, parseQuantity, PricingError } from "@/lib/pricing";
import { rupiah } from "@/lib/money";
import { PICKUP_STATUS_LABEL } from "@/lib/status";
import { formatDateTime } from "@/lib/time";

type Svc = { id: number; name: string; unit: "KG" | "PCS"; price: number; expressPrice: number; estimateHours: number; expressEstimateHours: number };
type Pickup = { id: number; number: string; name: string; phone: string; address: string; fee: number; status: string; customer: CustomerLite | null };
type Line = { key: string; serviceId: number; quantity: string; express: boolean; notes: string };

const num = (s: string) => (s.trim() === "" ? 0 : Number(s.replace(/\./g, "")));

export function PosForm({ services, operators, defaults, pickups, initialPickupId, initialCustomer, canPay }: {
  services: Svc[]; operators: { id: number; name: string }[]; defaults: { pickupFee: number; deliveryFee: number };
  pickups: Pickup[]; initialPickupId?: number; initialCustomer: CustomerLite | null; canPay: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const initPickup = pickups.find((p) => p.id === initialPickupId) ?? null;
  const [customer, setCustomer] = useState<CustomerLite | null>(initPickup?.customer ?? initialCustomer);
  const [pickupId, setPickupId] = useState<number | null>(initPickup?.id ?? null);
  const [lines, setLines] = useState<Line[]>([]);
  const [discountType, setDiscountType] = useState<"NONE" | "NOMINAL" | "PERCENT">("NONE");
  const [discountValue, setDiscountValue] = useState("");
  const [extraFee, setExtraFee] = useState("");
  const [extraFeeNote, setExtraFeeNote] = useState("");
  const [pickupFee, setPickupFee] = useState(initPickup ? String(initPickup.fee) : "");
  const [handover, setHandover] = useState<"AMBIL_SENDIRI" | "ANTAR">("AMBIL_SENDIRI");
  const [deliveryFee, setDeliveryFee] = useState("");
  const [operatorId, setOperatorId] = useState("");
  const [notes, setNotes] = useState("");
  const [payMethod, setPayMethod] = useState<"CASH" | "QRIS" | "TRANSFER">("CASH");
  const [payAmount, setPayAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [key, setKey] = useState(newKey);

  const byId = useMemo(() => new Map(services.map((s) => [s.id, s])), [services]);

  // Pratinjau memakai modul harga yang sama dengan server (src/lib/pricing.ts)
  const preview = useMemo(() => {
    const lineErrors: Record<string, string> = {};
    const priced = lines.map((l) => {
      const s = byId.get(l.serviceId)!;
      const unitPrice = l.express ? s.expressPrice : s.price;
      try {
        return { l, s, unitPrice, milli: parseQuantity(l.quantity || "0", s.unit), hours: l.express ? s.expressEstimateHours : s.estimateHours };
      } catch (e) {
        lineErrors[l.key] = (e as Error).message;
        return null;
      }
    });
    if (lines.length === 0) return { lineErrors, bill: null, error: null, hours: 0, lineTotals: {} as Record<string, number> };
    if (priced.some((p) => !p)) return { lineErrors, bill: null, error: "Periksa jumlah pada item.", hours: 0, lineTotals: {} as Record<string, number> };
    try {
      const ok = priced as NonNullable<(typeof priced)[number]>[];
      const bill = computeBill({
        lines: ok.map((p) => ({ unitPrice: p.unitPrice, quantityMilli: p.milli })),
        discountType, discountValue: num(discountValue), extraFee: num(extraFee), pickupFee: num(pickupFee),
        deliveryFee: handover === "ANTAR" ? num(deliveryFee) : 0,
      });
      const lineTotals = Object.fromEntries(ok.map((p, i) => [p.l.key, bill.lineTotals[i]]));
      return { lineErrors, bill, error: null, hours: Math.max(...ok.map((p) => p.hours)), lineTotals };
    } catch (e) {
      return { lineErrors, bill: null, error: e instanceof PricingError ? e.message : "Input tidak valid.", hours: 0, lineTotals: {} as Record<string, number> };
    }
  }, [lines, byId, discountType, discountValue, extraFee, pickupFee, deliveryFee, handover]);

  const pay = num(payAmount);
  const remaining = preview.bill ? preview.bill.total - pay : 0;
  const payError = preview.bill && pay > preview.bill.total ? "DP melebihi total tagihan." : null;

  const addService = (s: Svc) => setLines((ls) => [...ls, { key: newKey(), serviceId: s.id, quantity: s.unit === "PCS" ? "1" : "", express: false, notes: "" }]);
  const upd = (k: string, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === k ? { ...l, ...patch } : l)));

  async function save() {
    setErr(null);
    if (!customer) return setErr("Pilih atau buat pelanggan terlebih dahulu.");
    if (!preview.bill) return setErr(preview.error ?? "Tambahkan minimal satu layanan.");
    if (payError) return setErr(payError);
    setSaving(true);
    try {
      const res = await apiFetch<{ order: { id: number; number: string } }>("/api/orders", {
        body: {
          customerId: customer.id,
          items: lines.map((l) => ({ serviceId: l.serviceId, quantity: l.quantity, express: l.express, notes: l.notes || undefined })),
          discountType, discountValue: num(discountValue), extraFee: num(extraFee), extraFeeNote: extraFeeNote || undefined,
          pickupFee: num(pickupFee), deliveryFee: handover === "ANTAR" ? num(deliveryFee) : 0, handover,
          notes: notes || undefined, pickupRequestId: pickupId ?? undefined,
          assignedOperatorId: operatorId ? Number(operatorId) : undefined,
          initialPayment: canPay && pay > 0 ? { method: payMethod, amount: pay } : undefined,
          idempotencyKey: key,
        },
      });
      toast("green", `Nota ${res.order.number} tersimpan.`);
      setKey(newKey());
      router.push(`/pesanan/${res.order.id}?baru=1`);
    } catch (e) {
      setErr((e as Error).message);
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Kasir · Nota baru</h1>
          <p className="text-sm text-slate-500">Tarif diambil dari katalog yang berlaku saat disimpan.</p>
        </div>
        <Card title="1. Pelanggan">
          <CustomerPicker value={customer} onChange={setCustomer} />
          {pickups.length > 0 && (
            <div className="mt-3">
              <Field label="Tautkan permintaan jemput (opsional)" htmlFor="pk">
                <Select id="pk" value={pickupId ?? ""} onChange={(e) => {
                  const p = pickups.find((x) => x.id === Number(e.target.value)) ?? null;
                  setPickupId(p?.id ?? null);
                  if (p) { setPickupFee(String(p.fee)); if (p.customer) setCustomer(p.customer); }
                }}>
                  <option value="">— Tidak ada —</option>
                  {pickups.map((p) => <option key={p.id} value={p.id}>{p.number} · {p.name} · {PICKUP_STATUS_LABEL[p.status as keyof typeof PICKUP_STATUS_LABEL]}</option>)}
                </Select>
              </Field>
            </div>
          )}
        </Card>

        <Card title="2. Layanan">
          <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Tambah layanan">
            {services.map((s) => (
              <button key={s.id} type="button" onClick={() => addService(s)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm shadow-sm hover:border-brand-300 hover:bg-brand-50 focus-visible:border-brand-500">
                <span className="block font-medium">{s.name}</span>
                <span className="tabular text-xs text-slate-500">{rupiah(s.price)}/{s.unit === "KG" ? "kg" : "pcs"}</span>
              </button>
            ))}
          </div>
          {lines.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-200 py-6 text-center text-sm text-slate-500">Klik layanan di atas untuk menambahkan item. Satu nota bisa berisi beberapa layanan.</p>
          ) : (
            <ul className="space-y-2">
              {lines.map((l, idx) => {
                const s = byId.get(l.serviceId)!;
                const errL = preview.lineErrors[l.key];
                return (
                  <li key={l.key} className="rounded-lg border border-slate-200 p-3">
                    <div className="flex flex-wrap items-end gap-3">
                      <div className="min-w-[140px] flex-1">
                        <p className="text-sm font-medium">{idx + 1}. {s.name}</p>
                        <p className="tabular text-xs text-slate-500">{rupiah(l.express ? s.expressPrice : s.price)} / {s.unit === "KG" ? "kg" : "pcs"} · est. {l.express ? s.expressEstimateHours : s.estimateHours} jam</p>
                      </div>
                      <div className="w-36">
                        <label htmlFor={`q-${l.key}`} className="sr-only">Jumlah {s.unit}</label>
                        <div className="flex items-center gap-1">
                          {s.unit === "PCS" && <Button type="button" size="sm" variant="secondary" aria-label="Kurangi" onClick={() => upd(l.key, { quantity: String(Math.max(1, (Number(l.quantity) || 1) - 1)) })}><Minus className="size-3" /></Button>}
                          <Input id={`q-${l.key}`} inputMode={s.unit === "KG" ? "decimal" : "numeric"} className="tabular text-right" placeholder={s.unit === "KG" ? "0,0" : "1"} value={l.quantity} invalid={!!errL} onChange={(e) => upd(l.key, { quantity: e.target.value })} autoFocus={s.unit === "KG"} />
                          {s.unit === "PCS" ? <Button type="button" size="sm" variant="secondary" aria-label="Tambah" onClick={() => upd(l.key, { quantity: String((Number(l.quantity) || 0) + 1) })}><Plus className="size-3" /></Button> : <span className="text-xs text-slate-500">kg</span>}
                        </div>
                      </div>
                      <label className={cx("flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1.5 text-xs", l.express ? "border-amber-300 bg-amber-50 text-amber-800" : "border-slate-200 text-slate-600")}>
                        <input type="checkbox" className="sr-only" checked={l.express} onChange={(e) => upd(l.key, { express: e.target.checked })} />
                        <Zap className="size-3.5" aria-hidden /> Express
                      </label>
                      <div className="tabular w-24 text-right text-sm font-medium">{preview.lineTotals[l.key] !== undefined ? rupiah(preview.lineTotals[l.key]) : "—"}</div>
                      <button type="button" onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label={`Hapus ${s.name}`}><Trash2 className="size-4" /></button>
                    </div>
                    {errL && <p className="mt-1 text-xs text-red-600" role="alert">{errL}</p>}
                    <Input aria-label="Catatan item" className="mt-2 h-8 text-xs" placeholder="Catatan item (noda, warna, dll.)" value={l.notes} onChange={(e) => upd(l.key, { notes: e.target.value })} />
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card title="3. Diskon, biaya & serah terima">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Jenis diskon" htmlFor="dt">
              <Select id="dt" value={discountType} onChange={(e) => setDiscountType(e.target.value as typeof discountType)}>
                <option value="NONE">Tanpa diskon</option><option value="PERCENT">Persentase (%)</option><option value="NOMINAL">Nominal (Rp)</option>
              </Select>
            </Field>
            <Field label={discountType === "PERCENT" ? "Diskon (%)" : "Diskon (Rp)"} htmlFor="dv">
              <Input id="dv" inputMode="numeric" disabled={discountType === "NONE"} value={discountValue} onChange={(e) => setDiscountValue(e.target.value.replace(/[^\d]/g, ""))} />
            </Field>
            <Field label="Biaya jemput (Rp)" htmlFor="pf"><Input id="pf" inputMode="numeric" value={pickupFee} placeholder="0" onChange={(e) => setPickupFee(e.target.value.replace(/[^\d]/g, ""))} /></Field>
            <Field label="Biaya tambahan (Rp)" htmlFor="ef"><Input id="ef" inputMode="numeric" value={extraFee} placeholder="0" onChange={(e) => setExtraFee(e.target.value.replace(/[^\d]/g, ""))} /></Field>
            <Field label="Keterangan biaya tambahan" htmlFor="en"><Input id="en" value={extraFeeNote} onChange={(e) => setExtraFeeNote(e.target.value)} placeholder="mis. parfum premium" /></Field>
            <Field label="Serah terima" htmlFor="ho">
              <Select id="ho" value={handover} onChange={(e) => { const v = e.target.value as typeof handover; setHandover(v); if (v === "ANTAR" && !deliveryFee) setDeliveryFee(String(defaults.deliveryFee)); }}>
                <option value="AMBIL_SENDIRI">Ambil sendiri di toko</option><option value="ANTAR">Diantar kurir</option>
              </Select>
            </Field>
            {handover === "ANTAR" && <Field label="Biaya antar (Rp)" htmlFor="df"><Input id="df" inputMode="numeric" value={deliveryFee} onChange={(e) => setDeliveryFee(e.target.value.replace(/[^\d]/g, ""))} /></Field>}
            {operators.length > 0 && (
              <Field label="Tugaskan operator" htmlFor="op">
                <Select id="op" value={operatorId} onChange={(e) => setOperatorId(e.target.value)}>
                  <option value="">— Nanti —</option>{operators.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </Select>
              </Field>
            )}
          </div>
          <div className="mt-3"><Field label="Catatan nota" htmlFor="nt"><Textarea id="nt" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field></div>
        </Card>
      </div>

      {/* Ringkasan tagihan */}
      <div className="lg:sticky lg:top-6 lg:self-start">
        <Card title="Rincian tagihan">
          {preview.error && lines.length > 0 && <div className="mb-3"><Alert>{preview.error}</Alert></div>}
          <dl className="tabular space-y-1.5 text-sm">
            {lines.map((l) => { const s = byId.get(l.serviceId)!; return (
              <div key={l.key} className="flex justify-between gap-2 text-slate-600"><dt className="truncate">{s.name}{l.express ? " (Express)" : ""} · {l.quantity || 0} {s.unit === "KG" ? "kg" : "pcs"} × {rupiah(l.express ? s.expressPrice : s.price)}</dt><dd>{preview.lineTotals[l.key] !== undefined ? rupiah(preview.lineTotals[l.key]) : "—"}</dd></div>
            ); })}
            <div className="flex justify-between border-t border-slate-100 pt-2 font-medium"><dt>Subtotal layanan</dt><dd>{rupiah(preview.bill?.subtotal ?? 0)}</dd></div>
            {discountType !== "NONE" && <div className="flex justify-between text-emerald-700"><dt>Diskon{discountType === "PERCENT" ? ` ${num(discountValue)}%` : ""}</dt><dd>−{rupiah(preview.bill?.discountAmount ?? 0)}</dd></div>}
            {num(extraFee) > 0 && <div className="flex justify-between"><dt>Biaya tambahan{extraFeeNote ? ` (${extraFeeNote})` : ""}</dt><dd>{rupiah(num(extraFee))}</dd></div>}
            {num(pickupFee) > 0 && <div className="flex justify-between"><dt>Biaya jemput</dt><dd>{rupiah(num(pickupFee))}</dd></div>}
            {handover === "ANTAR" && <div className="flex justify-between"><dt>Biaya antar</dt><dd>{rupiah(num(deliveryFee))}</dd></div>}
            <div className="flex justify-between border-t border-slate-200 pt-2 text-lg font-semibold"><dt>Total</dt><dd>{rupiah(preview.bill?.total ?? 0)}</dd></div>
          </dl>
          {preview.bill && <p className="mt-2 text-xs text-slate-500">Estimasi selesai: <span className="font-medium text-slate-700">{formatDateTime(new Date(Date.now() + preview.hours * 3600000))}</span></p>}

          {canPay && (
            <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
              <p className="text-xs font-medium text-slate-600">Pembayaran awal / DP (opsional)</p>
              <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Metode bayar">
                {(["CASH", "QRIS", "TRANSFER"] as const).map((m) => (
                  <button key={m} type="button" role="radio" aria-checked={payMethod === m} onClick={() => setPayMethod(m)} className={cx("rounded-md border py-1.5 text-xs font-medium", payMethod === m ? "border-brand-500 bg-brand-50 text-brand-700" : "border-slate-200 text-slate-600")}>{m === "CASH" ? "Tunai" : m === "QRIS" ? "QRIS" : "Transfer"}</button>
                ))}
              </div>
              <div className="flex gap-2">
                <Input aria-label="Nominal DP" inputMode="numeric" className="tabular" placeholder="0" value={payAmount} invalid={!!payError} onChange={(e) => setPayAmount(e.target.value.replace(/[^\d]/g, ""))} />
                <Button type="button" size="md" variant="secondary" disabled={!preview.bill} onClick={() => setPayAmount(String(preview.bill?.total ?? 0))}>Lunas</Button>
              </div>
              {payError && <p className="text-xs text-red-600" role="alert">{payError}</p>}
              {payMethod === "QRIS" && pay > 0 && <p className="text-xs text-amber-700">QRIS dicatat “menunggu verifikasi” sampai dikonfirmasi di detail nota.</p>}
              <div className="tabular flex justify-between text-sm"><span>Sisa tagihan</span><span className="font-semibold">{rupiah(Math.max(0, remaining))}</span></div>
              <div><Badge tone={pay <= 0 ? "red" : remaining <= 0 ? "green" : "amber"}>{pay <= 0 ? "Belum Bayar" : remaining <= 0 ? "Lunas" : "Sebagian/DP"}</Badge></div>
            </div>
          )}

          {err && <div className="mt-3"><Alert>{err}</Alert></div>}
          <Button type="button" size="lg" className="mt-4 w-full" loading={saving} disabled={!customer || !preview.bill || !!payError} onClick={save}>Simpan nota</Button>
          {(!customer || !preview.bill) && <p className="mt-2 text-center text-xs text-slate-500">{!customer ? "Pilih pelanggan" : "Tambahkan layanan"} untuk menyimpan.</p>}
        </Card>
      </div>
    </div>
  );
}
