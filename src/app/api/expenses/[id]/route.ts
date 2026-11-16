import { api, id } from "@/server/http";
import { deleteExpense } from "@/server/services/expenses";
export const DELETE = api<{ id: string }>(async ({ params, actor }) => { await deleteExpense(actor, id(params.id)); return { ok: true }; });
