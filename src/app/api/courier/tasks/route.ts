import { api } from "@/server/http";
import { listCourierTasks } from "@/server/services/logistics";
export const GET = api(async ({ actor }) => listCourierTasks(actor));
