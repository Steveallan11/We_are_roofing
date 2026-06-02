"use client";

import Link from "next/link";
import type { Route } from "next";
import { useMemo, useState } from "react";
import { Button, Input, Badge } from "@/components/ui/primitives";
import { getJobPipelineValue } from "@/lib/quotes/value";
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
  const [view, setView] = useState<"active" | "historic">("active");
  const activeCustomers = useMemo(() => customers.filter((customer) => customer.jobs.some(isActiveJob)), [customers]);
  const historicCustomers = useMemo(() => customers.filter((customer) => !customer.jobs.some(isActiveJob)), [customers]);
  const visibleCustomers = view === "active" ? activeCustomers : historicCustomers;
  const missingEmailCount = customers.filter((customer) => !getPrimaryEmail(customer)).length;
  const missingPhoneCount = customers.filter((customer) => !getPrimaryPhone(customer)).length;
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return visibleCustomers;
    return visibleCustomers.filter((customer) =>
      [
        customer.full_name,
        customer.business_name,
        customer.contact_person_name,
        customer.phone,
        customer.email,
        customer.postcode,
        customer.town,
        customer.county
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle)
    );
  }, [query, visibleCustomers]);

  return (
    <div className="stack">
      <div className="p-5 rounded-xl border border-[var(--border)] bg-[var(--surface)]">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-[var(--dim)]">Customers</p>
            <h2 className="mt-2 font-condensed text-3xl text-white">{customers.length} saved contacts</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">Search by name, phone, email, town or postcode. Active customers have live jobs in the pipeline.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" size="md" asChild>
              <Link href={"/customers/new" as Route}>Add Customer</Link>
            </Button>
            <Button variant="ghost" size="md" asChild>
              <Link href={"/jobs/new" as Route}>Add Job</Link>
            </Button>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <CustomerStat label="Active" value={activeCustomers.length.toString()} />
          <CustomerStat label="Historic" value={historicCustomers.length.toString()} />
          <CustomerStat danger={missingEmailCount > 0} label="Missing Email" value={missingEmailCount.toString()} />
          <CustomerStat danger={missingPhoneCount > 0} label="Missing Phone" value={missingPhoneCount.toString()} />
        </div>
        <div className="mt-4 flex gap-2">
          <Button variant={view === "active" ? "primary" : "secondary"} className="flex-1" onClick={() => setView("active")}>
            Active ({activeCustomers.length})
          </Button>
          <Button variant={view === "historic" ? "primary" : "secondary"} className="flex-1" onClick={() => setView("historic")}>
            Historic ({historicCustomers.length})
          </Button>
        </div>
        <div className="mt-4">
          <Input placeholder="Search customers..." onChange={(e) => setQuery(e.target.value)} value={query} />
        </div>
      </div>

      {filtered.length ? (
        <div className="grid gap-3">
          {filtered.map((customer) => (
            <CustomerSummaryCard customer={customer} key={customer.id} />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-[var(--border-mid)] p-8 text-center">
          <p className="font-semibold text-[var(--text)]">No customers found</p>
          <p className="mt-2 text-sm text-[var(--text-muted)]">Try a different search, switch tabs, or add a new customer to get started.</p>
          <Button variant="primary" size="md" asChild className="mt-4">
            <Link href={"/customers/new" as Route}>Add Customer</Link>
          </Button>
        </div>
      )}
    </div>
  );
}

export function CustomerSummaryCard({ customer }: { customer: CustomerWithJobs }) {
  const totalValue = customer.jobs.reduce((sum, job) => sum + Number(job.final_value ?? getJobPipelineValue(job) ?? 0), 0);
  const activeJobs = customer.jobs.filter(isActiveJob);
  const lastUpdated = [...customer.jobs]
    .map((job) => job.updated_at ?? job.created_at)
    .filter(Boolean)
    .sort()
    .at(-1);
  const displayName = customer.business_name || customer.full_name;
  const subtitle = customer.customer_type === "business" ? customer.contact_person_name || "No contact person saved" : getPrimaryEmail(customer) ?? "No email saved";
  const phone = getPrimaryPhone(customer);
  const email = getPrimaryEmail(customer);
  const missing = [email ? null : "Missing email", phone ? null : "Missing phone"].filter(Boolean);
  const initials = displayName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <article className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
      <div className="p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[var(--border)] bg-black/30 font-bold text-[var(--gold-l)]">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate font-condensed text-2xl text-white">{displayName}</h3>
              <Badge variant={activeJobs.length ? "active" : "neutral"} size="sm">
                {activeJobs.length ? `${activeJobs.length} active` : "Historic"}
              </Badge>
            </div>
            <p className="mt-1 truncate text-sm text-[var(--muted)]">{subtitle}</p>
            <div className="mt-2 flex flex-wrap gap-2 text-sm">
              {phone ? <a className="text-[var(--gold-l)] underline-offset-4 hover:underline" href={`tel:${phone}`}>{phone}</a> : <span className="text-[var(--muted)]">No phone</span>}
              {email ? <a className="text-[var(--gold-l)] underline-offset-4 hover:underline" href={`mailto:${email}`}>{email}</a> : <span className="text-[var(--muted)]">No email</span>}
            </div>
          </div>
        </div>
          <div className="grid gap-1 text-sm text-[var(--muted)] lg:min-w-[300px] lg:text-right">
            <p>{[customer.town, customer.postcode].filter(Boolean).join(", ") || "No town/postcode"}</p>
            <p>{customer.jobs.length} job{customer.jobs.length === 1 ? "" : "s"} | {currency(totalValue)} lifetime value</p>
            <p>Last activity {formatDate(lastUpdated)}</p>
          </div>
        </div>
        {missing.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {missing.map((item) => (
              <Badge key={item} variant="alert" size="sm">
                {item}
              </Badge>
            ))}
          </div>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-3 border-t border-[var(--border)] bg-black/20 p-4">
        <Button variant="secondary" size="sm" asChild>
          <Link href={`/customers/${customer.id}` as Route}>Open Customer</Link>
        </Button>
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/jobs/new?customerId=${customer.id}` as Route}>New Job</Link>
        </Button>
        {phone ? (
          <Button variant="ghost" size="sm" asChild>
            <a href={`tel:${phone}`}>Call</a>
          </Button>
        ) : null}
        {email ? (
          <Button variant="ghost" size="sm" asChild>
            <a href={`mailto:${email}`}>Email</a>
          </Button>
        ) : null}
      </div>
    </article>
  );
}

function CustomerStat({ danger = false, label, value }: { danger?: boolean; label: string; value: string }) {
  return (
    <div className={`rounded-2xl border p-3 ${danger ? "border-[color:var(--warning-border)] bg-[color:var(--warning-bg)]" : "border-[var(--border)] bg-black/20"}`}>
      <p className="text-[0.62rem] font-bold uppercase tracking-[0.18em] text-[var(--dim)]">{label}</p>
      <p className={`mt-1 font-display text-3xl leading-none ${danger ? "text-[color:var(--warning-text)]" : "text-[var(--gold-l)]"}`}>{value}</p>
    </div>
  );
}

function isActiveJob(job: Job) {
  return !["Completed", "Lost", "Archived", "Not Proceeding"].includes(job.status);
}

function getPrimaryPhone(customer: Customer) {
  return customer.customer_type === "business" ? customer.contact_person_phone || customer.phone : customer.phone;
}

function getPrimaryEmail(customer: Customer) {
  return customer.customer_type === "business" ? customer.contact_person_email || customer.email : customer.email;
}
