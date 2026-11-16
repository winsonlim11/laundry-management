import { api, query } from "@/server/http";
import { getReport } from "@/server/services/reports";
export const GET = api(async ({ req, actor }) => getReport(actor, query(req)));
