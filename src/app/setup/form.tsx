"use client";
import { useState } from "react";
import { Alert, Button, Field, Input } from "@/components/ui";
import { apiFetch } from "@/lib/client";

export function SetupForm() {
  const [f, setF] = useState({ businessName: "Laundry", name: "", username: "", password: "", confirm: "" });
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (f.password !== f.confirm) return setErr("Konfirmasi kata sandi tidak sama.");
    setLoading(true);
    try {
      await apiFetch("/api/setup", { body: { businessName: f.businessName, name: f.name, username: f.username, password: f.password } });
      await apiFetch("/api/auth/login", { body: { username: f.username, password: f.password } });
      window.location.href = "/";
    } catch (e) {
      setErr((e as Error).message);
      setLoading(false);
    }
  }
  return (
    <form onSubmit={submit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      {err && <Alert>{err}</Alert>}
      <Field label="Nama usaha" htmlFor="b" required><Input id="b" value={f.businessName} onChange={set("businessName")} required /></Field>
      <Field label="Nama Owner" htmlFor="n" required><Input id="n" value={f.name} onChange={set("name")} required /></Field>
      <Field label="Username" htmlFor="u" required hint="Huruf kecil/angka, 3–30 karakter"><Input id="u" value={f.username} onChange={set("username")} autoComplete="username" required /></Field>
      <Field label="Kata sandi" htmlFor="p" required hint="Minimal 8 karakter"><Input id="p" type="password" value={f.password} onChange={set("password")} autoComplete="new-password" required minLength={8} /></Field>
      <Field label="Ulangi kata sandi" htmlFor="c" required><Input id="c" type="password" value={f.confirm} onChange={set("confirm")} autoComplete="new-password" required /></Field>
      <Button type="submit" size="lg" className="w-full" loading={loading}>Buat Owner & masuk</Button>
    </form>
  );
}
