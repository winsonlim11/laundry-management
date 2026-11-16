"use client";
import { useState } from "react";
import { Alert, Button, Field, Input } from "@/components/ui";
import { apiFetch } from "@/lib/client";

const DEMO = [["owner", "Owner"], ["admin", "Admin"], ["kasir", "Kasir"], ["operator", "Operator"], ["kurir", "Kurir"]];

export function LoginForm({ demo }: { demo: boolean }) {
  const [username, setU] = useState("");
  const [password, setP] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  async function submit(e?: React.FormEvent, u = username, p = password) {
    e?.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      await apiFetch("/api/auth/login", { body: { username: u, password: p } });
      window.location.href = "/";
    } catch (e) {
      setErr((e as Error).message);
      setLoading(false);
    }
  }
  return (
    <div className="space-y-4">
      <form method="post" onSubmit={submit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        {err && <Alert>{err}</Alert>}
        <Field label="Username" htmlFor="u" required>
          <Input id="u" name="username" autoComplete="username" autoFocus value={username} onChange={(e) => setU(e.target.value)} required />
        </Field>
        <Field label="Kata sandi" htmlFor="p" required>
          <Input id="p" name="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setP(e.target.value)} required />
        </Field>
        <Button type="submit" className="w-full" size="lg" loading={loading}>Masuk</Button>
      </form>
      {demo && (
        <div className="rounded-xl border border-dashed border-brand-200 bg-brand-50/60 p-4">
          <p className="mb-2 text-xs font-medium text-brand-700">Mode demo — masuk cepat sebagai (kata sandi: demo1234):</p>
          <div className="flex flex-wrap gap-2">
            {DEMO.map(([u, l]) => (
              <Button key={u} type="button" size="sm" variant="secondary" disabled={loading} onClick={() => { setU(u); setP("demo1234"); submit(undefined, u, "demo1234"); }}>{l}</Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
