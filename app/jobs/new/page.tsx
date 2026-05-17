import Link from "next/link";
import type { Route } from "next";
import { AppShell } from "@/components/layout/app-shell";
import { NewJobForm } from "@/components/jobs/new-job-form";
import { getCustomers } from "@/lib/data";

type Props = {
  searchParams?: Promise<{ customerId?: string }>;
};

export default async function NewJobPage({ searchParams }: Props) {
  const [customers, query] = await Promise.all([getCustomers(), searchParams ? searchParams : Promise.resolve(undefined)]);

  return (
    <AppShell
      title="Add New Job"
      subtitle="Every lead becomes a job file straight away. Save the customer and property details here, create the permanent job number, then go straight into survey capture."
      actions={<Link className="button-ghost" href={"/dashboard" as Route}>Back to Dashboard</Link>}
    >
      <div className="mx-auto max-w-4xl">
        <NewJobForm customers={customers} prefillCustomerId={query?.customerId} />
      </div>
    </AppShell>
  );
}
