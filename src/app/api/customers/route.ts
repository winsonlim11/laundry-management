import { api, body, query } from "@/server/http";
import { createCustomer, searchCustomers } from "@/server/services/customers";
export const GET = api(async ({ req, actor }) => searchCustomers(actor, query(req).q ?? "", Math.min(Number(query(req).take ?? 20), 100)));
export const POST = api(async ({ req, actor }) => createCustomer(actor, await body(req)));
