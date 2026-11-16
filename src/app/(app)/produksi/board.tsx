"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Clock, Zap } from "lucide-react";
import { Badge, Button, Select, cx, useToast } from "@/components/ui";
import { apiFetch } from "@/lib/client";
import { formatDateTime } from "@/lib/time";
import { ORDER_STATUS_LABEL, type OrderStatusT } from "@/lib/status";

type Card = { id: number; number: string; customer: string; status: string; handover: string; items: string[]; express: boolean; due: string | null; next: OrderStatusT | null; canMove: boolean; operatorId: number | null; operator: string | null };

export function ProductionBoard({ cols, cards, operators, canAssign }: { cols: { key: string; label: string }[]; cards: Card[]; operators: { id: number; name: string }[]; canAssign: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<number | null>(null);
  const run = async (id: number, fn: () => Promise<unknown>, ok: string) => {
    setBusy(id);
    try { await fn(); toast("green", ok); router.refresh(); } catch (e) { toast("red", (e as Error).message); }
    setBusy(null);
  };
  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-2">
      <div className="flex gap-3" style={{ minWidth: cols.length * 250 }}>
        {cols.map((c) => {
          const list = cards.filter((x) => x.status === c.key);
          return (
            <section key={c.key} className="w-[250px] shrink-0 rounded-xl bg-slate-100/70 p-2" aria-label={c.label}>
              <h2 className="mb-2 flex items-center justify-between px-1 text-xs font-semibold text-slate-600">{c.label}<span className="rounded bg-white px-1.5 text-slate-500">{list.length}</span></h2>
              <ul className="space-y-2">
                {list.map((o) => {
                  const late = o.due && new Date(o.due) < new Date();
                  return (
                    <li key={o.id} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                      <div className="flex items-center justify-between gap-2">
                        <Link href={`/pesanan/${o.id}`} className="font-mono text-xs font-medium text-brand-700 hover:underline">{o.number}</Link>
                        {o.express && <Badge tone="amber"><Zap className="mr-0.5 size-3" />Express</Badge>}
                      </div>
                      <p className="mt-1 text-sm font-medium">{o.customer}</p>
                      <p className="text-xs text-slate-600">{o.items.join(", ")}</p>
                      {o.due && <p className={cx("mt-1 flex items-center gap-1 text-[11px]", late ? "font-medium text-red-600" : "text-slate-500")}><Clock className="size-3" />{late ? "Terlambat · " : ""}{formatDateTime(o.due)}</p>}
                      {o.handover === "ANTAR" && <p className="text-[11px] text-slate-500">Diantar kurir</p>}
                      {canAssign ? (
                        <Select aria-label={`Operator ${o.number}`} className="mt-2 h-8 text-xs" defaultValue={o.operatorId ?? ""} disabled={busy === o.id} onChange={(e) => run(o.id, () => apiFetch(`/api/orders/${o.id}/assign`, { body: { operatorId: e.target.value ? Number(e.target.value) : null } }), "Operator diperbarui.")}>
                          <option value="">— Tugaskan operator —</option>
                          {operators.map((op) => <option key={op.id} value={op.id}>{op.name}</option>)}
                        </Select>
                      ) : o.operator && <p className="mt-1 text-[11px] text-slate-500">Operator: {o.operator}</p>}
                      {o.next && o.canMove && (
                        <Button className="mt-2 w-full" size="lg" loading={busy === o.id} icon={<ArrowRight className="size-4" />} onClick={() => run(o.id, () => apiFetch(`/api/orders/${o.id}/status`, { body: { to: o.next } }), `${o.number}: ${ORDER_STATUS_LABEL[o.next!]}`)}>
                          {ORDER_STATUS_LABEL[o.next]}
                        </Button>
                      )}
                      {o.status === "SIAP_DIAMBIL" && <p className="mt-2 rounded bg-emerald-50 px-2 py-1 text-[11px] text-emerald-700">{o.handover === "ANTAR" ? "Menunggu kurir" : "Menunggu diambil pelanggan"}</p>}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
