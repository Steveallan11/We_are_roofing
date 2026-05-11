"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { StatusPill } from "@/components/ui/status-pill";
import { JOBS_BOARD_COLUMNS, SECONDARY_JOB_STATUSES, getNextActionLabel, getStatusDescription, type JobWithContext } from "@/lib/job-workflow";
import { currency, formatDate } from "@/lib/utils";
import type { JobStatus } from "@/lib/types";

type Props = {
  jobs: JobWithContext[];
};

type Filters = {
  status: string;
  roofType: string;
  jobType: string;
  readiness: string;
};

const initialFilters: Filters = {
  status: "All",
  roofType: "All",
  jobType: "All",
  readiness: "All"
};

export function KanbanBoard({ jobs }: Props) {
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [movingJobId, setMovingJobId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const roofTypes = useMemo(
    () => ["All", ...Array.from(new Set(jobs.map((job) => job.roof_type).filter(Boolean) as string[])).sort()],
    [jobs]
  );
  const jobTypes = useMemo(
    () => ["All", ...Array.from(new Set(jobs.map((job) => job.job_type).filter(Boolean) as string[])).sort()],
    [jobs]
  );

  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      if (filters.status !== "All" && job.status !== filters.status) return false;
      if (filters.roofType !== "All" && job.roof_type !== filters.roofType) return false;
      if (filters.jobType !== "All" && job.job_type !== filters.jobType) return false;
      if (filters.readiness === "Survey Ready" && !["Survey Complete", "Ready For AI Quote"].includes(job.status)) return false;
      if (filters.readiness === "Quote Ready" && job.status !== "Ready To Send") return false;
      if (filters.readiness === "Booked / Won" && !["Accepted", "Booked", "Completed"].includes(job.status)) return false;
      return true;
    });
  }, [filters, jobs]);

  const columns = JOBS_BOARD_COLUMNS.map((column) => ({
    ...column,
    jobs: filteredJobs.filter((job) => job.status === column.status)
  }));

  async function moveJob(jobId: string, status: JobStatus) {
    setMovingJobId(jobId);
    setError(null);
    setFeedback(`Moving job to ${status}...`);

    const response = await fetch("/api/jobs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ job_id: jobId, status })
    });

    const result = (await response.json().catch(() => null)) as { ok?: boolean; error?: string; message?: string } | null;
    if (!response.ok || !result?.ok) {
      setError(result?.error || "Unable to move this job.");
      setFeedback(null);
      setMovingJobId(null);
      return;
    }

    setFeedback(result?.message || "Job status updated.");
    startTransition(() => {
      window.location.reload();
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <select className="field" onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))} value={filters.status}>
          <option>All</option>
          {JOBS_BOARD_COLUMNS.map((column) => (
            <option key={column.status} value={column.status}>
              {column.label}
            </option>
          ))}
          {SECONDARY_JOB_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
        <select className="field" onChange={(event) => setFilters((current) => ({ ...current, roofType: event.target.value }))} value={filters.roofType}>
          {roofTypes.map((roofType) => (
            <option key={roofType} value={roofType}>
              {roofType === "All" ? "All Roof Types" : roofType}
            </option>
          ))}
        </select>
        <select className="field" onChange={(event) => setFilters((current) => ({ ...current, jobType: event.target.value }))} value={filters.jobType}>
          {jobTypes.map((jobType) => (
            <option key={jobType} value={jobType}>
              {jobType === "All" ? "All Job Types" : jobType}
            </option>
          ))}
        </select>
        <select className="field" onChange={(event) => setFilters((current) => ({ ...current, readiness: event.target.value }))} value={filters.readiness}>
          <option value="All">All Readiness</option>
          <option value="Survey Ready">Survey Ready</option>
          <option value="Quote Ready">Quote Ready</option>
          <option value="Booked / Won">Booked / Won</option>
        </select>
      </div>

      {feedback ? <p className="text-sm text-[#7ce3a6]">{feedback}</p> : null}
      {error ? <p className="text-sm text-[#ff9a91]">{error}</p> : null}

      <div className="overflow-x-auto">
        <div className="grid min-w-[1300px] grid-cols-5 gap-4 xl:grid-cols-10">
          {columns.map((column) => (
            <div className="card min-h-[500px] p-4" key={column.status}>
              <div className="mb-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <StatusPill status={column.status} />
                  <span className="text-xs text-[var(--muted)]">{column.jobs.length}</span>
                </div>
                <p className="text-xs text-[var(--dim)]">{getStatusDescription(column.status)}</p>
              </div>

              <div className="space-y-3">
                {column.jobs.length > 0 ? (
                  column.jobs.map((job) => (
                    <div className="rounded-2xl border border-[var(--border)] bg-[rgba(212,175,55,0.05)] p-3" key={job.id}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--gold-l)]">{job.job_ref ?? "WR-J-TBC"}</p>
                          <h4 className="mt-2 font-condensed text-xl text-white">{job.job_title}</h4>
                        </div>
                        <span className="rounded-full border border-[var(--border2)] px-2 py-1 text-[0.65rem] text-[var(--muted)]">
                          {job.roof_type ?? "Roof"}
                        </span>
                      </div>

                      <p className="mt-2 text-sm text-[var(--text)]">{job.customer?.full_name ?? "Customer missing"}</p>
                      <p className="mt-1 text-xs text-[var(--dim)]">{job.property_address}</p>

                      <div className="mt-3 grid gap-2 text-xs text-[var(--muted)]">
                        <div className="flex items-center justify-between gap-2">
                          <span>Quote</span>
                          <span className="text-[var(--gold-l)]">{job.quote?.quote_ref ?? "Not drafted"}</span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span>Value</span>
                          <span className="text-[var(--text)]">{job.estimated_value ? currency(job.estimated_value) : "TBC"}</span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span>Next</span>
                          <span className="text-right text-[var(--text)]">{getNextActionLabel(job)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span>Updated</span>
                          <span>{formatDate(job.updated_at ?? job.created_at ?? null)}</span>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center gap-2">
                        {job.quote ? <StatusPill status={job.quote.status} /> : null}
                      </div>

                      <div className="mt-4 space-y-2">
                        <select
                          className="field !py-2 text-sm"
                          disabled={isPending && movingJobId === job.id}
                          onChange={(event) => {
                            const nextStatus = event.target.value as JobStatus;
                            if (!nextStatus) return;
                            void moveJob(job.id, nextStatus);
                          }}
                          value=""
                        >
                          <option value="">Move to...</option>
                          {JOBS_BOARD_COLUMNS.filter((item) => item.status !== job.status).map((item) => (
                            <option key={item.status} value={item.status}>
                              {item.label}
                            </option>
                          ))}
                        </select>
                        <Link className="button-ghost w-full !py-2 text-sm" href={`/jobs/${job.id}`}>
                          Open Job File
                        </Link>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-[var(--border)] p-3 text-sm text-[var(--dim)]">No jobs in this stage.</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
