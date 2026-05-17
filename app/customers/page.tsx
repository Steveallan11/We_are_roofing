import Link from "next/link";
import type { Route } from "next";
import { AppShell } from "@/components/layout/app-shell";
import { CustomersWorkspace } from "@/components/customers/customers-workspace";
import { getCustomers, getJobs } from "@/lib/data";

export default async function CustomersPage() {
  const [customers, jobs] = await Promise.all([getCustomers(), getJobs()]);
  const enriched = customers.map((customer) => ({
    ...customer,
    jobs: jobs.filter((job) => job.customer_id === customer.id)
  }));

  return (
    <AppShell
      title="Customers"
      subtitle="Customer contacts, tap-to-call details, job history and new-job shortcuts."
      actions={
        <>
          <Link className="button-primary" href={"/jobs/new" as Route}>
            Add Job
          </Link>
          <Link className="button-ghost" href={"/jobs" as Route}>
            Jobs
          </Link>
        </>
      }
    >
      <CustomersWorkspace customers={enriched} />
    </AppShell>
  );
}
