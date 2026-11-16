import { api, body, id } from "@/server/http";
import { archiveCustomer, getCustomerProfile, updateCustomer } from "@/server/services/customers";
type P = { id: string };
export const GET = api<P>(async ({ params, actor }) => getCustomerProfile(actor, id(params.id)));
export const PATCH = api<P>(async ({ req, params, actor }) => updateCustomer(actor, id(params.id), await body(req)));
export const DELETE = api<P>(async ({ params, actor }) => archiveCustomer(actor, id(params.id)));
