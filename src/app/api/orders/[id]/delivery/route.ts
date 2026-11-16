import { api, body, id } from "@/server/http";
import { createDelivery } from "@/server/services/logistics";
export const POST = api<{ id: string }>(async ({ req, params, actor }) => createDelivery(actor, id(params.id), await body(req)));
