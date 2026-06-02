import Link from "next/link";
import type { Route } from "next";
import { AppShell } from "@/components/layout/app-shell";
import { NewCustomerForm } from "@/components/customers/new-customer-form";

export default function NewCustomerPage() {
  return (
    <AppShell
      title="Add Customer"
      subtitle="Save a customer record on its own — no job required. Use this for leads, repeat customers you want to log ahead of time, or referrals."
      actions={
        <>
          <Link className="button-ghost" href={"/customers" as Route}>
            Back to Customers
          </Link>
          <Link className="button-secondary" href={"/jobs/new" as Route}>
            Add Customer Job
          </Link>
        </>
      }
    >
      <div className="mx-auto max-w-3xl">
        <NewCustomerForm />
      </div>
    </AppShell>
  );
}
