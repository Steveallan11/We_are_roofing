"use client";

import { useEffect, useMemo, useState } from "react";
import { AttentionBanner } from "@/components/jobs/AttentionBanner";
import { JobCard } from "@/components/jobs/job-card";
import { JobFilters } from "@/components/jobs/JobFilters";
import { PipelineStrip } from "@/components/jobs/PipelineStrip";
import { EmptyState } from "@/components/ui/EmptyState";
import { getPipelineGroup, PIPELINE_GROUPS, type PipelineGroupKey } from "@/lib/jobs/pipelineGroups";
import { needsAttention, type JobForAction } from "@/lib/jobs/nextAction";
import { getStatusColor } from "@/lib/jobs/statusColors";
import { getJobPipelineValue } from "@/lib/quotes/value";
import type { JobStatus } from "@/lib/types";
import { currency } from "@/lib/utils";

type Props = {
  jobs: JobForAction[];
  initialFilter?: PipelineGroupKey | "all" | "attention";
};

export function JobsWorkspace({ jobs, initialFilter = "all" }: Props) {
  const [optimisticJobs, setOptimisticJobs] = useState(jobs);
  const [activeFilter, setActiveFilter] = useState<PipelineGroupKey | "all" | "attention">(initialFilter);
  const [view, setView] = useState<"board" | "list">("board");
  const [draggingJobId, setDraggingJobId] = useState<string | null>(null);

  useEffect(() => {
    setOptimisticJobs(jobs);
  }, [jobs]);

  const attentionJobs = useMemo(() => optimisticJobs.filter(needsAttention), [optimisticJobs]);
  const activeJobs = useMemo(() => optimisticJobs.filter((job) => !["Completed", "Not Proceeding", "Lost", "Archived"].includes(job.status)), [optimisticJobs]);
  const pipelineValue = useMemo(() => activeJobs.reduce((sum, job) => sum + Number(getJobPipelineValue(job) ?? 0), 0), [activeJobs]);
  const filteredJobs = useMemo(() => {
    if (activeFilter === "attention") return attentionJobs;
    const group = getPipelineGroup(activeFilter);
    if (!group) return optimisticJobs;
    return optimisticJobs.filter((job) => group.statuses.includes(job.status));
  }, [activeFilter, attentionJobs, optimisticJobs]);
  const visibleGroups = activeFilter === "all" || activeFilter === "attention" ? PIPELINE_GROUPS : PIPELINE_GROUPS.filter((group) => group.key === activeFilter);

  const moveJobToStatus = async (jobId: string, status: JobStatus) => {
    const previousJobs = optimisticJobs;
    setOptimisticJobs((current) => current.map((job) => (job.id === jobId ? { ...job, status } : job)));
    setDraggingJobId(null);

    const response = await fetch("/api/jobs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ job_id: jobId, status })
    });

    if (!response.ok) {
      setOptimisticJobs(previousJobs);
      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      window.alert(result?.error || "Could not move that job. Please try again.");
    }
  };

  return (
    <div className="stack">
      <section className="hidden gap-3 md:grid-cols-3 lg:grid">
        <SummaryTile label="Active jobs" value={activeJobs.length.toString()} hint="Open work excluding completed, lost, and archived" />
        <SummaryTile label="Pipeline value" value={currency(pipelineValue)} hint="Estimated value across active jobs" />
        <SummaryTile label="Urgent" value={attentionJobs.length.toString()} hint="Follow-ups, ready-to-send, or surveys due today" danger={attentionJobs.length > 0} />
      </section>

      <div className="hidden flex-col gap-3 md:flex-row md:items-center md:justify-between lg:flex">
        <div>
          <p className="section-kicker text-[0.65rem] uppercase">Roofing Pipeline</p>
          <p className="mt-1 text-sm text-[var(--muted)]">Board for the day-to-day flow. List view is for quick scanning.</p>
        </div>
        <div className="hidden rounded-2xl border border-[var(--border)] bg-black/20 p-1 lg:flex">
          <button className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${view === "board" ? "bg-[var(--gold)] text-black" : "text-[var(--muted)]"}`} onClick={() => setView("board")} type="button">
            Board
          </button>
          <button className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${view === "list" ? "bg-[var(--gold)] text-black" : "text-[var(--muted)]"}`} onClick={() => setView("list")} type="button">
            List
          </button>
        </div>
      </div>

      <AttentionBanner jobs={attentionJobs} onViewAll={() => setActiveFilter("attention")} />
      <div className="hidden lg:block">
        <PipelineStrip active={activeFilter === "attention" ? "all" : activeFilter} jobs={optimisticJobs} onSelect={setActiveFilter} />
      </div>
      <div className="hidden lg:block">
        <PipelineTotalsBar jobs={activeJobs} />
      </div>
      <JobFilters active={activeFilter} attentionCount={attentionJobs.length} onSelect={setActiveFilter} />

      {filteredJobs.length === 0 ? (
        <EmptyState title="No jobs here" message="This filter is clear. Switch back to All Jobs or add a new lead." actionHref="/jobs/new" actionLabel="+ Add Job" />
      ) : (
        <>
          <div className="grid gap-4 lg:hidden">
            {visibleGroups.map((group) => {
              const groupJobs = filteredJobs.filter((job) => group.statuses.includes(job.status));
              if (groupJobs.length === 0) return null;
              const color = getStatusColor(groupJobs[0].status).dot;
              return (
                <section key={group.key}>
                  <div className="mb-2 flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
                    <p className="section-kicker text-[0.62rem]">{group.label} ({groupJobs.length})</p>
                    <div className="h-px flex-1 bg-[var(--border)]" />
                  </div>
                  <div className="grid gap-3">
                    {groupJobs.map((job) => (
                      <JobCard job={job} key={job.id} list />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>

          {view === "list" || activeFilter === "attention" ? (
            <div className="hidden gap-3 lg:grid">
              {filteredJobs.map((job) => (
                <JobCard job={job} key={job.id} list />
              ))}
            </div>
          ) : (
            <div className="hidden gap-4 overflow-x-auto pb-2 lg:flex">
              {visibleGroups.map((group) => {
                const groupJobs = optimisticJobs.filter((job) => group.statuses.includes(job.status));
                const value = groupJobs.reduce((sum, job) => sum + Number(getJobPipelineValue(job) ?? 0), 0);
                const color = groupJobs[0] ? getStatusColor(groupJobs[0].status).dot : "var(--gold)";
                return (
                  <section
                    className={`w-[260px] shrink-0 rounded-[var(--card-radius-desktop)] border bg-black/20 transition ${draggingJobId ? "border-dashed" : ""}`}
                    key={group.key}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault();
                      if (draggingJobId) void moveJobToStatus(draggingJobId, group.dropStatus);
                    }}
                    style={{ borderColor: color }}
                  >
                    <div className="border-b border-[var(--border)] p-3" style={{ background: groupJobs[0] ? `${color}12` : "rgba(212,175,55,0.07)" }}>
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-[0.14em]" style={{ color }}>{group.label}</p>
                          <p className="mt-1 text-xs text-[var(--muted)]">{groupJobs.length} jobs{value > 0 ? ` | ${currency(value)}` : ""}</p>
                        </div>
                        <span className="flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-xs font-bold text-black" style={{ background: color }}>
                          {groupJobs.length}
                        </span>
                      </div>
                    </div>
                    <div className="grid min-h-[220px] gap-3 p-3">
                      {groupJobs.length ? (
                        groupJobs.map((job) => (
                          <div
                            draggable
                            key={job.id}
                            onDragEnd={() => setDraggingJobId(null)}
                            onDragStart={() => setDraggingJobId(job.id)}
                            className={draggingJobId === job.id ? "opacity-50" : ""}
                          >
                            <JobCard compact job={job} />
                          </div>
                        ))
                      ) : (
                        <div className="flex min-h-[120px] items-center justify-center rounded-2xl border border-dashed border-[var(--border)] text-sm text-[var(--dim)]">
                          No jobs here
                        </div>
                      )}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function PipelineTotalsBar({ jobs }: { jobs: JobForAction[] }) {
  const total = Math.max(jobs.length, 1);
  const segments = PIPELINE_GROUPS.map((group) => {
    const groupJobs = jobs.filter((job) => group.statuses.includes(job.status));
    const value = groupJobs.reduce((sum, job) => sum + Number(getJobPipelineValue(job) ?? 0), 0);
    const color = groupJobs[0] ? getStatusColor(groupJobs[0].status).dot : "var(--border-mid)";
    return {
      color,
      count: groupJobs.length,
      label: group.label,
      value,
      width: `${(groupJobs.length / total) * 100}%`
    };
  }).filter((segment) => segment.count > 0);

  if (jobs.length === 0) return null;

  return (
    <div className="card p-3">
      <div className="flex h-3 overflow-hidden rounded-full bg-[var(--surface-deep)]">
        {segments.map((segment) => (
          <div
            key={segment.label}
            style={{ background: segment.color, width: segment.width }}
            title={`${segment.label}: ${segment.count} job${segment.count === 1 ? "" : "s"} · ${currency(segment.value)}`}
          />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-xs text-[var(--muted)]">
        {segments.map((segment) => (
          <span className="inline-flex items-center gap-2" key={segment.label}>
            <span className="h-2 w-2 rounded-full" style={{ background: segment.color }} />
            {segment.label}: {segment.count}
          </span>
        ))}
      </div>
    </div>
  );
}

function SummaryTile({ label, value, hint, danger = false }: { label: string; value: string; hint: string; danger?: boolean }) {
  return (
    <div className={`card p-4 ${danger ? "border-[#ef4444]/60 bg-[#ef4444]/10" : ""}`}>
      <p className="text-[0.65rem] font-bold uppercase tracking-[0.22em] text-[var(--dim)]">{label}</p>
      <p className={`mt-2 font-display text-4xl leading-none ${danger ? "text-[#ffb3ad]" : "text-[var(--gold-l)]"}`}>{value}</p>
      <p className="mt-2 text-xs text-[var(--muted)]">{hint}</p>
    </div>
  );
}
