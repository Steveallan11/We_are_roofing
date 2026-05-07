import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { CustomerCard } from "@/components/crm/customer-card";
import { KanbanBoard } from "@/components/crm/kanban-board";
import { getCustomers, getJobs, getKanbanColumns } from "@/lib/data";

export default async function CrmPage() {
  const [customers, jobs, columns] = await Promise.all([getCustomers(), getJobs(), getKanbanColumns()]);

  return (
    <AppShell
      title="CRM"
      subtitle="This is the office view for customers, active jobs, and quote pipeline progress. It is laid out to make chasing, quoting, and handover simpler."
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
        <div className="card p-5">
          <p className="section-kicker text-[0.65rem] uppercase">Kanban Pipeline</p>
          <div className="mt-4">
            <KanbanBoard columns={columns} />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {customers.map((customer) => (
            <CustomerCard
              customer={customer}
              jobs={jobs.filter((job) => job.customer?.id === customer.id || job.customer_id === customer.id)}
              key={customer.id}
            />
          ))}
        </div>
      </section>
    </AppShell>
  );
}

