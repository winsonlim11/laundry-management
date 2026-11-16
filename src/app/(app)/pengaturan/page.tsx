import { pageActor } from "@/server/page";
import { getSettings, integrationStatus } from "@/server/services/settings";
import { listServices } from "@/server/services/catalog";
import { PageHeader } from "@/components/ui";
import { SettingsTabs } from "./tabs";

export const metadata = { title: "Pengaturan" };

export default async function SettingsPage() {
  const actor = await pageActor("settings.manage", "services.manage", "backup.manage");
  const [s, services] = await Promise.all([getSettings(), listServices(true)]);
  const P = (k: string) => actor.permissions.has(k as never);
  return (
    <div>
      <PageHeader title="Pengaturan" />
      <SettingsTabs
        settings={{ ...s, updatedAt: s.updatedAt.toISOString() }}
        services={services.map((x) => ({ ...x, createdAt: undefined, updatedAt: undefined, archivedAt: x.archivedAt?.toISOString() ?? null }))}
        integrations={P("settings.manage") ? integrationStatus() : []}
        can={{ settings: P("settings.manage"), services: P("services.manage"), backup: P("backup.manage") }}
      />
    </div>
  );
}
