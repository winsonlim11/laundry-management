import { api, body, id } from "@/server/http";
import { updateUser } from "@/server/services/users";
export const PATCH = api<{ id: string }>(async ({ req, params, actor }) => { const { passwordHash: _p, ...u } = await updateUser(actor, id(params.id), await body(req)); void _p; return u; });
