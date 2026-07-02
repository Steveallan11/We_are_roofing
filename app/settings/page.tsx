import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { NurtureTemplatesEditor } from "@/components/settings/NurtureTemplatesEditor";

export default function SettingsPage() {
  return (
    <AppShell
      title="Settings"
      subtitle="Manage your business settings, email templates, and configurations."
    >
      <div className="stack max-w-3xl">
        <div className="grid gap-3 md:grid-cols-2">
          <Link className="card p-4 no-underline transition hover:border-[var(--gold)]/60" href="/settings/templates">
            <p className="section-kicker text-[0.65rem] uppercase">Quote Templates</p>
            <p className="mt-2 text-sm text-[var(--text-second)]">Manage quote templates, pricing bounds, and knowledge examples.</p>
          </Link>
          <Link className="card p-4 no-underline transition hover:border-[var(--gold)]/60" href="/settings/nurture">
            <p className="section-kicker text-[0.65rem] uppercase">Nurture Templates</p>
            <p className="mt-2 text-sm text-[var(--text-second)]">Edit follow-up email templates and sequence wording.</p>
          </Link>
        </div>
        <NurtureTemplatesEditor />
      </div>
    </AppShell>
  );
}
