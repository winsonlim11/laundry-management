import { api, body } from "@/server/http";
import { z } from "zod";
import { sendWhatsApp } from "@/server/services/whatsapp";
import { requirePerm } from "@/server/actor";
const input = z.object({ phone: z.string().min(8).max(20), message: z.string().min(1).max(2000) });
export const POST = api(async ({ req, actor }) => { requirePerm(actor, "orders.view_all"); const b = input.parse(await body(req)); return sendWhatsApp(b.phone, b.message); });
