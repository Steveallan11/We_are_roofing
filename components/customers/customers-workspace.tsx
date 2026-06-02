"use client";

import Link from "next/link";
import type { Route } from "next";
import { useMemo, useState } from "react";
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
      <div className="card p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="section-kicker text-[0.65rem] uppercase">Customers</p>
            <h2 className="mt-2 font-condensed text-3xl text-white">{customers.length} saved contacts</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">Search by name, phone, email, town or postcode. Active customers have live jobs in the pipeline.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link className="button-primary" href={"/customers/new" as Route}>
              Add Customer
            </Link>
            <Link className="button-ghost" href={"/jobs/new" as Route}>
              Add Job
            </Link>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <CustomerStat label="Active" value={activeCustomers.length.toString()} />
          <CustomerStat label="Historic" value={historicCustomers.length.toString()} />
          <CustomerStat danger={missingEmailCount > 0} label="Missing Email" value={missingEmailCount.toString()} />
          <CustomerStat danger={missingPhoneCount > 0} label="Missing Phone" value={missingPhoneCount.toString()} />
        </div>
        <div className="mt-4 flex rounded-2xl border border-[var(--border)] bg-black/20 p-1">
          <button className={view === "active" ? "flex-1 rounded-xl bg-[var(--gold)] px-4 py-2 text-sm font-bold text-black" : "flex-1 rounded-xl px-4 py-2 text-sm font-semibold text-[var(--muted)]"} onClick={() => setView("active")} type="button">
            Active ({activeCustomers.length})
          </button>
          <button className={view === "historic" ? "flex-1 rounded-xl bg-[var(--gold)] px-4 py-2 text-sm font-bold text-black" : "flex-1 rounded-xl px-4 py-2 text-sm font-semibold text-[var(--muted)]"} onClick={() => setView("historic")} type="button">
            Historic ({historicCustomers.length})
          </button>
        </div>
        <input className="field mt-4" onChange={(event) => setQuery(event.target.value)} placeholder="Search customers..." value={query} />
      </div>

      {filtered.length ? (
        <div className="grid gap-3">
          {filtered.map((customer) => (
            <CustomerSummaryCard customer={customer} key={customer.id} />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <p className="empty-state__title">No customers found</p>
          <p className="empty-state__hint">Try a different search, switch tabs, or add a new customer to get started.</p>
          <Link className="button-primary mt-2" href={"/customers/new" as Route}>
            Add Customer
          </Link>
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
    <article className="card overflow-hidden">
      <div className="p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[var(--border)] bg-black/30 font-bold text-[var(--gold-l)]">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate font-condensed text-2xl text-white">{displayName}</h3>
              <span className={activeJobs.length ? "tag-chip tag-chip--success" : "tag-chip"}>
                {activeJobs.length ? `${activeJobs.length} active` : "Historic"}
              </span>
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
              <span className="tag-chip tag-chip--warning" key={item}>
                {item}
              </span>
            ))}
          </div>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-3 border-t border-[var(--border)] bg-black/20 p-4">
        <Link className="button-secondary !px-4 !py-2 text-sm" href={`/customers/${customer.id}` as Route}>
          Open Customer
        </Link>
        <Link className="button-ghost !px-4 !py-2 text-sm" href={`/jobs/new?customerId=${customer.id}` as Route}>
          New Job
        </Link>
        {phone ? (
          <a className="button-ghost !px-4 !py-2 text-sm" href={`tel:${phone}`}>
            Call
          </a>
        ) : null}
        {email ? (
          <a className="button-ghost !px-4 !py-2 text-sm" href={`mailto:${email}`}>
            Email
          </a>
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
