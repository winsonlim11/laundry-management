import { api, body, id } from "@/server/http";
import { cancelOrder } from "@/server/services/orders";
export const POST = api<{ id: string }>(async ({ req, params, actor }) => cancelOrder(actor, id(params.id), await body(req)));
