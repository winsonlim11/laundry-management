import { api, body, id } from "@/server/http";
import { z } from "zod";
import { advanceDelivery } from "@/server/services/logistics";
const input = z.object({ to: z.enum(["MENUNGGU_DIANTAR", "DALAM_PENGANTARAN", "BERHASIL_DIANTAR", "DIBATALKAN"]) });
export const POST = api<{ id: string }>(async ({ req, params, actor }) => advanceDelivery(actor, id(params.id), input.parse(await body(req)).to));
