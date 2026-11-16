import { prisma } from "./db";
import type { Actor } from "./actor";
import type { PermissionKey, RoleKey } from "@/lib/permissions";

export async function loadActorByUserId(userId: number): Promise<Actor | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { role: { include: { permissions: { include: { permission: true } } } }, courier: true },
  });
  if (!user || !user.active) return null;
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    roleKey: user.role.key as RoleKey,
    roleName: user.role.name,
    permissions: new Set(user.role.permissions.map((rp) => rp.permission.key as PermissionKey)),
    courierId: user.courier?.id ?? null,
  };
}
