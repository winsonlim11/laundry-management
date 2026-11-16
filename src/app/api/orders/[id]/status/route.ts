import { api, body, id } from "@/server/http";
import { z } from "zod";
import { transitionOrder } from "@/server/services/orders";
import { ORDER_STATUS_LABEL } from "@/lib/status";
const input = z.object({ to: z.enum(Object.keys(ORDER_STATUS_LABEL) as [keyof typeof ORDER_STATUS_LABEL]), note: z.string().max(300).optional() });
export const POST = api<{ id: string }>(async ({ req, params, actor }) => { const b = input.parse(await body(req)); return transitionOrder(actor, id(params.id), b.to, b.note); });
