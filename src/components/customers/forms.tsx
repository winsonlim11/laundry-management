"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Star } from "lucide-react";
import { Alert, Button, Field, Input, Modal, Select, Textarea, useToast } from "../ui";
import { apiFetch } from "@/lib/client";

type C = { id?: number; name: string; phone: string; address: string | null; mapsUrl: string | null; notes: string | null; membership: string };

function CustomerModal({ open, onClose, initial, onSaved }: { open: boolean; onClose: () => void; initial?: C; onSaved: (c: { id: number }) => void }) {
  const [f, setF] = useState<C>(initial ?? { name: "", phone: "", address: "", mapsUrl: "", notes: "", membership: "REGULER" });
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (k: keyof C) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  async function submit() {
    setErr(null); setSaving(true);
    try {
      const body = { name: f.name, phone: f.phone, address: f.address || null, mapsUrl: f.mapsUrl || null, notes: f.notes || null, membership: f.membership };
      const c = initial?.id ? await apiFetch<{ id: number }>(`/api/customers/${initial.id}`, { method: "PATCH", body }) : await apiFetch<{ id: number }>("/api/customers", { body });
      onSaved(c);
    } catch (e) { setErr((e as Error).message); }
    setSaving(false);
  }
  return (
    <Modal open={open} onClose={onClose} title={initial?.id ? "Ubah pelanggan" : "Pelanggan baru"} footer={<><Button variant="ghost" onClick={onClose}>Batal</Button><Button loading={saving} onClick={submit}>Simpan</Button></>}>
      <div className="space-y-3">
        {err && <Alert>{err}</Alert>}
        <Field label="Nama" htmlFor="n" required><Input id="n" value={f.name} onChange={set("name")} /></Field>
        <Field label="WhatsApp" htmlFor="p" required><Input id="p" inputMode="tel" value={f.phone} onChange={set("phone")} /></Field>
        <Field label="Alamat" htmlFor="a"><Textarea id="a" rows={2} value={f.address ?? ""} onChange={set("address")} /></Field>
        <Field label="Tautan Google Maps" htmlFor="m"><Input id="m" value={f.mapsUrl ?? ""} onChange={set("mapsUrl")} /></Field>
        <Field label="Membership" htmlFor="ms"><Select id="ms" value={f.membership} onChange={set("membership")}><option value="REGULER">Reguler</option><option value="SILVER">Silver</option><option value="GOLD">Gold</option></Select></Field>
        <Field label="Catatan" htmlFor="c"><Textarea id="c" rows={2} value={f.notes ?? ""} onChange={set("notes")} /></Field>
      </div>
    </Modal>
  );
}

export function NewCustomerButton() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const toast = useToast();
  return (
    <>
      <Button icon={<Plus className="size-4" />} onClick={() => setOpen(true)}>Pelanggan baru</Button>
      <CustomerModal open={open} onClose={() => setOpen(false)} onSaved={(c) => { setOpen(false); toast("green", "Pelanggan tersimpan."); router.push(`/pelanggan/${c.id}`); }} />
    </>
  );
}

export function EditCustomerButton({ customer }: { customer: C & { id: number } }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const toast = useToast();
  return (
    <>
      <Button variant="secondary" icon={<Pencil className="size-4" />} onClick={() => setOpen(true)}>Ubah</Button>
      <CustomerModal open={open} onClose={() => setOpen(false)} initial={customer} onSaved={() => { setOpen(false); toast("green", "Data pelanggan diperbarui."); router.refresh(); }} />
    </>
  );
}

export function AdjustPointsButton({ customerId }: { customerId: number }) {
  const [open, setOpen] = useState(false);
  const [points, setPoints] = useState("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const toast = useToast();
  return (
    <>
      <Button size="sm" variant="secondary" icon={<Star className="size-3.5" />} onClick={() => setOpen(true)}>Sesuaikan poin</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Penyesuaian poin" footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Batal</Button><Button loading={saving} onClick={async () => {
        setErr(null); setSaving(true);
        try { await apiFetch(`/api/customers/${customerId}/points`, { body: { points: Number(points), note } }); toast("green", "Poin diperbarui."); setOpen(false); setPoints(""); setNote(""); router.refresh(); } catch (e) { setErr((e as Error).message); }
        setSaving(false);
      }}>Simpan</Button></>}>
        <div className="space-y-3">
          {err && <Alert>{err}</Alert>}
          <Field label="Poin (+ tambah, − kurangi/tukar)" htmlFor="pt"><Input id="pt" inputMode="numeric" value={points} onChange={(e) => setPoints(e.target.value.replace(/[^\d-]/g, ""))} placeholder="mis. -10" /></Field>
          <Field label="Keterangan" htmlFor="pn"><Input id="pn" value={note} onChange={(e) => setNote(e.target.value)} placeholder="mis. Tukar poin gratis 1 kg" /></Field>
        </div>
      </Modal>
    </>
  );
}
