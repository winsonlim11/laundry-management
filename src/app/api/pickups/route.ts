import { api, body } from "@/server/http";
import { createPickup, listLogistics } from "@/server/services/logistics";
export const GET = api(async ({ actor }) => (await listLogistics(actor)).pickups);
export const POST = api(async ({ req, actor }) => createPickup(actor, await body(req)));
