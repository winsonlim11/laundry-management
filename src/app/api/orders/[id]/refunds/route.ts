import { api, body, id } from "@/server/http";
import { refund } from "@/server/services/payments";
export const POST = api<{ id: string }>(async ({ req, params, actor }) => {
  const b = (await body(req)) as Record<string, unknown>;
  return refund(actor, id(params.id), { ...b, idempotencyKey: req.headers.get("idempotency-key") ?? b.idempotencyKey ?? undefined });
});
