import { api, body } from "@/server/http";
import { createFirstOwner } from "@/server/services/setup";
export const POST = api(async ({ req }) => { const u = await createFirstOwner(await body(req)); return { ok: true, username: u.username }; }, { auth: false });
