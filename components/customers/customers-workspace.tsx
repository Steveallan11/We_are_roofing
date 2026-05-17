"use client";

import Link from "next/link";
import type { Route } from "next";
import { useMemo, useState } from "react";
import { currency, formatDate } from "@/lib/utils";
import type { Customer, Job, QuoteRecord } from "@/lib/types";

type CustomerWithJobs = Customer & {
  jobs: Array<Job & { quote?: QuoteRecord | null }>;
};

type Props = {
  customers: CustomerWithJobs[];
};

export function CustomersWorkspace({ customers }: Props) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return customers;
    return customers.filter((customer) =>
      [customer.full_name, customer.phone, customer.email, customer.postcode, customer.town, customer.county].filter(Boolean).join(" ").toLowerCase().includes(needle)
    );
  }, [customers, query]);

  return (
    <div className="stack">
      <div className="card p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="section-kicker text-[0.65rem] uppercase">Customers</p>
            <h2 className="mt-2 font-condensed text-3xl text-white">{customers.length} saved contacts</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">Search by name, phone, email, town or postcode.</p>
          </div>
          <Link className="button-primary" href={"/jobs/new" as Route}>
            Add Customer Job
          </Link>
        </div>
        <input className="field mt-4" onChange={(event) => setQuery(event.target.value)} placeholder="Search customers..." value={query} />
      </div>

      {filtered.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {filtered.map((customer) => (
            <CustomerSummaryCard customer={customer} key={customer.id} />
          ))}
        </div>
      ) : (
        <div className="card p-8 text-center">
          <p className="font-condensed text-3xl text-white">No customers found</p>
          <p className="mt-2 text-sm text-[var(--muted)]">Try a different search or create a new job.</p>
        </div>
      )}
    </div>
  );
}

export function CustomerSummaryCard({ customer }: { customer: CustomerWithJobs }) {
  const totalValue = customer.jobs.reduce((sum, job) => sum + Number(job.final_value ?? job.estimated_value ?? job.quote?.total ?? 0), 0);
  const lastUpdated = [...customer.jobs]
    .map((job) => job.updated_at ?? job.created_at)
    .filter(Boolean)
    .sort()
    .at(-1);
  const initials = customer.full_name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <article className="card overflow-hidden">
      <div className="p-5">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[var(--border)] bg-black/30 font-bold text-[var(--gold-l)]">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-condensed text-3xl text-white">{customer.full_name}</h3>
            <p className="mt-1 truncate text-sm text-[var(--muted)]">{customer.email ?? "No email saved"}</p>
            {customer.phone ? (
              <a className="mt-1 inline-flex text-sm text-[var(--gold-l)] underline-offset-4 hover:underline" href={`tel:${customer.phone}`}>
                {customer.phone}
              </a>
            ) : (
              <p className="mt-1 text-sm text-[var(--muted)]">No phone saved</p>
            )}
          </div>
        </div>
        <div className="gold-divider my-4" />
        <div className="grid gap-2 text-sm text-[var(--muted)]">
          <p>{[customer.address_line_1, customer.town, customer.county, customer.postcode].filter(Boolean).join(", ") || "No address saved"}</p>
          <p>{customer.jobs.length} job{customer.jobs.length === 1 ? "" : "s"} | {currency(totalValue)} lifetime value | Last activity {formatDate(lastUpdated)}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-3 border-t border-[var(--border)] bg-black/20 p-4">
        <Link className="button-secondary !px-4 !py-2 text-sm" href={`/customers/${customer.id}` as Route}>
          View Jobs
        </Link>
        <Link className="button-ghost !px-4 !py-2 text-sm" href={`/jobs/new?customerId=${customer.id}` as Route}>
          New Job
        </Link>
      </div>
    </article>
  );
}
