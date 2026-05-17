import Link from "next/link";
import { getAttentionReason, type JobForAction } from "@/lib/jobs/nextAction";

type Props = {
  jobs: JobForAction[];
  onViewAll?: () => void;
};

export function AttentionBanner({ jobs, onViewAll }: Props) {
  if (jobs.length === 0) {
    return (
      <div className="rounded-[1.25rem] border border-[var(--border)] bg-black/20 p-4">
        <p className="font-semibold text-white">Nothing urgent right now.</p>
        <p className="mt-1 text-sm text-[var(--muted)]">No overdue follow-ups, no stale sent quotes, and no surveys due today.</p>
      </div>
    );
  }

  return (
    <div className="rounded-[1.25rem] border border-[var(--border)] border-l-4 border-l-[var(--gold)] bg-[rgba(212,175,55,0.09)] p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-[var(--gold-l)]">{jobs.length} need attention today</p>
          <p className="mt-1 text-sm text-[var(--text)]">
            {jobs.slice(0, 3).map((job) => job.customer?.full_name ?? job.job_title).join(", ")}
            {jobs.length > 3 ? ` and ${jobs.length - 3} more` : ""}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">{getAttentionReason(jobs[0])}</p>
        </div>
        <div className="flex gap-2">
          <button className="button-secondary !px-4 !py-2 text-sm" onClick={onViewAll} type="button">
            View all
          </button>
          <Link className="button-ghost !px-4 !py-2 text-sm" href={`/jobs/${jobs[0].id}`}>
            Open first
          </Link>
        </div>
      </div>
    </div>
  );
}
