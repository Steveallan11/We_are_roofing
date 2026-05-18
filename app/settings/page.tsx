import { AppShell } from "@/components/layout/app-shell";
import { SettingsWorkspace } from "@/components/settings/settings-workspace";
import { getBusiness } from "@/lib/data";

export default async function SettingsPage() {
  const business = await getBusiness();

  return (
    <AppShell title="Settings" subtitle="Business setup, bank details, quote defaults, pricing, and knowledge in one place." wide>
      <SettingsWorkspace business={business} />
    </AppShell>
  );
}
