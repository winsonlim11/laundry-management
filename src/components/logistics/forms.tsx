"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Alert, Button, Field, Input, Modal, Select, Textarea, useToast } from "../ui";
import { CustomerPicker, type CustomerLite } from "../kasir/customer-picker";
import { apiFetch } from "@/lib/client";
import { fromLocalInputValue, toLocalInputValue } from "@/lib/time";

export function CourierSelect({ type, id, value, couriers, disabled }: { type: "pickup" | "delivery"; id: number; value: number | null; couriers: { id: number; name: string }[]; disabled?: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <Select aria-label="Kurir" className="h-8 w-40 text-xs" defaultValue={value ?? ""} disabled={disabled || busy} onChange={async (e) => {
      setBusy(true);
      try { await apiFetch(`/api/tasks/${type}/${id}`, { method: "PATCH", body: { courierId: e.target.value ? Number(e.target.value) : null } }); toast("green", "Kurir diperbarui."); router.refresh(); } catch (err) { toast("red", (err as Error).message); }
      setBusy(false);
    }}>
      <option value="">— Belum —</option>
      {couriers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
    </Select>
  );
}

export function NewPickupButton({ couriers, defaultFee }: { couriers: { id: number; name: string }[]; defaultFee: number }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [customer, setCustomer] = useState<CustomerLite | null>(null);
  const empty = { name: "", phone: "", address: "", mapsUrl: "", scheduledAt: toLocalInputValue(new Date(Date.now() + 3600000)), courierId: couriers[0] ? String(couriers[0].id) : "", fee: String(defaultFee), courierPay: "5000", notes: "" };
  const [f, setF] = useState(empty);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  async function submit() {
    setErr(null); setSaving(true);
    try {
      await apiFetch("/api/pickups", { body: { ...f, customerId: customer?.id, mapsUrl: f.mapsUrl || undefined, scheduledAt: fromLocalInputValue(f.scheduledAt).toISOString(), courierId: f.courierId ? Number(f.courierId) : null, fee: Number(f.fee || 0), courierPay: Number(f.courierPay || 0) } });
      toast("green", "Permintaan jemput dibuat."); setOpen(false); setF(empty); setCustomer(null); router.refresh();
    } catch (e) { setErr((e as Error).message); }
    setSaving(false);
  }
  return (
    <>
      <Button icon={<Plus className="size-4" />} onClick={() => setOpen(true)}>Permintaan jemput</Button>
      <Modal wide open={open} onClose={() => setOpen(false)} title="Permintaan jemput baru" footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Batal</Button><Button loading={saving} onClick={submit}>Simpan</Button></>}>
        <div className="space-y-3">
          {err && <Alert>{err}</Alert>}
          <Field label="Pelanggan terdaftar (opsional)"><CustomerPicker value={customer} onChange={(c) => { setCustomer(c); if (c) setF({ ...f, name: c.name, phone: c.phone, address: c.address ?? "" }); }} /></Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nama" htmlFor="pn" required><Input id="pn" value={f.name} onChange={set("name")} /></Field>
            <Field label="WhatsApp" htmlFor="pp" required><Input id="pp" inputMode="tel" value={f.phone} onChange={set("phone")} /></Field>
            <div className="sm:col-span-2"><Field label="Alamat" htmlFor="pa" required><Textarea id="pa" rows={2} value={f.address} onChange={set("address")} /></Field></div>
            <div className="sm:col-span-2"><Field label="Tautan Google Maps" htmlFor="pm" hint="opsional"><Input id="pm" value={f.mapsUrl} onChange={set("mapsUrl")} placeholder="https://maps.app.goo.gl/…" /></Field></div>
            <Field label="Jadwal jemput" htmlFor="ps" required><Input id="ps" type="datetime-local" value={f.scheduledAt} onChange={set("scheduledAt")} /></Field>
            <Field label="Kurir" htmlFor="pc"><Select id="pc" value={f.courierId} onChange={set("courierId")}><option value="">— Belum ditentukan —</option>{couriers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
            <Field label="Biaya jemput ke pelanggan (Rp)" htmlFor="pf"><Input id="pf" inputMode="numeric" value={f.fee} onChange={set("fee")} /></Field>
            <Field label="Ongkos dibayar ke kurir (Rp)" htmlFor="pk"><Input id="pk" inputMode="numeric" value={f.courierPay} onChange={set("courierPay")} /></Field>
            <div className="sm:col-span-2"><Field label="Catatan" htmlFor="pnote"><Textarea id="pnote" rows={2} value={f.notes} onChange={set("notes")} /></Field></div>
          </div>
        </div>
      </Modal>
    </>
  );
}
