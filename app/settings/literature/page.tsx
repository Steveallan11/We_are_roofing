import { AppShell } from "@/components/layout/app-shell";
import { LiteratureLibrary } from "@/components/settings/LiteratureLibrary";
import { getLiteratureAssets } from "@/lib/data";

export default async function LiteratureSettingsPage() {
  return (
    <AppShell title="Customer Literature" subtitle="Keep brochures and product information ready to attach to any customer email.">
      <LiteratureLibrary initialItems={await getLiteratureAssets()} />
    </AppShell>
  );
}
