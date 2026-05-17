import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { JobCard } from "@/components/jobs/job-card";
import { getCustomers, getJobs } from "@/lib/data";
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
  const lifetimeValue = customerJobs.reduce((sum, job) => sum + Number(job.final_value ?? job.estimated_value ?? job.quote?.total ?? 0), 0);

  return (
    <AppShell
      title={customer.full_name}
      subtitle={`${customerJobs.length} job${customerJobs.length === 1 ? "" : "s"} | ${currency(lifetimeValue)} lifetime value | Customer since ${formatDate(customer.created_at)}`}
      actions={
        <>
          <Link className="button-primary" href={`/jobs/new?customerId=${customer.id}` as Route}>
            New Job
          </Link>
          <Link className="button-ghost" href={"/customers" as Route}>
            Customers
          </Link>
        </>
      }
    >
      <section className="page-grid">
        <div className="stack">
          {customerJobs.length ? (
            customerJobs.map((job) => <JobCard job={job} key={job.id} list />)
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
            <div className="mt-4 space-y-3 text-sm">
              <p><span className="text-[var(--muted)]">Phone:</span> {customer.phone ? <a className="text-[var(--gold-l)]" href={`tel:${customer.phone}`}>{customer.phone}</a> : "Not saved"}</p>
              <p><span className="text-[var(--muted)]">Email:</span> {customer.email ?? "Not saved"}</p>
              <p><span className="text-[var(--muted)]">Address:</span> {[customer.address_line_1, customer.town, customer.county, customer.postcode].filter(Boolean).join(", ") || "Not saved"}</p>
              {customer.notes ? <p><span className="text-[var(--muted)]">Notes:</span> {customer.notes}</p> : null}
            </div>
          </div>
          <div className="card p-5">
            <p className="section-kicker text-[0.65rem] uppercase">Summary</p>
            <div className="mt-4 grid gap-3 text-sm">
              <Summary label="Jobs" value={customerJobs.length.toString()} />
              <Summary label="Lifetime Value" value={currency(lifetimeValue)} />
              <Summary label="Open Jobs" value={customerJobs.filter((job) => !["Completed", "Lost", "Archived"].includes(job.status)).length.toString()} />
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
