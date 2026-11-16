/**
 * Runner migrasi SQL sederhana (tanpa engine biner Prisma).
 * Menjalankan prisma/migrations/<nama>/migration.sql secara berurutan, satu kali,
 * di dalam transaksi + advisory lock agar aman bila dua proses deploy berjalan bersamaan.
 *   npx tsx scripts/migrate.mts            → terapkan migrasi yang belum ada
 *   npx tsx scripts/migrate.mts --reset    → HAPUS semua tabel lalu migrasi ulang (dev/test saja)
 */
import pg from "pg";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

import { migrationDatabaseUrl } from "../src/lib/db-url";

let url: string;
try {
  url = migrationDatabaseUrl();
} catch (e) {
  console.error("\n✖ " + (e as Error).message + "\n");
  process.exit(1);
}
const reset = process.argv.includes("--reset");
if (reset && process.env.NODE_ENV === "production" && !process.env.ALLOW_RESET) {
  console.error("--reset ditolak di production.");
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  await client.query("SELECT pg_advisory_lock(727274)");
  if (reset) {
    await client.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
    console.log("Skema public dikosongkan.");
  }
  await client.query(`CREATE TABLE IF NOT EXISTS "_app_migrations" (
    "name" TEXT PRIMARY KEY, "checksum" TEXT NOT NULL, "appliedAt" TIMESTAMPTZ NOT NULL DEFAULT now())`);
  const dir = path.join(process.cwd(), "prisma", "migrations");
  const names = fs.readdirSync(dir).filter((n) => fs.existsSync(path.join(dir, n, "migration.sql"))).sort();
  const { rows } = await client.query<{ name: string; checksum: string }>(`SELECT name, checksum FROM "_app_migrations"`);
  const applied = new Map(rows.map((r) => [r.name, r.checksum]));
  let count = 0;
  for (const name of names) {
    const sql = fs.readFileSync(path.join(dir, name, "migration.sql"), "utf8");
    const sum = crypto.createHash("sha256").update(sql).digest("hex");
    if (applied.has(name)) {
      if (applied.get(name) !== sum) console.warn(`Peringatan: isi migrasi ${name} berubah setelah diterapkan.`);
      continue;
    }
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query(`INSERT INTO "_app_migrations"(name, checksum) VALUES ($1, $2)`, [name, sum]);
      await client.query("COMMIT");
      console.log(`✔ ${name}`);
      count++;
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    }
  }
  console.log(count ? `${count} migrasi diterapkan.` : "Database sudah terbaru.");
} finally {
  await client.query("SELECT pg_advisory_unlock(727274)").catch(() => {});
  await client.end();
}
