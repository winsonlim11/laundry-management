import { api, body, id } from "@/server/http";
import { z } from "zod";
import { rejectPayment } from "@/server/services/payments";
export const POST = api<{ id: string }>(async ({ req, params, actor }) => rejectPayment(actor, id(params.id), z.object({ reason: z.string().max(300).optional() }).parse(await body(req)).reason));
