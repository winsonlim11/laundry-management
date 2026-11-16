import { api } from "@/server/http";
import { getDashboard } from "@/server/services/reports";
export const GET = api(async ({ actor }) => getDashboard(actor));
