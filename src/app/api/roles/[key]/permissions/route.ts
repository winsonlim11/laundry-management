import { api, body } from "@/server/http";
import { z } from "zod";
import { setRolePermissions } from "@/server/services/users";
const input = z.object({ permissions: z.array(z.string()) });
export const PUT = api<{ key: string }>(async ({ req, params, actor }) => {
  const key = z.enum(["OWNER", "ADMIN", "KASIR", "OPERATOR", "KURIR"]).parse(params.key);
  await setRolePermissions(actor, key, input.parse(await body(req)).permissions);
  return { ok: true };
});
