import { api } from "@/server/http";
import { integrationStatus } from "@/server/services/settings";
import { requirePerm } from "@/server/actor";
export const GET = api(async ({ actor }) => { requirePerm(actor, "settings.manage"); return integrationStatus(); });
