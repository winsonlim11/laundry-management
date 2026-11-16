import { api } from "@/server/http";
export const GET = api(async ({ actor }) => ({ id: actor.id, name: actor.name, role: actor.roleKey, roleName: actor.roleName, permissions: [...actor.permissions] }));
