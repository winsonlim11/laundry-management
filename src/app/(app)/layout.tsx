import { redirect } from "next/navigation";
import { getActor } from "@/server/auth";
import { getSettings } from "@/server/services/settings";
import { Shell } from "@/components/shell";
import { NAV } from "@/components/nav";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const actor = await getActor();
  if (!actor) redirect("/login");
  const settings = await getSettings();
  const items = NAV.filter((n) => n.perms.some((p) => actor.permissions.has(p)));
  return (
    <Shell items={items} user={{ name: actor.name, role: actor.roleName }} business={settings.name}>
      {children}
    </Shell>
  );
}
