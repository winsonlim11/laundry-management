import crypto from "node:crypto";
import type { Tx } from "../db";
import { localDateKey } from "@/lib/time";

/**
 * Nomor dokumen unik & aman konkuren: UPSERT … RETURNING mengunci baris counter
 * sampai transaksi selesai, sehingga dua kasir tidak pernah mendapat nomor yang sama.
 */
export async function nextDocNumber(tx: Tx, prefix: string, now = new Date()): Promise<string> {
  const day = localDateKey(now).replace(/-/g, "").slice(2); // YYMMDD
  const key = `${prefix}-${day}`;
  const rows = await tx.$queryRaw<{ last: number }[]>`
    INSERT INTO "doc_sequences"("key", "last") VALUES (${key}, 1)
    ON CONFLICT ("key") DO UPDATE SET "last" = "doc_sequences"."last" + 1
    RETURNING "last"`;
  return `${key}-${String(rows[0].last).padStart(4, "0")}`;
}

/** Kode referensi nota untuk QR/barcode: acak, tidak bisa ditebak, terpisah dari kode QRIS. */
export function newRefCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(10);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}
