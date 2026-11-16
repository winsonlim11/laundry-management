import { prisma } from "@/server/db";
import { seedBase } from "@/server/seed";
import { loadActorByUserId } from "@/server/actor-loader";
import { hashPassword } from "@/server/password";
import type { Actor } from "@/server/actor";

/** Kondisi awal yang diketahui: kosongkan semua tabel transaksi, isi data dasar & 1 akun per peran. */
export async function resetDb() {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_app_migrations'`;
  await prisma.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(", ")} RESTART IDENTITY CASCADE`);
  await seedBase();
  const roles = Object.fromEntries((await prisma.role.findMany()).map((r) => [r.key, r.id]));
  const pw = await hashPassword("rahasia123");
  const mk = async (username: string, role: string) => (await prisma.user.create({ data: { name: username, username, passwordHash: pw, roleId: roles[role] } })).id;
  const ids = {
    owner: await mk("owner", "OWNER"), admin: await mk("admin", "ADMIN"), kasir: await mk("kasir", "KASIR"), kasir2: await mk("kasir2", "KASIR"),
    operator: await mk("operator", "OPERATOR"), operator2: await mk("operator2", "OPERATOR"), kurir: await mk("kurir", "KURIR"), kurir2: await mk("kurir2", "KURIR"),
  };
  await prisma.courier.create({ data: { userId: ids.kurir } });
  await prisma.courier.create({ data: { userId: ids.kurir2 } });
  const a: Record<keyof typeof ids, Actor> = {} as never;
  for (const [k, v] of Object.entries(ids)) a[k as keyof typeof ids] = (await loadActorByUserId(v))!;
  const svc = Object.fromEntries((await prisma.service.findMany()).map((s) => [s.code, s.id])) as Record<string, number>;
  return { a, svc };
}

/** Waktu lokal WIB → Date */
export const wib = (iso: string) => new Date(iso + "+07:00");

export async function newCustomer(name = "Pelanggan Uji", phone = "081200001111") {
  return prisma.customer.create({ data: { name, phone: phone.replace(/^0/, "62") } });
}
