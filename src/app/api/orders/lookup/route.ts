import { api, query } from "@/server/http";
import { findOrderByRef } from "@/server/services/orders";
export const GET = api(async ({ req, actor }) => ({ id: await findOrderByRef(actor, query(req).code ?? "") }));
