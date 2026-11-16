import { api, body, id } from "@/server/http";
import { archiveService, updateService } from "@/server/services/catalog";
type P = { id: string };
export const PATCH = api<P>(async ({ req, params, actor }) => updateService(actor, id(params.id), await body(req)));
export const DELETE = api<P>(async ({ params, actor }) => archiveService(actor, id(params.id)));
