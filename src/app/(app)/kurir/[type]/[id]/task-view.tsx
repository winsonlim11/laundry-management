"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ArrowLeft, Camera, CheckCircle2, MapPin, MessageCircle, Navigation, Phone } from "lucide-react";
import { Alert, Button, Card, useToast } from "@/components/ui";
import { TaskBadge } from "@/components/status-badge";
import { apiFetch } from "@/lib/client";
import { formatDateTime } from "@/lib/time";
import { rupiah } from "@/lib/money";
import { DELIVERY_NEXT, DELIVERY_STATUS_LABEL, PICKUP_NEXT, PICKUP_STATUS_LABEL, statusLabel } from "@/lib/status";

type T = { id: number; number: string; name: string; phone: string; address: string; mapsHref: string; notes: string | null; status: string; scheduledAt: string; courier: string | null; photos: { id: number; at: string }[]; history: { id: number; from: string | null; to: string; at: string; by: string | null }[]; order: { id: number; number: string; due: number | null; status: string | null } | null };

const ACTION: Record<string, string> = {
  KURIR_MENUJU_LOKASI: "Berangkat ke lokasi",
  SUDAH_DIJEMPUT: "Cucian sudah dijemput",
  DITERIMA_LAUNDRY: "Serahkan ke laundry",
  DALAM_PENGANTARAN: "Mulai antar",
  BERHASIL_DIANTAR: "Konfirmasi diterima pelanggan",
};

export function TaskView({ type, task, isStaff }: { type: "pickup" | "delivery"; task: T; isStaff: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const file = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const next = type === "pickup" ? PICKUP_NEXT[task.status as keyof typeof PICKUP_NEXT] : DELIVERY_NEXT[task.status as keyof typeof DELIVERY_NEXT];
  const needsPhoto = (next === "SUDAH_DIJEMPUT" || next === "BERHASIL_DIANTAR") && task.photos.length === 0;
  const notReady = type === "delivery" && next === "DALAM_PENGANTARAN" && task.order?.status !== "SIAP_DIAMBIL";

  async function advance(to: string) {
    setErr(null); setBusy("adv");
    try {
      await apiFetch(`/api/${type === "pickup" ? "pickups" : "deliveries"}/${task.id}/status`, { body: { to } });
      toast("green", `Status: ${(type === "pickup" ? PICKUP_STATUS_LABEL : DELIVERY_STATUS_LABEL)[to as never]}`);
      router.refresh();
    } catch (e) { setErr((e as Error).message); }
    setBusy(null);
  }
  async function upload(f: File) {
    setErr(null);
    if (f.size > 3 * 1024 * 1024) return setErr("Ukuran foto maksimal 3 MB.");
    setBusy("up");
    const form = new FormData();
    form.append("photo", await compress(f));
    try { await apiFetch(`/api/tasks/${type}/${task.id}/photos`, { form }); toast("green", "Foto bukti terunggah."); router.refresh(); } catch (e) { setErr((e as Error).message); }
    setBusy(null);
    if (file.current) file.current.value = "";
  }

  return (
    <div className="mx-auto max-w-lg space-y-4 pb-36">
      <Link href={isStaff ? "/logistik" : "/kurir"} className="inline-flex items-center gap-1 text-sm text-slate-600"><ArrowLeft className="size-4" /> Kembali</Link>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{type === "pickup" ? "Penjemputan" : "Pengantaran"} · {task.number}</p>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold">{task.name}</h1>
        <div className="mt-1"><TaskBadge s={task.status} /></div>
      </div>
      {err && <Alert>{err}</Alert>}
      <Card>
        <p className="flex items-start gap-2 text-base"><MapPin className="mt-1 size-5 shrink-0 text-slate-400" />{task.address}</p>
        {task.notes && <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">Catatan: {task.notes}</p>}
        <p className="mt-2 text-sm text-slate-500">Jadwal {formatDateTime(task.scheduledAt)}</p>
        {task.order && <p className="mt-1 text-sm">Nota <span className="font-mono">{task.order.number}</span>{task.order.due !== null && task.order.due > 0 && <span className="ml-2 font-semibold text-amber-700">Tagih {rupiah(task.order.due)}</span>}</p>}
        <div className="mt-4 grid grid-cols-3 gap-2">
          <a href={task.mapsHref} target="_blank" rel="noopener" className="flex h-14 flex-col items-center justify-center rounded-xl bg-brand-50 text-xs font-medium text-brand-700"><Navigation className="size-5" />Maps</a>
          <a href={`https://wa.me/${task.phone}`} target="_blank" rel="noopener" className="flex h-14 flex-col items-center justify-center rounded-xl bg-emerald-50 text-xs font-medium text-emerald-700"><MessageCircle className="size-5" />WhatsApp</a>
          <a href={`tel:+${task.phone}`} className="flex h-14 flex-col items-center justify-center rounded-xl bg-slate-100 text-xs font-medium text-slate-700"><Phone className="size-5" />Telepon</a>
        </div>
      </Card>
      <Card title={`Foto bukti (${task.photos.length})`}>
        {task.photos.length > 0 && (
          <div className="mb-3 grid grid-cols-3 gap-2">
            {task.photos.map((p) => (
              <a key={p.id} href={`/api/photos/${p.id}`} target="_blank" rel="noopener" className="block aspect-square overflow-hidden rounded-lg bg-slate-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/photos/${p.id}`} alt={`Foto bukti ${formatDateTime(p.at)}`} className="size-full object-cover" />
              </a>
            ))}
          </div>
        )}
        <input ref={file} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="sr-only" id="photo" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        <label htmlFor="photo" className="flex h-14 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 text-base font-medium text-slate-700 active:bg-slate-50">
          <Camera className="size-5" />{busy === "up" ? "Mengunggah…" : "Ambil / unggah foto"}
        </label>
        <p className="mt-1 text-xs text-slate-500">JPG/PNG/WEBP, maks. 3 MB. Foto hanya dapat dilihat petugas yang berwenang.</p>
      </Card>
      <Card title="Riwayat">
        <ol className="space-y-2 text-sm">
          {task.history.map((h) => <li key={h.id}><span className="font-medium">{statusLabel(type === "pickup" ? "PICKUP" : "DELIVERY", h.to)}</span><span className="block text-xs text-slate-500">{formatDateTime(h.at)} · {h.by}</span></li>)}
        </ol>
      </Card>
      {isStaff && task.status !== "DIBATALKAN" && !["DITERIMA_LAUNDRY", "BERHASIL_DIANTAR"].includes(task.status) && (
        <Button variant="secondary" className="w-full text-red-700" loading={busy === "cancel"} onClick={() => { if (confirm("Batalkan tugas ini?")) advance("DIBATALKAN"); }}>Batalkan tugas</Button>
      )}
      {type === "pickup" && task.status === "DITERIMA_LAUNDRY" && !task.order && isStaff && <Link href={`/kasir?pickup=${task.id}`} className="flex h-12 items-center justify-center rounded-xl bg-brand-600 font-medium text-white">Timbang & buat nota</Link>}

      {next && (
        <div className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white p-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] md:left-60">
          <div className="mx-auto max-w-lg">
            {needsPhoto && <p className="mb-2 text-center text-xs text-amber-700">Unggah foto bukti terlebih dahulu.</p>}
            {notReady && <p className="mb-2 text-center text-xs text-amber-700">Pesanan belum siap diantar.</p>}
            <Button size="xl" variant={next === "BERHASIL_DIANTAR" || next === "DITERIMA_LAUNDRY" ? "success" : "primary"} disabled={needsPhoto || notReady} loading={busy === "adv"} icon={<CheckCircle2 className="size-6" />} onClick={() => advance(next)}>
              {ACTION[next]}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Perkecil foto di perangkat sebelum diunggah (hemat kuota). */
async function compress(f: File): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(f);
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
    c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", 0.8));
    return blob && blob.size < f.size ? new File([blob], "bukti.jpg", { type: "image/jpeg" }) : f;
  } catch { return f; }
}
