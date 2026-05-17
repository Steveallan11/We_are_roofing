import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { KanbanBoard } from "@/components/crm/kanban-board";
import { getJobs } from "@/lib/data";
import { getJobWorkflowMetrics } from "@/lib/job-workflow";

export default async function CrmPage() {
  const jobs = await getJobs();
  const metrics = getJobWorkflowMetrics(jobs);
  const totalLiveJobs = jobs.filter((job) => !["Completed", "Lost", "Archived"].includes(job.status)).length;

  return (
    <AppShell
      title="Jobs"
      subtitle="A simple roofing workflow board: see what needs a survey, what is ready to quote, what needs sending, and what has been won."
      wide
      actions={
        <>
          <Link className="button-primary" href="/jobs/new">
            Add Lead
          </Link>
          <Link className="button-ghost" href="/dashboard">
            Dashboard
          </Link>
        </>
      }
    >
      <section className="stack">
        <div className="grid gap-3 md:grid-cols-5">
          {[
            ["Live Jobs", totalLiveJobs, "Active board"],
            ["Need Survey", metrics.needingSurvey, "Book or complete"],
            ["Ready Quote", metrics.readyForQuote, "Generate draft"],
            ["Ready Send", metrics.readyToSend, "Approved quotes"],
            ["Won / Booked", metrics.acceptedOrBooked, "Handover work"]
          ].map(([label, value, hint]) => (
            <div className="card flex items-center justify-between gap-3 px-4 py-3" key={label}>
              <div>
                <p className="text-[0.65rem] font-bold uppercase tracking-[0.22em] text-[var(--dim)]">{label}</p>
                <p className="mt-1 text-xs text-[var(--muted)]">{hint}</p>
              </div>
              <p className="font-display text-3xl leading-none text-[var(--gold-l)]">{value}</p>
            </div>
          ))}
        </div>

        <div className="card overflow-hidden">
          <div className="flex flex-col gap-2 border-b border-[var(--border)] px-4 py-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="section-kicker text-[0.65rem] uppercase">Roofing Workflow</p>
              <p className="mt-1 text-sm text-[var(--muted)]">Move jobs left to right. Each card shows the next useful action, not every bit of admin noise.</p>
            </div>
            <p className="rounded-full border border-[var(--border)] bg-black/20 px-3 py-1 text-xs text-[var(--dim)]">
              Tip: use filters to create a short daily worklist
            </p>
          </div>
          <div className="p-4">
            <KanbanBoard jobs={jobs} />
          </div>
        </div>
      </section>
    </AppShell>
  );
}
