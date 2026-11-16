import { pageActor } from "@/server/page";
import { prisma } from "@/server/db";
import { ACTION_LABEL } from "@/server/services/activity";
import { Card, PageHeader } from "@/components/ui";
import { formatDateTime } from "@/lib/time";

export const metadata = { title: "Log aktivitas" };

export default async function ActivityPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await pageActor("activity.view");
  const page = Math.max(1, Number((await searchParams).page ?? 1));
  const rows = await prisma.activityLog.findMany({ orderBy: { createdAt: "desc" }, skip: (page - 1) * 50, take: 51 });
  return (
    <div>
      <PageHeader title="Log aktivitas" subtitle="Tindakan penting beserta pelaku dan waktu" />
      <Card padded={false}>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500"><tr><th className="px-4 py-2 font-medium">Waktu</th><th className="px-4 py-2 font-medium">Pegawai</th><th className="px-4 py-2 font-medium">Tindakan</th><th className="hidden px-4 py-2 font-medium md:table-cell">Detail</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {rows.slice(0, 50).map((r) => (
              <tr key={r.id}><td className="whitespace-nowrap px-4 py-2 text-xs">{formatDateTime(r.createdAt)}</td><td className="px-4 py-2">{r.userName}</td><td className="px-4 py-2">{ACTION_LABEL[r.action] ?? r.action}{r.entity && <span className="text-xs text-slate-500"> · {r.entity} #{r.entityId}</span>}</td><td className="hidden max-w-md truncate px-4 py-2 font-mono text-[11px] text-slate-500 md:table-cell">{r.detail ? JSON.stringify(r.detail) : ""}</td></tr>
            ))}
          </tbody>
        </table>
      </Card>
      <div className="mt-3 flex justify-end gap-2 text-sm">
        {page > 1 && <a className="rounded-lg border bg-white px-3 py-1.5" href={`?page=${page - 1}`}>Sebelumnya</a>}
        {rows.length > 50 && <a className="rounded-lg border bg-white px-3 py-1.5" href={`?page=${page + 1}`}>Berikutnya</a>}
      </div>
    </div>
  );
}
