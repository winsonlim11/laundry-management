import { api, body, id } from "@/server/http";
import { recordPayment } from "@/server/services/payments";
export const POST = api<{ id: string }>(async ({ req, params, actor }) => {
  const b = (await body(req)) as Record<string, unknown>;
  const key = req.headers.get("idempotency-key") ?? b.idempotencyKey;
  return recordPayment(actor, id(params.id), { ...b, idempotencyKey: key ?? undefined });
});
