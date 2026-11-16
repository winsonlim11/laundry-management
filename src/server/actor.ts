import type { PermissionKey, RoleKey } from "@/lib/permissions";
import { forbidden } from "./errors";

export interface Actor {
  id: number;
  name: string;
  username: string;
  roleKey: RoleKey;
  roleName: string;
  permissions: Set<PermissionKey>;
  courierId: number | null;
}

export function can(actor: Actor, p: PermissionKey) {
  return actor.permissions.has(p);
}

export function requirePerm(actor: Actor, ...anyOf: PermissionKey[]) {
  if (!anyOf.some((p) => actor.permissions.has(p))) throw forbidden();
}
