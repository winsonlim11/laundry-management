import { api, body } from "@/server/http";
import { getSettings, updateSettings } from "@/server/services/settings";
export const GET = api(async () => getSettings());
export const PATCH = api(async ({ req, actor }) => updateSettings(actor, await body(req)));
