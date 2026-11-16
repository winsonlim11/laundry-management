import { prisma } from "../db";
import type { Actor } from "../actor";
import { requirePerm } from "../actor";
import { logActivity } from "./activity";

const TABLES = [
  "roles", "permissions", "role_permissions", "users", "couriers", "customers", "services", "business_settings",
  "orders", "order_items", "payments", "pickup_requests", "delivery_requests", "order_status_history",
  "task_photos", "expenses", "loyalty_ledger", "activity_logs", "doc_sequences", "gateway_notifications",
];

/**
 * Backup logis seluruh tabel (JSON). Sesi & percobaan login tidak ikut.
 * Untuk produksi tetap disarankan pg_dump terjadwal / fitur backup penyedia (lihat docs/BACKUP.md).
 */
export async function createBackup(actor: Actor) {
  requirePerm(actor, "backup.manage");
  const out: Record<string, unknown[]> = {};
  for (const t of TABLES) {
    out[t] = await prisma.$queryRawUnsafe(`SELECT * FROM "${t}" ORDER BY 1`);
  }
  await logActivity(prisma, actor, "backup.create", "backup", undefined, { tables: TABLES.length });
  return JSON.stringify(
    { format: "laundry-backup", version: 1, createdAt: new Date().toISOString(), tables: out },
    (_k, v) => (typeof v === "bigint" ? Number(v) : v instanceof Uint8Array ? { $bytes: Buffer.from(v).toString("base64") } : v),
  );
}

export { TABLES as BACKUP_TABLES };
