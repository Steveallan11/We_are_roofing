import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { CustomersWorkspace } from "@/components/customers/customers-workspace";
import { Button } from "@/components/ui/primitives";
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
          <Button variant="primary" size="md" asChild>
            <Link href="/customers/new">Add Customer</Link>
          </Button>
          <Button variant="ghost" size="md" asChild>
            <Link href="/jobs/new">Add Job</Link>
          </Button>
        </>
      }
    >
      <CustomersWorkspace customers={enriched} />
    </AppShell>
  );
}
