import { api, id } from "@/server/http";
import { getOrderForActor } from "@/server/services/orders";
export const GET = api<{ id: string }>(async ({ params, actor }) => {
  const { order, financial } = await getOrderForActor(actor, id(params.id));
  if (!financial) return { ...order, payments: [], paidAmount: undefined, total: undefined, financial };
  return { ...order, financial };
});
