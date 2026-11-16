import { api, body, query } from "@/server/http";
import { createService, listServices } from "@/server/services/catalog";
export const GET = api(async ({ req }) => listServices(query(req).archived === "1"));
export const POST = api(async ({ req, actor }) => createService(actor, await body(req)));
