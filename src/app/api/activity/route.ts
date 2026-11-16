import { api, query } from "@/server/http";
import { prisma } from "@/server/db";
import { requirePerm } from "@/server/actor";
export const GET = api(async ({ req, actor }) => {
  requirePerm(actor, "activity.view");
  const page = Math.max(1, Number(query(req).page ?? 1));
  return prisma.activityLog.findMany({ orderBy: { createdAt: "desc" }, skip: (page - 1) * 50, take: 50 });
});
