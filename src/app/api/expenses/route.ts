import { api, body, query } from "@/server/http";
import { createExpense, listExpenses } from "@/server/services/expenses";
import { localDateKey } from "@/lib/time";
export const GET = api(async ({ req, actor }) => { const q = query(req); const t = localDateKey(); return listExpenses(actor, q.from ?? t.slice(0, 8) + "01", q.to ?? t); });
export const POST = api(async ({ req, actor }) => createExpense(actor, await body(req)));
