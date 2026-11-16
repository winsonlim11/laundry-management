"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, ScanLine } from "lucide-react";
import { Alert, Button, Card, Field, Input } from "@/components/ui";
import { apiFetch } from "@/lib/client";

type Detector = { detect: (src: HTMLVideoElement) => Promise<{ rawValue: string }[]> };

export function Scanner() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [camOn, setCamOn] = useState(false);
  const [supported, setSupported] = useState<boolean | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);

  useEffect(() => { setSupported(typeof window !== "undefined" && "BarcodeDetector" in window); return () => stream.current?.getTracks().forEach((t) => t.stop()); }, []);

  async function lookup(raw: string) {
    const value = raw.trim();
    if (!value) return;
    const ref = value.includes("/o/") ? value.split("/o/")[1].split(/[?#/]/)[0] : value;
    setErr(null); setBusy(true);
    try {
      const r = await apiFetch<{ id: number }>(`/api/orders/lookup?code=${encodeURIComponent(ref)}`);
      stream.current?.getTracks().forEach((t) => t.stop());
      router.push(`/pesanan/${r.id}`);
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  }

  async function startCam() {
    setErr(null);
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      stream.current = s; setCamOn(true);
      const v = video.current!; v.srcObject = s; await v.play();
      const Ctor = (window as unknown as { BarcodeDetector: new (o: unknown) => Detector }).BarcodeDetector;
      const det = new Ctor({ formats: ["qr_code", "code_128"] });
      const tick = async () => {
        if (!stream.current?.active) return;
        try { const r = await det.detect(v); if (r[0]?.rawValue) return lookup(r[0].rawValue); } catch { /* lanjut */ }
        requestAnimationFrame(tick);
      };
      tick();
    } catch { setErr("Kamera tidak dapat diakses. Izinkan akses kamera atau ketik kode secara manual."); }
  }

  return (
    <div className="space-y-4">
      <Card title="Kode nota">
        <form onSubmit={(e) => { e.preventDefault(); lookup(code); }} className="space-y-3">
          {err && <Alert>{err}</Alert>}
          <Field label="Kode / nomor nota" htmlFor="code" hint="Scanner barcode USB akan mengetik kode lalu menekan Enter otomatis.">
            <Input id="code" autoFocus value={code} onChange={(e) => setCode(e.target.value)} placeholder="mis. 7KQ2M9XWAB atau LND-261116-0001" className="font-mono" />
          </Field>
          <Button type="submit" loading={busy} icon={<ScanLine className="size-4" />}>Buka nota</Button>
        </form>
      </Card>
      <Card title="Kamera">
        {supported === false ? (
          <p className="text-sm text-slate-600">Browser ini belum mendukung pemindaian langsung. Arahkan aplikasi kamera ponsel ke QR di struk — tautannya membuka nota setelah login.</p>
        ) : (
          <div className="space-y-3">
            <video ref={video} className={camOn ? "w-full rounded-lg bg-black" : "hidden"} muted playsInline />
            {!camOn && <Button variant="secondary" icon={<Camera className="size-4" />} onClick={startCam}>Aktifkan kamera</Button>}
          </div>
        )}
      </Card>
    </div>
  );
}
