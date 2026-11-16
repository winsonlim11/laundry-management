import { api, query } from "@/server/http";
import { getReport } from "@/server/services/reports";
import { reportToPdf, reportToXlsx } from "@/server/exports";
import { getSettings } from "@/server/services/settings";
import { logActivity } from "@/server/services/activity";
import { prisma } from "@/server/db";
/** Ekspor memakai fungsi laporan & filter yang sama dengan layar. */
export const GET = api(async ({ req, actor }) => {
  const q = query(req);
  const report = await getReport(actor, q);
  const settings = await getSettings();
  const svc = report.query.serviceId ? await prisma.service.findUnique({ where: { id: report.query.serviceId } }) : null;
  const fname = `laporan-${report.query.from}_${report.query.to}`;
  await logActivity(prisma, actor, "report.export", "report", undefined, { format: q.format, ...report.query });
  if (q.format === "pdf") {
    const buf = await reportToPdf(report, settings.name, svc?.name);
    return new Response(new Uint8Array(buf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${fname}.pdf"` } });
  }
  const buf = await reportToXlsx(report, settings.name, svc?.name);
  return new Response(new Uint8Array(buf), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${fname}.xlsx"` } });
});
