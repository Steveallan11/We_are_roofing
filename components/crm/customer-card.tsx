import { formatDate } from "@/lib/utils";
import type { Customer, Job } from "@/lib/types";

type Props = {
  customer: Customer;
  jobs: Job[];
};

export function CustomerCard({ customer, jobs }: Props) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="section-kicker text-[0.65rem] uppercase">Customer</p>
          <h3 className="mt-2 font-condensed text-2xl text-white">{customer.full_name}</h3>
          <p className="mt-2 text-sm text-[var(--muted)]">
            {[customer.address_line_1, customer.town, customer.postcode].filter(Boolean).join(", ") || "No address saved"}
          </p>
        </div>
        <div className="rounded-full border border-[var(--border2)] px-3 py-1 text-xs text-[var(--gold-l)]">
          {jobs.length} {jobs.length === 1 ? "job" : "jobs"}
        </div>
      </div>
      <div className="gold-divider my-4" />
      <div className="space-y-2 text-sm text-[var(--muted)]">
        <p>{customer.phone ?? "No phone saved"}</p>
        <p>{customer.email ?? "No email saved"}</p>
        <p>Created {formatDate(customer.created_at ?? null)}</p>
      </div>
    </div>
  );
}

