import { api } from "@/server/http";
import { createBackup } from "@/server/services/backup";
export const GET = api(async ({ actor }) => {
  const json = await createBackup(actor);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return new Response(json, { headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="backup-laundry-${stamp}.json"`, "Cache-Control": "no-store" } });
});
