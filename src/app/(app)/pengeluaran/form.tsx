"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Alert, Button, Field, Input, Select, useToast } from "@/components/ui";
import { apiFetch } from "@/lib/client";

export function ExpenseForm({ categories, today }: { categories: string[]; today: string }) {
  const router = useRouter();
  const toast = useToast();
  const [f, setF] = useState({ date: today, category: categories[0], amount: "", description: "" });
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  return (
    <form className="space-y-3" onSubmit={async (e) => {
      e.preventDefault(); setErr(null); setSaving(true);
      try { await apiFetch("/api/expenses", { body: { ...f, amount: Number(f.amount), description: f.description || undefined } }); toast("green", "Pengeluaran dicatat."); setF({ ...f, amount: "", description: "" }); router.refresh(); }
      catch (e) { setErr((e as Error).message); }
      setSaving(false);
    }}>
      {err && <Alert>{err}</Alert>}
      <Field label="Tanggal" htmlFor="ed" required><Input id="ed" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} required /></Field>
      <Field label="Kategori" htmlFor="ec" required><Select id="ec" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{categories.map((c) => <option key={c}>{c}</option>)}</Select></Field>
      <Field label="Nominal (Rp)" htmlFor="ea" required><Input id="ea" inputMode="numeric" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value.replace(/[^\d]/g, "") })} required /></Field>
      <Field label="Keterangan" htmlFor="ek"><Input id="ek" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
      <Button type="submit" loading={saving} className="w-full">Simpan</Button>
    </form>
  );
}

export function DeleteExpense({ id }: { id: number }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <button disabled={busy} onClick={async () => {
      if (!confirm("Hapus pengeluaran ini?")) return;
      setBusy(true);
      try { await apiFetch(`/api/expenses/${id}`, { method: "DELETE" }); toast("green", "Dihapus."); router.refresh(); } catch (e) { toast("red", (e as Error).message); }
      setBusy(false);
    }} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label="Hapus pengeluaran"><Trash2 className="size-4" /></button>
  );
}
