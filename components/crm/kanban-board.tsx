"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
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

const priorityStatuses: JobStatus[] = ["Survey Needed", "Ready For AI Quote", "Ready To Send", "Quote Sent"];

export function KanbanBoard({ jobs }: Props) {
  const [boardJobs, setBoardJobs] = useState(jobs);
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [movingJobId, setMovingJobId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setBoardJobs(jobs);
  }, [jobs]);

  const roofTypes = useMemo(
    () => ["All", ...Array.from(new Set(boardJobs.map((job) => job.roof_type).filter(Boolean) as string[])).sort()],
    [boardJobs]
  );
  const jobTypes = useMemo(
    () => ["All", ...Array.from(new Set(boardJobs.map((job) => job.job_type).filter(Boolean) as string[])).sort()],
    [boardJobs]
  );

  const filteredJobs = useMemo(() => {
    return boardJobs.filter((job) => {
      if (filters.status !== "All" && job.status !== filters.status) return false;
      if (filters.roofType !== "All" && job.roof_type !== filters.roofType) return false;
      if (filters.jobType !== "All" && job.job_type !== filters.jobType) return false;
      if (filters.readiness === "Survey Ready" && !["Survey Complete", "Ready For AI Quote"].includes(job.status)) return false;
      if (filters.readiness === "Quote Ready" && job.status !== "Ready To Send") return false;
      if (filters.readiness === "Booked / Won" && !["Accepted", "Booked", "Completed"].includes(job.status)) return false;
      return true;
    });
  }, [boardJobs, filters]);

  const columns = JOBS_BOARD_COLUMNS.map((column) => ({
    ...column,
    jobs: filteredJobs.filter((job) => job.status === column.status)
  }));

  const priorityJobs = filteredJobs
    .filter((job) => priorityStatuses.includes(job.status))
    .sort((a, b) => priorityStatuses.indexOf(a.status) - priorityStatuses.indexOf(b.status))
    .slice(0, 6);

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
    setBoardJobs((current) => current.map((job) => (job.id === jobId ? { ...job, status, updated_at: new Date().toISOString() } : job)));
    startTransition(() => {
      setMovingJobId(null);
    });
  }

  return (
    <div className="space-y-4">
      <div className="sticky top-3 z-20 rounded-2xl border border-[var(--border)] bg-[rgba(10,10,10,0.92)] p-3 shadow-2xl backdrop-blur">
        <div className="grid gap-2 md:grid-cols-4">
          <select className="field !rounded-xl !px-3 !py-2 !text-sm" onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))} value={filters.status}>
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
          <select className="field !rounded-xl !px-3 !py-2 !text-sm" onChange={(event) => setFilters((current) => ({ ...current, roofType: event.target.value }))} value={filters.roofType}>
            {roofTypes.map((roofType) => (
              <option key={roofType} value={roofType}>
                {roofType === "All" ? "All Roof Types" : roofType}
              </option>
            ))}
          </select>
          <select className="field !rounded-xl !px-3 !py-2 !text-sm" onChange={(event) => setFilters((current) => ({ ...current, jobType: event.target.value }))} value={filters.jobType}>
            {jobTypes.map((jobType) => (
              <option key={jobType} value={jobType}>
                {jobType === "All" ? "All Job Types" : jobType}
              </option>
            ))}
          </select>
          <select className="field !rounded-xl !px-3 !py-2 !text-sm" onChange={(event) => setFilters((current) => ({ ...current, readiness: event.target.value }))} value={filters.readiness}>
            <option value="All">All Readiness</option>
            <option value="Survey Ready">Survey Ready</option>
            <option value="Quote Ready">Quote Ready</option>
            <option value="Booked / Won">Booked / Won</option>
          </select>
        </div>
      </div>

      {feedback ? <p className="text-sm text-[#7ce3a6]">{feedback}</p> : null}
      {error ? <p className="text-sm text-[#ff9a91]">{error}</p> : null}

      {priorityJobs.length > 0 ? (
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {priorityJobs.map((job) => (
            <Link
              className="group rounded-2xl border border-[var(--border)] bg-[rgba(212,175,55,0.08)] px-3 py-2 transition hover:border-[var(--gold)] hover:bg-[rgba(212,175,55,0.12)]"
              href={`/jobs/${job.id}`}
              key={`priority-${job.id}`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold uppercase tracking-[0.18em] text-[var(--gold-l)]">{job.job_ref ?? "WR-J-TBC"} · {job.customer?.full_name ?? "Customer missing"}</p>
                  <p className="mt-1 truncate text-sm text-[var(--text)]">{getNextActionLabel(job)}</p>
                </div>
                <StatusPill status={job.status} />
              </div>
            </Link>
          ))}
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <div className="grid min-w-[1500px] grid-cols-10 gap-3">
          {columns.map((column) => (
            <div className="rounded-2xl border border-[var(--border)] bg-[rgba(0,0,0,0.22)]" key={column.status}>
              <div className="sticky top-[88px] z-10 border-b border-[var(--border)] bg-[rgba(17,17,17,0.96)] p-3 backdrop-blur">
                <div className="flex items-center justify-between gap-2">
                  <StatusPill status={column.status} />
                  <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-[rgba(255,255,255,0.06)] px-2 text-xs font-bold text-[var(--muted)]">{column.jobs.length}</span>
                </div>
                <p className="mt-2 min-h-8 text-[0.68rem] leading-snug text-[var(--dim)]">{getStatusDescription(column.status)}</p>
              </div>

              <div className="max-h-[68vh] space-y-2 overflow-y-auto p-2">
                {column.jobs.length > 0 ? (
                  column.jobs.map((job) => (
                    <article className="group rounded-xl border border-[rgba(212,175,55,0.14)] bg-[rgba(22,22,22,0.88)] p-2.5 transition hover:-translate-y-0.5 hover:border-[var(--border2)]" key={job.id}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-[0.68rem] font-bold uppercase tracking-[0.18em] text-[var(--gold-l)]">{job.job_ref ?? "WR-J-TBC"}</p>
                          <h4 className="mt-1 truncate text-sm font-semibold text-white">{job.customer?.full_name ?? "Customer missing"}</h4>
                        </div>
                        <span className="max-w-[72px] truncate rounded-full border border-[var(--border)] px-2 py-1 text-[0.62rem] text-[var(--muted)]">{job.roof_type ?? "Roof"}</span>
                      </div>

                      <p className="mt-1 truncate text-xs text-[var(--muted)]">{job.job_title}</p>
                      <p className="mt-1 truncate text-[0.68rem] text-[var(--dim)]">{job.property_address}</p>

                      <div className="mt-2 grid grid-cols-2 gap-1.5 text-[0.68rem]">
                        <div className="rounded-lg bg-black/20 px-2 py-1">
                          <span className="block text-[var(--dim)]">Value</span>
                          <span className="font-semibold text-[var(--text)]">{job.estimated_value ? currency(job.estimated_value) : "TBC"}</span>
                        </div>
                        <div className="rounded-lg bg-black/20 px-2 py-1">
                          <span className="block text-[var(--dim)]">Updated</span>
                          <span className="font-semibold text-[var(--text)]">{formatDate(job.updated_at ?? job.created_at ?? null)}</span>
                        </div>
                      </div>

                      <div className="mt-2 rounded-lg border border-[rgba(212,175,55,0.12)] bg-[rgba(212,175,55,0.05)] px-2 py-1.5">
                        <p className="text-[0.66rem] uppercase tracking-[0.16em] text-[var(--dim)]">Next</p>
                        <p className="mt-0.5 text-xs leading-snug text-[var(--text)]">{getNextActionLabel(job)}</p>
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {job.quote ? <StatusPill status={job.quote.status} /> : <span className="rounded-full border border-[var(--border)] px-2 py-1 text-[0.65rem] text-[var(--dim)]">No quote</span>}
                        <span className="rounded-full border border-[var(--border)] px-2 py-1 text-[0.65rem] text-[var(--dim)]">{job.job_type ?? "Job"}</span>
                      </div>

                      <div className="mt-2 grid grid-cols-[1fr_auto] gap-1.5">
                        <select
                          className="field !rounded-xl !px-2 !py-1.5 !text-xs"
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
                        <Link className="button-ghost !rounded-xl !px-3 !py-1.5 !text-xs" href={`/jobs/${job.id}`}>
                          Open
                        </Link>
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="rounded-xl border border-dashed border-[var(--border)] p-3 text-center text-xs text-[var(--dim)]">Empty</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
