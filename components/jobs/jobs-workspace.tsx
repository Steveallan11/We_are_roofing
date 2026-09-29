"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/primitives";
import { AttentionBanner } from "@/components/jobs/AttentionBanner";
import { JobCard } from "@/components/jobs/job-card";
import { JobFilters } from "@/components/jobs/JobFilters";
import { JobSearchDialog } from "@/components/jobs/JobSearchDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { getPipelineGroup, PIPELINE_GROUPS, type PipelineGroupKey } from "@/lib/jobs/pipelineGroups";
import { needsAttention, type JobForAction } from "@/lib/jobs/nextAction";
import { getStatusColor } from "@/lib/jobs/statusColors";
import { getJobPipelineValue } from "@/lib/quotes/value";
import type { JobStatus } from "@/lib/types";
import { currency } from "@/lib/utils";

type Props = {
  jobs: JobForAction[];
  initialFilter?: WorkspaceFilter;
};

export type WorkspaceFilter = PipelineGroupKey | "all" | "attention" | "stale" | "archived";

export function JobsWorkspace({ jobs, initialFilter = "all" }: Props) {
  const [optimisticJobs, setOptimisticJobs] = useState(jobs);
  const [activeFilter, setActiveFilter] = useState<WorkspaceFilter>(initialFilter);
  const [view, setView] = useState<"board" | "list">("list");
  const [draggingJobId, setDraggingJobId] = useState<string | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  useEffect(() => {
    setOptimisticJobs(jobs);
  }, [jobs]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const attentionJobs = useMemo(() => optimisticJobs.filter(needsAttention), [optimisticJobs]);
  const activeJobs = useMemo(() => optimisticJobs.filter((job) => !["Completed", "Not Proceeding", "Lost", "Archived"].includes(job.status)), [optimisticJobs]);
  const staleJobs = useMemo(() => activeJobs.filter(isStaleJob), [activeJobs]);
  const archivedJobs = useMemo(() => optimisticJobs.filter((job) => job.status === "Archived"), [optimisticJobs]);
  const pipelineValue = useMemo(() => activeJobs.reduce((sum, job) => sum + Number(getJobPipelineValue(job) ?? 0), 0), [activeJobs]);
  const filteredJobs = useMemo(() => {
    if (activeFilter === "attention") return attentionJobs;
    if (activeFilter === "stale") return staleJobs;
    if (activeFilter === "archived") return archivedJobs;
    const group = getPipelineGroup(activeFilter);
    if (!group) return activeJobs;
    return optimisticJobs.filter((job) => group.statuses.includes(job.status));
  }, [activeFilter, activeJobs, archivedJobs, attentionJobs, optimisticJobs, staleJobs]);
  const visibleGroups = activeFilter === "all" || activeFilter === "attention" || activeFilter === "stale" ? PIPELINE_GROUPS.filter((group) => !["complete", "closed"].includes(group.key)) : PIPELINE_GROUPS.filter((group) => group.key === activeFilter);

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

  const applyStatusLocally = (jobId: string, status: JobStatus) => {
    setOptimisticJobs((current) => current.map((job) => (job.id === jobId ? { ...job, status, updated_at: new Date().toISOString() } : job)));
  };

  return (
    <div className="stack">
      <section className="grid gap-3 sm:grid-cols-3">
        <SummaryTile label="Active jobs" value={activeJobs.length.toString()} hint="Open work excluding completed, lost, and archived" />
        <SummaryTile label="Pipeline value" value={currency(pipelineValue)} hint="Estimated value across active jobs" />
        <SummaryTile label="Needs sorting" value={staleJobs.length.toString()} hint="No update for 45 days or more" danger={staleJobs.length > 0} />
      </section>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-[var(--dim)]">Jobs workspace</p>
          <p className="mt-1 text-sm text-[var(--muted)]">Use the list for daily work. Switch to the board when moving several jobs.</p>
        </div>
        <div className="flex gap-2">
          <Button variant={view === "board" ? "primary" : "secondary"} size="sm" onClick={() => setView("board")}>
            Board
          </Button>
          <Button variant={view === "list" ? "primary" : "secondary"} size="sm" onClick={() => setView("list")}>
            List
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex-1">
          <AttentionBanner jobs={attentionJobs} onViewAll={() => setActiveFilter("attention")} />
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setIsSearchOpen(true)}
          className="shrink-0"
        >
          🔍 Search (⌘K)
        </Button>
      </div>

      <JobFilters active={activeFilter} archivedCount={archivedJobs.length} attentionCount={attentionJobs.length} staleCount={staleJobs.length} onSelect={setActiveFilter} />

      {filteredJobs.length === 0 ? (
        <EmptyState title="No jobs here" message="This filter is clear. Switch back to All Jobs or add a new lead." actionHref="/jobs/new" actionLabel="+ Add Job" />
      ) : (
        <>
          {view === "list" || activeFilter === "attention" || activeFilter === "stale" || activeFilter === "archived" ? (
            <div className="grid gap-3">
              {filteredJobs.map((job) => (
                <JobCard job={job} key={job.id} list onStatusChange={applyStatusLocally} />
              ))}
            </div>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-2">
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
                            <JobCard compact job={job} onStatusChange={applyStatusLocally} />
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

      <JobSearchDialog jobs={optimisticJobs} isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </div>
  );
}

function SummaryTile({ label, value, hint, danger = false }: { label: string; value: string; hint: string; danger?: boolean }) {
  return (
    <div className={`card p-4 ${danger ? "border-[color:var(--emergency-border)] bg-[color:var(--emergency-bg)]" : ""}`}>
      <p className="text-[0.65rem] font-bold uppercase tracking-[0.22em] text-[var(--dim)]">{label}</p>
      <p className={`mt-2 font-display text-4xl leading-none ${danger ? "text-[color:var(--emergency-text)]" : "text-[var(--gold-l)]"}`}>{value}</p>
      <p className="mt-2 text-xs text-[var(--muted)]">{hint}</p>
    </div>
  );
}

function isStaleJob(job: JobForAction) {
  if (["Completed", "Not Proceeding", "Lost", "Archived", "In Progress"].includes(job.status)) return false;
  const date = job.updated_at || job.created_at;
  if (!date) return false;
  const age = Date.now() - new Date(date).getTime();
  return Number.isFinite(age) && age >= 45 * 24 * 60 * 60 * 1000;
}
