import { api, id } from "@/server/http";
import { confirmPayment } from "@/server/services/payments";
export const POST = api<{ id: string }>(async ({ params, actor }) => confirmPayment(actor, id(params.id)));
