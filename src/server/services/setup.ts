import { z } from "zod";
import { prisma } from "../db";
import { badRequest } from "../errors";
import { hashPassword } from "../password";
import { logActivity } from "./activity";
import { seedBase } from "../seed";

export const setupInput = z.object({
  name: z.string().trim().min(2).max(80),
  username: z.string().trim().toLowerCase().regex(/^[a-z0-9._-]{3,30}$/, "Username 3–30 karakter: huruf kecil, angka, titik, - atau _."),
  password: z.string().min(8, "Kata sandi minimal 8 karakter.").max(128),
  businessName: z.string().trim().min(2).max(80).optional(),
});

export async function needsSetup() {
  return (await prisma.user.count()) === 0;
}

/** Owner pertama hanya dapat dibuat selama tabel users kosong (dikunci advisory lock). */
export async function createFirstOwner(raw: unknown) {
  const input = setupInput.parse(raw);
  await seedBase();
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(424242)`;
    if ((await tx.user.count()) > 0) throw badRequest("Setup sudah dilakukan.");
    const role = await tx.role.findUniqueOrThrow({ where: { key: "OWNER" } });
    const u = await tx.user.create({ data: { name: input.name, username: input.username, passwordHash: await hashPassword(input.password), roleId: role.id } });
    if (input.businessName) await tx.businessSetting.update({ where: { id: 1 }, data: { name: input.businessName } });
    await logActivity(tx, { id: u.id, name: u.name }, "setup.owner", "user", String(u.id));
    return u;
  });
}
