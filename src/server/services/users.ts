import { z } from "zod";
import { prisma } from "../db";
import type { Actor } from "../actor";
import { can, requirePerm } from "../actor";
import { badRequest, forbidden } from "../errors";
import { hashPassword } from "../password";
import { logActivity } from "./activity";
import { OPERATIONAL_ROLES, PERMISSIONS, PRIVILEGED_PERMISSIONS, type PermissionKey, type RoleKey } from "@/lib/permissions";

export const userInput = z.object({
  name: z.string().trim().min(2).max(80),
  username: z.string().trim().toLowerCase().regex(/^[a-z0-9._-]{3,30}$/, "Username 3–30 karakter: huruf kecil, angka, titik, - atau _."),
  password: z.string().min(8, "Kata sandi minimal 8 karakter.").max(128).optional(),
  phone: z.string().trim().max(20).optional().nullable(),
  roleKey: z.enum(["OWNER", "ADMIN", "KASIR", "OPERATOR", "KURIR"]),
  active: z.boolean().default(true),
  vehicle: z.string().trim().max(50).optional().nullable(),
});

function assertCanManageRole(actor: Actor, roleKey: RoleKey) {
  if (can(actor, "users.manage_privileged")) return;
  if (can(actor, "users.manage") && OPERATIONAL_ROLES.includes(roleKey)) return;
  throw forbidden("Perubahan akun Owner/Administrator memerlukan otorisasi Owner.");
}

export async function listUsers(actor: Actor) {
  requirePerm(actor, "users.manage", "users.manage_privileged");
  return prisma.user.findMany({ include: { role: true, courier: true }, orderBy: [{ active: "desc" }, { name: "asc" }] });
}

export async function createUser(actor: Actor, raw: unknown) {
  requirePerm(actor, "users.manage", "users.manage_privileged");
  const input = userInput.parse(raw);
  assertCanManageRole(actor, input.roleKey);
  if (!input.password) throw badRequest("Kata sandi wajib diisi.");
  const role = await prisma.role.findUniqueOrThrow({ where: { key: input.roleKey } });
  return prisma.$transaction(async (tx) => {
    const exists = await tx.user.findUnique({ where: { username: input.username } });
    if (exists) throw badRequest("Username sudah dipakai.");
    const u = await tx.user.create({
      data: { name: input.name, username: input.username, passwordHash: await hashPassword(input.password!), phone: input.phone, roleId: role.id, active: input.active },
    });
    if (input.roleKey === "KURIR") await tx.courier.create({ data: { userId: u.id, phone: input.phone, vehicle: input.vehicle } });
    await logActivity(tx, actor, "user.create", "user", String(u.id), { username: u.username, role: input.roleKey });
    return u;
  });
}

export async function updateUser(actor: Actor, id: number, raw: unknown) {
  requirePerm(actor, "users.manage", "users.manage_privileged");
  const input = userInput.partial().parse(raw);
  const target = await prisma.user.findUniqueOrThrow({ where: { id }, include: { role: true } });
  assertCanManageRole(actor, target.role.key as RoleKey);
  if (input.roleKey) assertCanManageRole(actor, input.roleKey);
  if (target.id === actor.id && input.active === false) throw badRequest("Tidak dapat menonaktifkan akun sendiri.");
  if (target.role.key === "OWNER" && (input.active === false || (input.roleKey && input.roleKey !== "OWNER"))) {
    const owners = await prisma.user.count({ where: { role: { key: "OWNER" }, active: true } });
    if (owners <= 1) throw badRequest("Minimal harus ada satu Owner aktif.");
  }
  return prisma.$transaction(async (tx) => {
    const data: Record<string, unknown> = { name: input.name, phone: input.phone, active: input.active };
    if (input.username) data.username = input.username;
    if (input.password) data.passwordHash = await hashPassword(input.password);
    if (input.roleKey) data.roleId = (await tx.role.findUniqueOrThrow({ where: { key: input.roleKey } })).id;
    const u = await tx.user.update({ where: { id }, data });
    if (input.active === false || input.password) await tx.session.deleteMany({ where: { userId: id } });
    if ((input.roleKey ?? target.role.key) === "KURIR") {
      await tx.courier.upsert({ where: { userId: id }, create: { userId: id, phone: input.phone ?? target.phone, vehicle: input.vehicle }, update: { phone: input.phone ?? undefined, vehicle: input.vehicle ?? undefined, active: input.active ?? undefined } });
    }
    await logActivity(tx, actor, "user.update", "user", String(id), { fields: Object.keys(input).filter((k) => k !== "password"), passwordChanged: !!input.password });
    return u;
  });
}

export async function listRoles(actor: Actor) {
  requirePerm(actor, "users.manage", "users.manage_privileged");
  return prisma.role.findMany({ include: { permissions: { include: { permission: true } } }, orderBy: { id: "asc" } });
}

/** Ubah izin peran — hanya Owner. Peran Owner selalu memegang semua izin. */
export async function setRolePermissions(actor: Actor, roleKey: RoleKey, keys: string[]) {
  requirePerm(actor, "users.manage_privileged");
  if (roleKey === "OWNER") throw badRequest("Izin Owner tidak dapat dikurangi.");
  const valid = keys.filter((k): k is PermissionKey => k in PERMISSIONS);
  if (roleKey !== "ADMIN" && valid.includes("users.manage_privileged")) throw badRequest("Izin ini hanya untuk Owner/Administrator.");
  const role = await prisma.role.findUniqueOrThrow({ where: { key: roleKey } });
  const perms = await prisma.permission.findMany({ where: { key: { in: valid } } });
  await prisma.$transaction(async (tx) => {
    await tx.rolePermission.deleteMany({ where: { roleId: role.id } });
    await tx.rolePermission.createMany({ data: perms.map((p) => ({ roleId: role.id, permissionId: p.id })) });
    await logActivity(tx, actor, "role.permissions", "role", roleKey, { permissions: valid, privileged: valid.filter((k) => PRIVILEGED_PERMISSIONS.includes(k)) });
  });
}

export async function listOperators() {
  return prisma.user.findMany({
    where: { active: true, role: { permissions: { some: { permission: { key: { in: ["production.update_assigned", "production.update_any"] } } } } }, NOT: { role: { key: "OWNER" } } },
    select: { id: true, name: true, role: { select: { name: true } } },
    orderBy: { name: "asc" },
  });
}

export async function listCouriers() {
  return prisma.courier.findMany({ where: { active: true, user: { active: true } }, include: { user: { select: { name: true } } }, orderBy: { id: "asc" } });
}
