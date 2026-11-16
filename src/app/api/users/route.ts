import { api, body } from "@/server/http";
import { createUser, listUsers } from "@/server/services/users";
export const GET = api(async ({ actor }) => (await listUsers(actor)).map(({ passwordHash: _p, ...u }) => { void _p; return u; }));
export const POST = api(async ({ req, actor }) => { const { passwordHash: _p, ...u } = await createUser(actor, await body(req)); void _p; return u; });
