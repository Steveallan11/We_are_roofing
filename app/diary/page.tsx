import { AppShell } from "@/components/layout/app-shell";
import { Card, PageSection } from "@/components/ui/primitives";

export default function DiaryPage() {
  return (
    <AppShell
      title="Diary"
      subtitle="Quick capture for notes, photos, expenses, and reminders. Coming soon."
    >
      <div className="stack">
        <PageSection
          kicker="Beta"
          title="Daily log — coming soon"
          description="The Diary lets you quick-add anything during the day: voice notes, photos, expenses, payments, tasks, reminders. Gauge will help organise it and link it to the right job or customer."
        >
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <PlannedAction label="Voice note" hint="Speak naturally" />
            <PlannedAction label="Text note" hint="Quick written thought" />
            <PlannedAction label="Photo / receipt" hint="Camera upload" />
            <PlannedAction label="Reminder" hint="Tomorrow, next week, etc." />
            <PlannedAction label="Task" hint="Things to do today" />
            <PlannedAction label="Expense" hint="Materials, fuel, parking" />
            <PlannedAction label="Payment" hint="Subcontractors, labour" />
            <PlannedAction label="General note" hint="Anything else" />
          </div>
        </PageSection>

        <Card padding="md">
          <p className="text-[0.62rem] font-bold uppercase tracking-[0.2em] text-[var(--dim)]">What this unlocks</p>
          <ul className="mt-3 space-y-2 text-sm text-[var(--text-muted)]">
            <li>• Capture anything from the van or rooftop in seconds.</li>
            <li>• Diary entries link automatically to jobs, customers, suppliers.</li>
            <li>• Expenses and labour payments flow to the accountant export.</li>
            <li>• Reminders and tasks appear on Today when due.</li>
            <li>• Gauge can ask &quot;what did I say about Bedford yesterday?&quot; and find it.</li>
          </ul>
        </Card>
      </div>
    </AppShell>
  );
}

function PlannedAction({ label, hint }: { label: string; hint: string }) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)] p-4 opacity-70">
      <p className="text-sm font-semibold text-[var(--text)]">{label}</p>
      <p className="mt-1 text-xs text-[var(--text-muted)]">{hint}</p>
    </div>
  );
}
