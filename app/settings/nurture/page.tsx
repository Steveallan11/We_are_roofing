import { AppShell } from "@/components/layout/app-shell";
import { NurtureTemplatesEditor } from "@/components/settings/NurtureTemplatesEditor";

export default function NurtureTemplatesPage() {
  return (
    <AppShell
      title="Nurture Email Templates"
      subtitle="Customize the follow-up emails sent to customers after quotes are sent."
    >
      <div className="stack max-w-4xl">
        <NurtureTemplatesEditor />
      </div>
    </AppShell>
  );
}
