import { api, body, query } from "@/server/http";
import { createOrder, listOrders } from "@/server/services/orders";
export const GET = api(async ({ req, actor }) => listOrders(actor, query(req)));
export const POST = api(async ({ req, actor }) => createOrder(actor, await body(req)));
