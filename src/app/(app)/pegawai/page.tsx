import { pageActor } from "@/server/page";
import { listRoles, listUsers } from "@/server/services/users";
import { PageHeader } from "@/components/ui";
import { PERMISSIONS, OPERATIONAL_ROLES, PRIVILEGED_PERMISSIONS } from "@/lib/permissions";
import { UsersManager } from "./manager";

export const metadata = { title: "Pegawai & izin" };

export default async function UsersPage() {
  const actor = await pageActor("users.manage", "users.manage_privileged");
  const [users, roles] = await Promise.all([listUsers(actor), listRoles(actor)]);
  const privileged = actor.permissions.has("users.manage_privileged");
  return (
    <div>
      <PageHeader title="Pegawai & izin" subtitle={privileged ? "Kelola akun pegawai dan izin per peran." : "Administrator dapat mengelola Kasir, Operator, dan Kurir. Perubahan Owner/Administrator & akses finansial memerlukan Owner."} />
      <UsersManager
        users={users.map((u) => ({ id: u.id, name: u.name, username: u.username, phone: u.phone, active: u.active, roleKey: u.role.key, roleName: u.role.name, vehicle: u.courier?.vehicle ?? null }))}
        roles={roles.map((r) => ({ key: r.key, name: r.name, permissions: r.permissions.map((p) => p.permission.key) }))}
        permissions={Object.entries(PERMISSIONS).map(([key, description]) => ({ key, description, privileged: PRIVILEGED_PERMISSIONS.includes(key as never) }))}
        manageableRoles={privileged ? ["OWNER", "ADMIN", "KASIR", "OPERATOR", "KURIR"] : OPERATIONAL_ROLES}
        privileged={privileged}
        selfId={actor.id}
      />
    </div>
  );
}
