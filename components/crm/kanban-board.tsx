import Link from "next/link";
import { StatusPill } from "@/components/ui/status-pill";
import type { Customer, Job, JobStatus, QuoteRecord } from "@/lib/types";

type Props = {
  columns: Array<{
    status: JobStatus;
    jobs: Array<Job & { customer?: Customer | null; quote?: QuoteRecord | null }>;
  }>;
};

export function KanbanBoard({ columns }: Props) {
  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[1100px] grid-cols-5 gap-4 xl:grid-cols-9">
        {columns.map((column) => (
          <div className="card min-h-[420px] p-4" key={column.status}>
            <div className="mb-4 flex items-center justify-between gap-2">
              <StatusPill status={column.status} />
              <span className="text-xs text-[var(--muted)]">{column.jobs.length}</span>
            </div>
            <div className="space-y-3">
              {column.jobs.length > 0 ? (
                column.jobs.map((job) => (
                  <Link className="block rounded-2xl border border-[var(--border)] bg-[rgba(212,175,55,0.05)] p-3" href={`/jobs/${job.id}`} key={job.id}>
                    <h4 className="font-condensed text-xl text-white">{job.job_title}</h4>
                    <p className="mt-1 text-sm text-[var(--muted)]">{job.customer?.full_name ?? "Customer missing"}</p>
                    <p className="mt-1 text-xs text-[var(--dim)]">{job.property_address}</p>
                    {job.quote?.quote_ref ? <p className="mt-2 text-xs text-[var(--gold-l)]">{job.quote.quote_ref}</p> : null}
                  </Link>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-[var(--border)] p-3 text-sm text-[var(--dim)]">No jobs here yet.</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

