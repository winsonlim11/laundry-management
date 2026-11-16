import { api, body, id } from "@/server/http";
import { z } from "zod";
import { assignOperator } from "@/server/services/orders";
const input = z.object({ operatorId: z.number().int().positive().nullable() });
export const POST = api<{ id: string }>(async ({ req, params, actor }) => assignOperator(actor, id(params.id), input.parse(await body(req)).operatorId));
