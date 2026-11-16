import { api, body, id } from "@/server/http";
import { z } from "zod";
import { advancePickup } from "@/server/services/logistics";
const input = z.object({ to: z.enum(["MENUNGGU_DIJEMPUT", "KURIR_MENUJU_LOKASI", "SUDAH_DIJEMPUT", "DITERIMA_LAUNDRY", "DIBATALKAN"]) });
export const POST = api<{ id: string }>(async ({ req, params, actor }) => advancePickup(actor, id(params.id), input.parse(await body(req)).to));
