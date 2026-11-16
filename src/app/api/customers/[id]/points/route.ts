import { api, body, id } from "@/server/http";
import { z } from "zod";
import { adjustPoints } from "@/server/services/customers";
const input = z.object({ points: z.number().int(), note: z.string().max(200).default("") });
export const POST = api<{ id: string }>(async ({ req, params, actor }) => { const b = input.parse(await body(req)); await adjustPoints(actor, id(params.id), b.points, b.note); return { ok: true }; });
