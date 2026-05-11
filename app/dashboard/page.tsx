import Link from "next/link";
import type { Route } from "next";
import { AppShell } from "@/components/layout/app-shell";
import { MetricCard } from "@/components/layout/metric-card";
import { JobCard } from "@/components/jobs/job-card";
import { getBusiness, getDashboardStats, getJobs } from "@/lib/data";

export default async function DashboardPage() {
  const [business, stats, jobs] = await Promise.all([getBusiness(), getDashboardStats(), getJobs()]);
  const crmHref = "/crm" as Route;

  return (
    <AppShell
      title="Dashboard"
      subtitle={`Simple enough for site use, clear enough for the office. ${business.business_name} can track surveys, draft quotes, approvals, and sent work from one place.`}
      actions={
        <>
          <Link className="button-primary" href="/jobs/new">
            Add New Job
          </Link>
          <Link className="button-ghost" href={crmHref}>
            Open Jobs
          </Link>
        </>
      }
    >
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard hint="All active and recent work items" label="Total Jobs" value={stats.totalJobs} />
        <MetricCard hint="Surveys ready to turn into a quote" label="Ready For AI Quote" value={stats.readyForQuote} />
        <MetricCard hint="Approved drafts waiting to go out" label="Ready To Send" value={stats.readyToSend} />
        <MetricCard hint="Quotes already sent to customers" label="Quote Sent" value={stats.quoteSent} />
        <MetricCard hint="Accepted work needing ordering" label="Materials Needed" value={stats.materialsNeeded} />
      </section>

      <section className="mt-6 page-grid">
        <div className="stack">
          {jobs.map((job) => (
            <JobCard job={job} key={job.id} />
          ))}
        </div>
        <aside className="stack">
          <div className="card p-5">
            <p className="section-kicker text-[0.65rem] uppercase">Primary Workflow</p>
            <ol className="mt-4 space-y-3 text-sm text-[var(--text)]">
              <li>1. Add the lead and property details to create the job file.</li>
              <li>2. Complete the survey on site and upload photos.</li>
              <li>3. Press create quote to draft the report and pricing.</li>
              <li>4. Review, approve, then send the customer version.</li>
              <li>5. Move accepted work into materials and booking.</li>
            </ol>
          </div>
          <div className="card p-5">
            <p className="section-kicker text-[0.65rem] uppercase">Business Details</p>
            <div className="mt-4 space-y-2 text-sm text-[var(--muted)]">
              <p className="text-[var(--text)]">{business.business_name}</p>
              <p>{business.trading_address}</p>
              <p>{business.email}</p>
              <p>{business.phone}</p>
              <p>VAT {business.vat_rate}%</p>
            </div>
          </div>
          <div className="card p-5">
            <p className="section-kicker text-[0.65rem] uppercase">Admin Access</p>
            <div className="mt-4 space-y-2 text-sm text-[var(--muted)]">
              <p className="text-[var(--text)]">werroofing@gmail.com</p>
              <p>Single admin login for the MVP office workflow.</p>
            </div>
          </div>
        </aside>
      </section>
    </AppShell>
  );
}
