import { api } from "@/server/http";
import { listRoles } from "@/server/services/users";
export const GET = api(async ({ actor }) => listRoles(actor));
