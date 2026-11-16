"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, ShieldCheck } from "lucide-react";
import { Alert, Badge, Button, Card, Field, Input, Modal, Select, useToast } from "@/components/ui";
import { apiFetch } from "@/lib/client";

type U = { id: number; name: string; username: string; phone: string | null; active: boolean; roleKey: string; roleName: string; vehicle: string | null };
type R = { key: string; name: string; permissions: string[] };
type P = { key: string; description: string; privileged: boolean };

export function UsersManager({ users, roles, permissions, manageableRoles, privileged, selfId }: { users: U[]; roles: R[]; permissions: P[]; manageableRoles: readonly string[]; privileged: boolean; selfId: number }) {
  const router = useRouter();
  const toast = useToast();
  const [edit, setEdit] = useState<U | null>(null);
  const [creating, setCreating] = useState(false);
  const [roleEdit, setRoleEdit] = useState<R | null>(null);
  return (
    <div className="space-y-5">
      <Card title={`Pegawai (${users.length})`} padded={false} actions={<Button size="sm" icon={<Plus className="size-3.5" />} onClick={() => setCreating(true)}>Pegawai baru</Button>}>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500"><tr><th className="px-4 py-2 font-medium">Nama</th><th className="px-4 py-2 font-medium">Username</th><th className="px-4 py-2 font-medium">Peran</th><th className="px-4 py-2 font-medium">Status</th><th /></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((u) => (
              <tr key={u.id}><td className="px-4 py-2.5 font-medium">{u.name}{u.id === selfId && <span className="ml-1 text-xs text-slate-400">(Anda)</span>}</td><td className="px-4 py-2.5 font-mono text-xs">{u.username}</td><td className="px-4 py-2.5"><Badge tone={u.roleKey === "OWNER" ? "violet" : u.roleKey === "ADMIN" ? "blue" : "gray"}>{u.roleName}</Badge></td><td className="px-4 py-2.5">{u.active ? <Badge tone="green">Aktif</Badge> : <Badge tone="red">Nonaktif</Badge>}</td>
                <td className="px-4 py-2.5 text-right">{manageableRoles.includes(u.roleKey) ? <Button size="sm" variant="secondary" onClick={() => setEdit(u)}>Ubah</Button> : <span className="text-xs text-slate-400" title="Memerlukan otorisasi Owner">Terkunci</span>}</td></tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Card title="Izin per peran" actions={<ShieldCheck className="size-4 text-slate-400" />}>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {roles.map((r) => (
            <div key={r.key} className="rounded-lg border border-slate-200 p-3">
              <div className="mb-2 flex items-center justify-between"><p className="font-medium">{r.name}</p>{privileged && r.key !== "OWNER" && <Button size="sm" variant="ghost" onClick={() => setRoleEdit(r)}>Ubah izin</Button>}</div>
              <ul className="space-y-0.5 text-xs text-slate-600">{r.permissions.map((k) => <li key={k}>• {permissions.find((p) => p.key === k)?.description ?? k}</li>)}</ul>
            </div>
          ))}
        </div>
      </Card>
      {(creating || edit) && <UserModal key={edit?.id ?? "new"} user={edit} roles={roles.filter((r) => manageableRoles.includes(r.key))} onClose={() => { setCreating(false); setEdit(null); }} onSaved={() => { setCreating(false); setEdit(null); toast("green", "Pegawai tersimpan."); router.refresh(); }} />}
      {roleEdit && <RoleModal role={roleEdit} permissions={permissions} onClose={() => setRoleEdit(null)} onSaved={() => { setRoleEdit(null); toast("green", "Izin peran diperbarui."); router.refresh(); }} />}
    </div>
  );
}

function UserModal({ user, roles, onClose, onSaved }: { user: U | null; roles: R[]; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ name: user?.name ?? "", username: user?.username ?? "", password: "", phone: user?.phone ?? "", roleKey: user?.roleKey ?? roles[0]?.key ?? "KASIR", active: user?.active ?? true, vehicle: user?.vehicle ?? "" });
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  async function submit() {
    setErr(null); setSaving(true);
    const body = { ...f, password: f.password || undefined, phone: f.phone || null, vehicle: f.vehicle || null };
    try { if (user) await apiFetch(`/api/users/${user.id}`, { method: "PATCH", body }); else await apiFetch("/api/users", { body }); onSaved(); } catch (e) { setErr((e as Error).message); }
    setSaving(false);
  }
  return (
    <Modal open onClose={onClose} title={user ? "Ubah pegawai" : "Pegawai baru"} footer={<><Button variant="ghost" onClick={onClose}>Batal</Button><Button loading={saving} onClick={submit}>Simpan</Button></>}>
      <div className="space-y-3">
        {err && <Alert>{err}</Alert>}
        <Field label="Nama" htmlFor="un" required><Input id="un" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Username" htmlFor="uu" required><Input id="uu" value={f.username} autoComplete="off" onChange={(e) => setF({ ...f, username: e.target.value.toLowerCase() })} /></Field>
        <Field label={user ? "Kata sandi baru (kosongkan bila tidak diubah)" : "Kata sandi"} htmlFor="up" required={!user} hint="Minimal 8 karakter"><Input id="up" type="password" autoComplete="new-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
        <Field label="Peran" htmlFor="ur"><Select id="ur" value={f.roleKey} onChange={(e) => setF({ ...f, roleKey: e.target.value })}>{roles.map((r) => <option key={r.key} value={r.key}>{r.name}</option>)}</Select></Field>
        <Field label="No. HP / WhatsApp" htmlFor="uph"><Input id="uph" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
        {f.roleKey === "KURIR" && <Field label="Kendaraan" htmlFor="uv"><Input id="uv" value={f.vehicle} onChange={(e) => setF({ ...f, vehicle: e.target.value })} placeholder="Motor / Mobil" /></Field>}
        {user && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} /> Akun aktif</label>}
      </div>
    </Modal>
  );
}

function RoleModal({ role, permissions, onClose, onSaved }: { role: R; permissions: P[]; onClose: () => void; onSaved: () => void }) {
  const [sel, setSel] = useState(new Set(role.permissions));
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  return (
    <Modal wide open onClose={onClose} title={`Izin: ${role.name}`} footer={<><Button variant="ghost" onClick={onClose}>Batal</Button><Button loading={saving} onClick={async () => {
      setErr(null); setSaving(true);
      try { await apiFetch(`/api/roles/${role.key}/permissions`, { method: "PUT", body: { permissions: [...sel] } }); onSaved(); } catch (e) { setErr((e as Error).message); }
      setSaving(false);
    }}>Simpan izin</Button></>}>
      {err && <div className="mb-3"><Alert>{err}</Alert></div>}
      <div className="grid gap-1.5 sm:grid-cols-2">
        {permissions.map((p) => (
          <label key={p.key} className="flex items-start gap-2 rounded-md p-1.5 text-sm hover:bg-slate-50">
            <input type="checkbox" className="mt-0.5" checked={sel.has(p.key)} onChange={(e) => { const n = new Set(sel); if (e.target.checked) n.add(p.key); else n.delete(p.key); setSel(n); }} />
            <span>{p.description}{p.privileged && <Badge tone="violet">Finansial/Owner</Badge>}<span className="block font-mono text-[10px] text-slate-400">{p.key}</span></span>
          </label>
        ))}
      </div>
    </Modal>
  );
}
