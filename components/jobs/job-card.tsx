import Link from "next/link";
import { getNextActionLabel } from "@/lib/job-workflow";
import { StatusPill } from "@/components/ui/status-pill";
import { currency, formatDate } from "@/lib/utils";
import type { Customer, Job, QuoteRecord } from "@/lib/types";

type Props = {
  job: Job & {
    customer?: Customer | null;
    quote?: QuoteRecord | null;
  };
};

export function JobCard({ job }: Props) {
  return (
    <Link className="card block p-5 transition hover:-translate-y-0.5" href={`/jobs/${job.id}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="section-kicker text-[0.65rem] uppercase">{job.job_ref ?? "WR-J-TBC"}</p>
          <h3 className="mt-2 font-condensed text-2xl text-white">{job.job_title}</h3>
          <p className="mt-2 text-sm text-[var(--muted)]">{job.property_address}</p>
        </div>
        <StatusPill status={job.status} />
      </div>
      <div className="gold-divider my-4" />
      <div className="grid gap-3 text-sm text-[var(--muted)] md:grid-cols-3">
        <div>
          <p className="section-kicker text-[0.58rem] uppercase">Customer</p>
          <p className="mt-1 text-[var(--text)]">{job.customer?.full_name ?? "Unassigned"}</p>
        </div>
        <div>
          <p className="section-kicker text-[0.58rem] uppercase">Estimated</p>
          <p className="mt-1 text-[var(--text)]">{job.estimated_value ? currency(job.estimated_value) : "TBC"}</p>
        </div>
        <div>
          <p className="section-kicker text-[0.58rem] uppercase">Latest Quote</p>
          <p className="mt-1 text-[var(--text)]">{job.quote?.quote_ref ?? "Not drafted yet"}</p>
        </div>
      </div>
      <p className="mt-4 text-sm text-[var(--text)]">Next: {getNextActionLabel(job)}</p>
      <p className="mt-4 text-xs text-[var(--dim)]">Updated {formatDate(job.updated_at ?? job.created_at ?? null)}</p>
    </Link>
  );
}
