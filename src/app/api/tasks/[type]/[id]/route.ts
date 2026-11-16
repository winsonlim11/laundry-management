import { api, body, id } from "@/server/http";
import { z } from "zod";
import { assignTaskCourier, getTask } from "@/server/services/logistics";
import { badRequest } from "@/server/errors";
type P = { type: string; id: string };
const t = (s: string) => { if (s !== "pickup" && s !== "delivery") throw badRequest("Jenis tugas tidak valid."); return s; };
export const GET = api<P>(async ({ params, actor }) => getTask(actor, t(params.type), id(params.id)));
export const PATCH = api<P>(async ({ req, params, actor }) => assignTaskCourier(actor, t(params.type), id(params.id), z.object({ courierId: z.number().int().positive().nullable() }).parse(await body(req)).courierId));
