/**
 * Mendukung nama variabel dari berbagai penyedia (Neon/Vercel Postgres/manual).
 * Aplikasi: URL pooled. Migrasi: URL langsung (non-pooled) bila tersedia.
 */
const MISSING =
  "Database belum terhubung: variabel DATABASE_URL (atau POSTGRES_URL) belum ada. " +
  "Di Vercel: Project → Storage → Create/Connect Database → Neon, lalu Redeploy.";

export function appDatabaseUrl(): string {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL || process.env.DATABASE_URL_UNPOOLED;
  if (!url) throw new Error(MISSING);
  return url;
}

export function migrationDatabaseUrl(): string {
  const url = process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL;
  if (!url) throw new Error(MISSING);
  return url;
}
