"use client";
import { useEffect, useState } from "react";
import { Search, UserPlus, X } from "lucide-react";
import { Alert, Button, Field, Input, Textarea } from "../ui";
import { apiFetch } from "@/lib/client";

export type CustomerLite = { id: number; name: string; phone: string; address: string | null };

export function CustomerPicker({ value, onChange }: { value: CustomerLite | null; onChange: (c: CustomerLite | null) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<CustomerLite[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", address: "" });
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (value || q.trim().length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      setLoading(true);
      try { setResults(await apiFetch<CustomerLite[]>(`/api/customers?q=${encodeURIComponent(q)}&take=8`)); } catch { setResults([]); }
      setLoading(false);
    }, 250);
    return () => clearTimeout(t);
  }, [q, value]);

  if (value)
    return (
      <div className="flex items-start justify-between gap-3 rounded-lg border border-brand-200 bg-brand-50/50 p-3">
        <div>
          <p className="font-medium">{value.name}</p>
          <p className="text-xs text-slate-600">WA {value.phone}{value.address ? ` · ${value.address}` : ""}</p>
        </div>
        <button type="button" onClick={() => onChange(null)} className="rounded p-1 text-slate-500 hover:bg-white" aria-label="Ganti pelanggan"><X className="size-4" /></button>
      </div>
    );

  if (creating)
    return (
      <form
        className="space-y-3 rounded-lg border border-slate-200 p-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setErr(null); setSaving(true);
          try {
            const c = await apiFetch<CustomerLite>("/api/customers", { body: { name: form.name, phone: form.phone, address: form.address || null } });
            onChange(c); setCreating(false); setForm({ name: "", phone: "", address: "" });
          } catch (e) { setErr((e as Error).message); }
          setSaving(false);
        }}
      >
        {err && <Alert>{err}</Alert>}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nama" htmlFor="cn" required><Input id="cn" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required autoFocus /></Field>
          <Field label="WhatsApp" htmlFor="cp" required><Input id="cp" inputMode="tel" placeholder="08xx" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required /></Field>
        </div>
        <Field label="Alamat" htmlFor="ca"><Textarea id="ca" rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
        <div className="flex gap-2">
          <Button type="submit" size="sm" loading={saving}>Simpan pelanggan</Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setCreating(false)}>Batal</Button>
        </div>
      </form>
    );

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-slate-400" aria-hidden />
          <Input aria-label="Cari pelanggan" className="pl-8" placeholder="Cari nama atau nomor WhatsApp…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
        </div>
        <Button type="button" variant="secondary" icon={<UserPlus className="size-4" />} onClick={() => { setCreating(true); setForm({ ...form, name: /\d/.test(q) ? "" : q, phone: /\d/.test(q) ? q : "" }); }}>Baru</Button>
      </div>
      {loading && <p className="text-xs text-slate-500">Mencari…</p>}
      {!loading && q.trim().length >= 2 && results.length === 0 && <p className="text-xs text-slate-500">Tidak ditemukan. Klik &quot;Baru&quot; untuk menambahkan.</p>}
      {results.length > 0 && (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200" role="listbox" aria-label="Hasil pencarian pelanggan">
          {results.map((c) => (
            <li key={c.id}>
              <button type="button" role="option" aria-selected={false} onClick={() => onChange(c)} className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-brand-50 focus:bg-brand-50">
                <span className="font-medium">{c.name}</span><span className="text-xs text-slate-500">{c.phone}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
