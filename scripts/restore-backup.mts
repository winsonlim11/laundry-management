/**
 * Memulihkan backup JSON dari menu Pengaturan → Backup ke database KOSONG yang sudah dimigrasi.
 *   DATABASE_URL=... npx tsx scripts/migrate.mts
 *   DATABASE_URL=... npx tsx scripts/restore-backup.mts backup-laundry-xxxx.json
 * Ditolak bila tabel users sudah berisi data (hindari menimpa data produksi).
 */
import fs from "node:fs";
import pg from "pg";
import { migrationDatabaseUrl } from "../src/lib/db-url";

const file = process.argv[2];
if (!file) { console.error("Pemakaian: npx tsx scripts/restore-backup.mts <file.json>"); process.exit(1); }
const dump = JSON.parse(fs.readFileSync(file, "utf8"));
if (dump.format !== "laundry-backup") { console.error("Bukan file backup Laundry."); process.exit(1); }

const client = new pg.Client({ connectionString: migrationDatabaseUrl() });
await client.connect();
const { rows } = await client.query(`SELECT count(*)::int AS n FROM "users"`);
if (rows[0].n > 0 && !process.argv.includes("--force")) { console.error("Database tidak kosong. Gunakan database baru (atau --force jika yakin)."); process.exit(1); }

const order: string[] = Object.keys(dump.tables);
await client.query("BEGIN");
try {
  await client.query(`TRUNCATE ${order.map((t) => `"${t}"`).join(", ")} RESTART IDENTITY CASCADE`);
  const cols = new Map<string, Map<string, string>>();
  for (const t of order) {
    const r = await client.query(`SELECT column_name, data_type, udt_name FROM information_schema.columns WHERE table_name = $1`, [t]);
    cols.set(t, new Map(r.rows.map((c) => [c.column_name, c.data_type === "USER-DEFINED" ? `"${c.udt_name}"` : c.data_type])));
  }
  for (const t of order) {
    const list = dump.tables[t] as Record<string, unknown>[];
    for (const row of list) {
      const keys = Object.keys(row);
      const vals = keys.map((k) => {
        const v = row[k] as { type?: string; data?: number[]; $bytes?: string } | unknown;
        if (v && typeof v === "object" && (v as { type?: string }).type === "Buffer") return Buffer.from((v as { data: number[] }).data);
        if (v && typeof v === "object" && "$bytes" in (v as object)) return Buffer.from((v as { $bytes: string }).$bytes, "base64");
        if (v && typeof v === "object") return JSON.stringify(v);
        return v;
      });
      const types = cols.get(t)!;
      const ph = keys.map((k, i) => { const ty = types.get(k); return ty?.startsWith('"') ? `$${i + 1}::${ty}` : `$${i + 1}`; });
      await client.query(`INSERT INTO "${t}" (${keys.map((k) => `"${k}"`).join(", ")}) VALUES (${ph.join(", ")})`, vals);
    }
    // sinkronkan sequence SERIAL
    const seq = cols.get(t)!.has("id") ? await client.query(`SELECT pg_get_serial_sequence($1, 'id') AS s`, [`"${t}"`]) : { rows: [{ s: null }] };
    if (seq.rows[0]?.s) await client.query(`SELECT setval($1, COALESCE((SELECT MAX("id") FROM "${t}"), 0) + 1, false)`, [seq.rows[0].s]);
    console.log(`✔ ${t}: ${list.length} baris`);
  }
  await client.query("COMMIT");
  console.log("Pemulihan selesai.");
} catch (e) {
  await client.query("ROLLBACK");
  console.error("Gagal, semua perubahan dibatalkan:", (e as Error).message);
  process.exitCode = 1;
} finally {
  await client.end();
}
