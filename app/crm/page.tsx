import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { KanbanBoard } from "@/components/crm/kanban-board";
import { MetricCard } from "@/components/layout/metric-card";
import { getJobs } from "@/lib/data";
import { getJobWorkflowMetrics } from "@/lib/job-workflow";

export default async function CrmPage() {
  const jobs = await getJobs();
  const metrics = getJobWorkflowMetrics(jobs);
  const recentlyUpdated = [...jobs].slice(0, 5);

  return (
    <AppShell
      title="Jobs"
      subtitle="This is the live roofing jobs board. Use it to see what needs surveying, what is ready for quote, what is waiting to send, and what has been won and booked."
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
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard hint="Leads that still need a survey booking or site visit." label="Need Survey" value={metrics.needingSurvey} />
          <MetricCard hint="Surveys and photos are in place and ready to turn into quotes." label="Ready For Quote" value={metrics.readyForQuote} />
          <MetricCard hint="Approved drafts that need to go out to the customer." label="Ready To Send" value={metrics.readyToSend} />
          <MetricCard hint="Won work that needs ordering, booking, or handover." label="Accepted / Booked" value={metrics.acceptedOrBooked} />
        </div>

        <div className="card p-5">
          <p className="section-kicker text-[0.65rem] uppercase">Jobs Workflow</p>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Keep the board focused on the real roofing journey: lead, survey, quote, send, accepted, and booked work.
          </p>
          <div className="mt-4">
            <KanbanBoard jobs={jobs} />
          </div>
        </div>

        <div className="card p-5">
          <p className="section-kicker text-[0.65rem] uppercase">Recently Updated Jobs</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {recentlyUpdated.map((job) => (
              <Link className="rounded-2xl border border-[var(--border)] p-4 transition hover:-translate-y-0.5" href={`/jobs/${job.id}`} key={job.id}>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gold-l)]">{job.job_ref ?? "WR-J-TBC"}</p>
                <p className="mt-2 font-semibold text-white">{job.customer?.full_name ?? "Customer missing"}</p>
                <p className="mt-1 text-sm text-[var(--muted)]">{job.job_title}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </AppShell>
  );
}
