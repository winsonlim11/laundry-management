import { api, id } from "@/server/http";
import { getTaskPhoto } from "@/server/services/logistics";
export const GET = api<{ id: string }>(async ({ params, actor }) => {
  const p = await getTaskPhoto(actor, id(params.id));
  return new Response(Buffer.from(p.data), { headers: { "Content-Type": p.mime, "Cache-Control": "private, max-age=3600", "Content-Disposition": "inline", "X-Content-Type-Options": "nosniff" } });
});
