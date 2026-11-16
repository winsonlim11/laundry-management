"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, CheckCircle2, CircleAlert, Database, Download, Pencil, Plus } from "lucide-react";
import { Alert, Badge, Button, Card, Field, Input, Modal, Select, Textarea, cx, useToast } from "@/components/ui";
import { apiFetch } from "@/lib/client";
import { rupiah } from "@/lib/money";
import { FLOW_LABEL } from "@/lib/status";

/* eslint-disable @typescript-eslint/no-explicit-any */
type S = any;
type Svc = { id: number; code: string; name: string; unit: "KG" | "PCS"; flow: "WASH_DRY" | "WASH_IRON" | "IRON_ONLY"; price: number; expressPrice: number; estimateHours: number; expressEstimateHours: number; active: boolean; sortOrder: number; archivedAt: string | null };
type I = { key: string; name: string; ready: boolean; detail: string; env: string[]; verified: boolean };

export function SettingsTabs({ settings, services, integrations, can }: { settings: S; services: Svc[]; integrations: I[]; can: { settings: boolean; services: boolean; backup: boolean } }) {
  const tabs = [
    can.settings && ["usaha", "Identitas usaha"],
    can.services && ["layanan", "Layanan & tarif"],
    can.settings && ["struk", "Struk & printer"],
    can.settings && ["biaya", "Biaya & poin"],
    can.settings && ["integrasi", "Integrasi"],
    can.backup && ["backup", "Backup"],
  ].filter(Boolean) as [string, string][];
  const [tab, setTab] = useState(tabs[0]?.[0]);
  return (
    <div className="space-y-4">
      <div className="flex gap-1 overflow-x-auto border-b border-slate-200" role="tablist">
        {tabs.map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={cx("whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium", tab === k ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-800")}>{l}</button>
        ))}
      </div>
      {tab === "usaha" && <BusinessForm s={settings} />}
      {tab === "layanan" && <ServicesTab services={services} />}
      {tab === "struk" && <ReceiptForm s={settings} />}
      {tab === "biaya" && <FeesForm s={settings} />}
      {tab === "integrasi" && <Integrations items={integrations} />}
      {tab === "backup" && <BackupTab />}
    </div>
  );
}

function useSave() {
  const router = useRouter();
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const save = async (body: unknown) => {
    setErr(null); setSaving(true);
    try { await apiFetch("/api/settings", { method: "PATCH", body }); toast("green", "Pengaturan tersimpan."); router.refresh(); } catch (e) { setErr((e as Error).message); }
    setSaving(false);
  };
  return { saving, err, save };
}

function BusinessForm({ s }: { s: S }) {
  const [f, setF] = useState({ name: s.name, address: s.address, whatsapp: s.whatsapp, logoDataUrl: s.logoDataUrl as string | null });
  const { saving, err, save } = useSave();
  const [logoErr, setLogoErr] = useState<string | null>(null);
  return (
    <Card title="Identitas usaha">
      <div className="max-w-xl space-y-3">
        {err && <Alert>{err}</Alert>}
        <Field label="Nama usaha (tampil di struk & aplikasi)" htmlFor="bn" required><Input id="bn" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Alamat" htmlFor="ba"><Textarea id="ba" rows={2} value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></Field>
        <Field label="WhatsApp usaha" htmlFor="bw"><Input id="bw" value={f.whatsapp} onChange={(e) => setF({ ...f, whatsapp: e.target.value })} /></Field>
        <Field label="Logo (PNG/JPG/WEBP, maks. 300 KB)" htmlFor="bl" error={logoErr}>
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {f.logoDataUrl && <img src={f.logoDataUrl} alt="Logo" className="size-12 rounded border object-contain" />}
            <input id="bl" type="file" accept="image/png,image/jpeg,image/webp" className="text-sm" onChange={(e) => {
              const file = e.target.files?.[0]; setLogoErr(null);
              if (!file) return;
              if (file.size > 300_000) return setLogoErr("Ukuran logo maksimal 300 KB.");
              const r = new FileReader(); r.onload = () => setF({ ...f, logoDataUrl: String(r.result) }); r.readAsDataURL(file);
            }} />
            {f.logoDataUrl && <Button size="sm" variant="ghost" onClick={() => setF({ ...f, logoDataUrl: null })}>Hapus</Button>}
          </div>
        </Field>
        <Button loading={saving} onClick={() => save(f)}>Simpan</Button>
      </div>
    </Card>
  );
}

function ReceiptForm({ s }: { s: S }) {
  const [f, setF] = useState({ receiptFooter: s.receiptFooter, receiptWidth: s.receiptWidth, printerName: s.printerName, showLogoOnReceipt: s.showLogoOnReceipt, qrisStaticPayload: s.qrisStaticPayload ?? "" });
  const { saving, err, save } = useSave();
  return (
    <Card title="Format struk & printer termal">
      <div className="max-w-xl space-y-3">
        {err && <Alert>{err}</Alert>}
        <Field label="Lebar kertas" htmlFor="rw"><Select id="rw" value={f.receiptWidth} onChange={(e) => setF({ ...f, receiptWidth: Number(e.target.value) })}><option value={58}>58 mm</option><option value={80}>80 mm</option></Select></Field>
        <Field label="Nama printer (pengingat saat mencetak)" htmlFor="rp" hint="Cetak dari browser: pilih printer termal ini di dialog cetak, margin 'None', skala 100%."><Input id="rp" value={f.printerName} onChange={(e) => setF({ ...f, printerName: e.target.value })} placeholder="mis. POS-58" /></Field>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.showLogoOnReceipt} onChange={(e) => setF({ ...f, showLogoOnReceipt: e.target.checked })} /> Tampilkan logo di struk</label>
        <Field label="Catatan kaki struk" htmlFor="rf"><Textarea id="rf" rows={2} value={f.receiptFooter} onChange={(e) => setF({ ...f, receiptFooter: e.target.value })} /></Field>
        <Field label="Payload QRIS statis (opsional)" htmlFor="rq" hint="Isi teks QRIS merchant (diawali 000201…). QR pembayaran akan tampil di struk bila masih ada sisa tagihan. Kode ini terpisah dari QR kode nota."><Textarea id="rq" rows={3} className="font-mono text-xs" value={f.qrisStaticPayload} onChange={(e) => setF({ ...f, qrisStaticPayload: e.target.value })} /></Field>
        <Button loading={saving} onClick={() => save({ ...f, qrisStaticPayload: f.qrisStaticPayload || null })}>Simpan</Button>
      </div>
    </Card>
  );
}

function FeesForm({ s }: { s: S }) {
  const [f, setF] = useState({ defaultPickupFee: String(s.defaultPickupFee), defaultDeliveryFee: String(s.defaultDeliveryFee), pointsPerAmount: String(s.pointsPerAmount), pointsEnabled: s.pointsEnabled });
  const { saving, err, save } = useSave();
  const n = (v: string) => Number(v.replace(/[^\d]/g, "") || 0);
  return (
    <Card title="Biaya jemput/antar & aturan poin">
      <div className="max-w-xl space-y-3">
        {err && <Alert>{err}</Alert>}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Biaya jemput default (Rp)" htmlFor="fp"><Input id="fp" inputMode="numeric" value={f.defaultPickupFee} onChange={(e) => setF({ ...f, defaultPickupFee: e.target.value })} /></Field>
          <Field label="Biaya antar default (Rp)" htmlFor="fd"><Input id="fd" inputMode="numeric" value={f.defaultDeliveryFee} onChange={(e) => setF({ ...f, defaultDeliveryFee: e.target.value })} /></Field>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.pointsEnabled} onChange={(e) => setF({ ...f, pointsEnabled: e.target.checked })} /> Aktifkan poin loyalitas</label>
        <Field label="1 poin untuk setiap kelipatan (Rp)" htmlFor="pp" hint={`Dihitung dari nilai layanan setelah diskon, dicatat sekali saat pesanan Selesai & Lunas. Contoh: belanja ${rupiah(36500)} → ${Math.floor(31500 / Math.max(1, n(f.pointsPerAmount)))} poin.`}><Input id="pp" inputMode="numeric" value={f.pointsPerAmount} onChange={(e) => setF({ ...f, pointsPerAmount: e.target.value })} /></Field>
        <Button loading={saving} onClick={() => save({ defaultPickupFee: n(f.defaultPickupFee), defaultDeliveryFee: n(f.defaultDeliveryFee), pointsPerAmount: n(f.pointsPerAmount), pointsEnabled: f.pointsEnabled })}>Simpan</Button>
      </div>
    </Card>
  );
}

function ServicesTab({ services }: { services: Svc[] }) {
  const router = useRouter();
  const toast = useToast();
  const [edit, setEdit] = useState<Svc | null | "new">(null);
  return (
    <Card title="Katalog layanan & tarif" padded={false} actions={<Button size="sm" icon={<Plus className="size-3.5" />} onClick={() => setEdit("new")}>Layanan baru</Button>}>
      <p className="border-b border-slate-100 px-4 py-2 text-xs text-slate-500">Perubahan tarif hanya berlaku untuk nota baru — nota lama menyimpan salinan nama, satuan, dan tarif. Layanan yang sudah dipakai transaksi diarsipkan, bukan dihapus.</p>
      <div className="overflow-x-auto">
        <table className="tabular w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500"><tr><th className="px-4 py-2 font-medium">Layanan</th><th className="px-4 py-2 font-medium">Alur</th><th className="px-4 py-2 text-right font-medium">Reguler</th><th className="px-4 py-2 text-right font-medium">Express</th><th className="px-4 py-2 text-right font-medium">Estimasi</th><th className="px-4 py-2 font-medium">Status</th><th /></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {services.map((s) => (
              <tr key={s.id} className={s.archivedAt ? "opacity-50" : ""}>
                <td className="px-4 py-2.5"><span className="font-medium">{s.name}</span> <span className="font-mono text-xs text-slate-400">{s.code}</span></td>
                <td className="px-4 py-2.5 text-xs text-slate-600">{FLOW_LABEL[s.flow]}</td>
                <td className="px-4 py-2.5 text-right">{rupiah(s.price)}/{s.unit.toLowerCase()}</td>
                <td className="px-4 py-2.5 text-right">{rupiah(s.expressPrice)}/{s.unit.toLowerCase()}</td>
                <td className="px-4 py-2.5 text-right text-xs">{s.estimateHours} j · {s.expressEstimateHours} j</td>
                <td className="px-4 py-2.5">{s.archivedAt ? <Badge>Diarsipkan</Badge> : s.active ? <Badge tone="green">Aktif</Badge> : <Badge tone="amber">Nonaktif</Badge>}</td>
                <td className="whitespace-nowrap px-4 py-2.5 text-right">
                  {!s.archivedAt && <>
                    <Button size="sm" variant="ghost" icon={<Pencil className="size-3.5" />} onClick={() => setEdit(s)} aria-label={`Ubah ${s.name}`} />
                    <Button size="sm" variant="ghost" icon={<Archive className="size-3.5" />} aria-label={`Arsipkan ${s.name}`} onClick={async () => {
                      if (!confirm(`Arsipkan/hapus layanan ${s.name}?`)) return;
                      try { const r = await apiFetch<{ deleted?: boolean }>(`/api/services/${s.id}`, { method: "DELETE" }); toast("green", r.deleted ? "Layanan dihapus." : "Layanan diarsipkan."); router.refresh(); } catch (e) { toast("red", (e as Error).message); }
                    }} />
                  </>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {edit && <ServiceModal svc={edit === "new" ? null : edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); toast("green", "Layanan tersimpan."); router.refresh(); }} />}
    </Card>
  );
}

function ServiceModal({ svc, onClose, onSaved }: { svc: Svc | null; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ code: svc?.code ?? "", name: svc?.name ?? "", unit: svc?.unit ?? "KG", flow: svc?.flow ?? "WASH_IRON", price: String(svc?.price ?? ""), expressPrice: String(svc?.expressPrice ?? ""), estimateHours: String(svc?.estimateHours ?? 48), expressEstimateHours: String(svc?.expressEstimateHours ?? 24), active: svc?.active ?? true, sortOrder: String(svc?.sortOrder ?? 0) });
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <Modal open onClose={onClose} title={svc ? `Ubah ${svc.name}` : "Layanan baru"} footer={<><Button variant="ghost" onClick={onClose}>Batal</Button><Button loading={saving} onClick={async () => {
      setErr(null); setSaving(true);
      const body = { ...f, price: Number(f.price), expressPrice: Number(f.expressPrice), estimateHours: Number(f.estimateHours), expressEstimateHours: Number(f.expressEstimateHours), sortOrder: Number(f.sortOrder) };
      try { if (svc) await apiFetch(`/api/services/${svc.id}`, { method: "PATCH", body }); else await apiFetch("/api/services", { body }); onSaved(); } catch (e) { setErr((e as Error).message); }
      setSaving(false);
    }}>Simpan</Button></>}>
      <div className="grid grid-cols-2 gap-3">
        {err && <div className="col-span-2"><Alert>{err}</Alert></div>}
        <Field label="Kode" htmlFor="sc" required><Input id="sc" value={f.code} onChange={set("code")} /></Field>
        <Field label="Nama" htmlFor="sn" required><Input id="sn" value={f.name} onChange={set("name")} /></Field>
        <Field label="Satuan" htmlFor="su"><Select id="su" value={f.unit} onChange={set("unit")}><option value="KG">KG</option><option value="PCS">PCS</option></Select></Field>
        <Field label="Alur pengerjaan" htmlFor="sf"><Select id="sf" value={f.flow} onChange={set("flow")}>{Object.entries(FLOW_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
        <Field label="Tarif reguler (Rp)" htmlFor="sp" required><Input id="sp" inputMode="numeric" value={f.price} onChange={set("price")} /></Field>
        <Field label="Tarif express (Rp)" htmlFor="se" required><Input id="se" inputMode="numeric" value={f.expressPrice} onChange={set("expressPrice")} /></Field>
        <Field label="Estimasi reguler (jam)" htmlFor="sh"><Input id="sh" inputMode="numeric" value={f.estimateHours} onChange={set("estimateHours")} /></Field>
        <Field label="Estimasi express (jam)" htmlFor="sx"><Input id="sx" inputMode="numeric" value={f.expressEstimateHours} onChange={set("expressEstimateHours")} /></Field>
        <Field label="Urutan tampil" htmlFor="so"><Input id="so" inputMode="numeric" value={f.sortOrder} onChange={set("sortOrder")} /></Field>
        <label className="col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} /> Tampilkan di kasir</label>
      </div>
    </Modal>
  );
}

function Integrations({ items }: { items: I[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {items.map((i) => (
        <Card key={i.key}>
          <div className="flex items-start gap-3">
            {i.ready ? <CheckCircle2 className="mt-0.5 size-5 text-emerald-600" /> : <CircleAlert className="mt-0.5 size-5 text-amber-500" />}
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 font-medium">{i.name}{i.ready ? <Badge tone="green">Siap</Badge> : <Badge tone="amber">Perlu konfigurasi</Badge>}{!i.verified && <Badge tone="gray">Belum diuji dengan akun/perangkat nyata</Badge>}</p>
              <p className="mt-1 text-sm text-slate-600">{i.detail}</p>
              {i.env.length > 0 && <p className="mt-2 text-xs text-slate-500">Variabel environment: {i.env.map((e) => <code key={e} className="mr-1 rounded bg-slate-100 px-1 py-0.5">{e}</code>)}</p>}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

function BackupTab() {
  return (
    <Card title="Backup database" actions={<Database className="size-4 text-slate-400" />}>
      <div className="max-w-2xl space-y-3 text-sm">
        <p>Unduh salinan seluruh data (pelanggan, pesanan, pembayaran, riwayat, pengeluaran, foto bukti, pengaturan) dalam format JSON. Hanya Owner yang dapat mengunduh; setiap unduhan tercatat di log aktivitas.</p>
        <a href="/api/backup" className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand-600 px-3.5 font-medium text-white hover:bg-brand-700"><Download className="size-4" />Unduh backup sekarang</a>
        <Alert tone="blue">Untuk produksi, aktifkan juga backup otomatis/point-in-time di penyedia database (mis. Neon) dan simpan file backup di tempat aman. Langkah pemulihan ada di <code>docs/BACKUP.md</code>.</Alert>
      </div>
    </Card>
  );
}
