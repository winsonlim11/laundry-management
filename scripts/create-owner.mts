/**
 * Membuat akun Owner pertama tanpa kata sandi bawaan.
 *   npx tsx scripts/create-owner.mts <username> "<Nama>"     (kata sandi diminta interaktif / env OWNER_PASSWORD)
 * Alternatif: buka /setup di browser selama belum ada pengguna.
 */
import readline from "node:readline/promises";
const [username, name] = process.argv.slice(2);
if (!username || !name) { console.error('Pemakaian: npx tsx scripts/create-owner.mts <username> "<Nama>"'); process.exit(1); }
let password = process.env.OWNER_PASSWORD;
if (!password) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  password = await rl.question("Kata sandi Owner (min. 8 karakter): ");
  rl.close();
}
const { prisma } = await import("../src/server/db");
const { createFirstOwner } = await import("../src/server/services/setup");
await createFirstOwner({ username, name, password });
console.log(`✔ Owner "${username}" dibuat.`);
await prisma.$disconnect();
