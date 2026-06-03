import { AppShell } from "@/components/layout/app-shell";
import { LabourWorkspace } from "@/components/settings/labour-workspace";
import { getLabourPeople, getLabourRates } from "@/lib/data";

export default async function LabourSettingsPage() {
  const [rates, people] = await Promise.all([getLabourRates(), getLabourPeople()]);

  return (
    <AppShell title="Labour" subtitle="Manage crew profiles, subcontractors, and labour charge-out rates for quotes and job planning.">
      <LabourWorkspace initialPeople={people} initialRates={rates} />
    </AppShell>
  );
}
