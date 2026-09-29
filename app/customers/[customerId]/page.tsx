import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { CustomerContactEditor } from "@/components/customers/customer-contact-editor";
import { DeleteCustomerAction } from "@/components/customers/delete-customer-action";
import { JobCard } from "@/components/jobs/job-card";
import { getCustomers, getJobs } from "@/lib/data";
import { getJobPipelineValue } from "@/lib/quotes/value";
import { currency, formatDate } from "@/lib/utils";

type Props = {
  params: Promise<{ customerId: string }>;
};

export default async function CustomerDetailPage({ params }: Props) {
  const { customerId } = await params;
  const [customers, jobs] = await Promise.all([getCustomers(), getJobs()]);
  const customer = customers.find((item) => item.id === customerId);
  if (!customer) notFound();

  const customerJobs = jobs.filter((job) => job.customer_id === customer.id);
  const openJobs = customerJobs.filter((job) => !["Completed", "Not Proceeding", "Lost", "Archived"].includes(job.status));
  const previousJobs = customerJobs.filter((job) => !openJobs.includes(job));
  const messageJob = openJobs[0] ?? customerJobs[0];
  const lifetimeValue = customerJobs.reduce((sum, job) => sum + Number(job.final_value ?? getJobPipelineValue(job) ?? 0), 0);

  return (
    <AppShell
      title={customer.full_name}
      subtitle={`${customerJobs.length} job${customerJobs.length === 1 ? "" : "s"} | ${currency(lifetimeValue)} lifetime value | Customer since ${formatDate(customer.created_at)}`}
      actions={
        <>
          <Link className="button-primary" href={`/jobs/new?customerId=${customer.id}` as Route}>
            New Job
          </Link>
          {messageJob ? (
            <Link className="button-secondary" href={`/comms?compose=1&job=${messageJob.id}` as Route}>
              Email Customer
            </Link>
          ) : null}
          <Link className="button-ghost" href={"/customers" as Route}>
            Customers
          </Link>
        </>
      }
    >
      <section className="page-grid">
        <div className="stack">
          {customerJobs.length ? (
            <>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="section-kicker">Open jobs</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">Open any job to see its survey, quote, work, money and files.</p>
                </div>
                <span className="rounded-full border border-[var(--border)] px-3 py-1 text-sm text-[var(--muted)]">{openJobs.length}</span>
              </div>
              {openJobs.length ? openJobs.map((job) => <JobCard job={job} key={job.id} list />) : <p className="card p-5 text-sm text-[var(--muted)]">No open jobs for this customer.</p>}
              {previousJobs.length ? (
                <details className="card p-4">
                  <summary className="cursor-pointer font-semibold text-[var(--text-primary)]">Previous and archived jobs ({previousJobs.length})</summary>
                  <div className="mt-4 grid gap-3">
                    {previousJobs.map((job) => <JobCard job={job} key={job.id} list />)}
                  </div>
                </details>
              ) : null}
            </>
          ) : (
            <div className="card p-8 text-center">
              <p className="font-condensed text-3xl text-white">No jobs yet</p>
              <p className="mt-2 text-sm text-[var(--muted)]">Create the first job for this customer.</p>
              <Link className="button-primary mt-4" href={`/jobs/new?customerId=${customer.id}` as Route}>
                Create Job
              </Link>
            </div>
          )}
        </div>
        <aside className="stack">
          <div className="card p-5">
            <p className="section-kicker text-[0.65rem] uppercase">Contact</p>
            <div className="mt-4">
              <CustomerContactEditor compact customer={customer} />
            </div>
          </div>
          <div className="card p-5">
            <p className="section-kicker text-[0.65rem] uppercase">Summary</p>
            <div className="mt-4 grid gap-3 text-sm">
              <Summary label="Jobs" value={customerJobs.length.toString()} />
              <Summary label="Lifetime Value" value={currency(lifetimeValue)} />
              <Summary label="Open Jobs" value={openJobs.length.toString()} />
            </div>
          </div>
          <div className="card p-5">
            <p className="section-kicker text-[0.65rem] uppercase">Danger Zone</p>
            <p className="mt-3 text-sm text-[var(--muted)]">
              Test phase only. This permanently removes the customer and all linked jobs/files.
            </p>
            <div className="mt-4">
              <DeleteCustomerAction customerId={customer.id} customerName={customer.full_name} jobCount={customerJobs.length} />
            </div>
          </div>
        </aside>
      </section>
    </AppShell>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-[var(--border)] bg-black/20 px-4 py-3">
      <span className="text-[var(--muted)]">{label}</span>
      <span className="font-semibold text-white">{value}</span>
    </div>
  );
}
