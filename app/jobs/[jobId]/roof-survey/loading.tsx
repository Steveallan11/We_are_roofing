import { AppShell } from "@/components/layout/app-shell";

export default function Loading() {
  return (
    <AppShell title="Roof Survey Tool" subtitle="Preparing the measured roof takeoff workspace.">
      <div className="card p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-5 w-52 rounded bg-[var(--border)]" />
          <div className="h-[70vh] rounded-3xl bg-[var(--card)]" />
        </div>
      </div>
    </AppShell>
  );
}
