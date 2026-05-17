"use client";

import { useMemo, useState } from "react";
import { AttentionBanner } from "@/components/jobs/AttentionBanner";
import { JobCard } from "@/components/jobs/job-card";
import { JobFilters } from "@/components/jobs/JobFilters";
import { PipelineStrip } from "@/components/jobs/PipelineStrip";
import { EmptyState } from "@/components/ui/EmptyState";
import { getPipelineGroup, PIPELINE_GROUPS, type PipelineGroupKey } from "@/lib/jobs/pipelineGroups";
import { needsAttention, type JobForAction } from "@/lib/jobs/nextAction";
import { getStatusColor } from "@/lib/jobs/statusColors";
import { currency } from "@/lib/utils";

type Props = {
  jobs: JobForAction[];
  initialFilter?: PipelineGroupKey | "all" | "attention";
};

export function JobsWorkspace({ jobs, initialFilter = "all" }: Props) {
  const [activeFilter, setActiveFilter] = useState<PipelineGroupKey | "all" | "attention">(initialFilter);
  const [view, setView] = useState<"board" | "list">("board");
  const attentionJobs = useMemo(() => jobs.filter(needsAttention), [jobs]);
  const activeJobs = useMemo(() => jobs.filter((job) => !["Completed", "Lost", "Archived"].includes(job.status)), [jobs]);
  const pipelineValue = useMemo(() => activeJobs.reduce((sum, job) => sum + Number(job.estimated_value ?? 0), 0), [activeJobs]);
  const filteredJobs = useMemo(() => {
    if (activeFilter === "attention") return attentionJobs;
    const group = getPipelineGroup(activeFilter);
    if (!group) return jobs;
    return jobs.filter((job) => group.statuses.includes(job.status));
  }, [activeFilter, attentionJobs, jobs]);
  const visibleGroups = activeFilter === "all" || activeFilter === "attention" ? PIPELINE_GROUPS : PIPELINE_GROUPS.filter((group) => group.key === activeFilter);

  return (
    <div className="stack">
      <section className="grid gap-3 md:grid-cols-3">
        <SummaryTile label="Active jobs" value={activeJobs.length.toString()} hint="Open work excluding completed, lost, and archived" />
        <SummaryTile label="Pipeline value" value={currency(pipelineValue)} hint="Estimated value across active jobs" />
        <SummaryTile label="Urgent" value={attentionJobs.length.toString()} hint="Follow-ups, ready-to-send, or surveys due today" danger={attentionJobs.length > 0} />
      </section>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="section-kicker text-[0.65rem] uppercase">Roofing Pipeline</p>
          <p className="mt-1 text-sm text-[var(--muted)]">Board for the day-to-day flow. List view is for quick scanning.</p>
        </div>
        <div className="flex rounded-2xl border border-[var(--border)] bg-black/20 p-1">
          <button className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${view === "board" ? "bg-[var(--gold)] text-black" : "text-[var(--muted)]"}`} onClick={() => setView("board")} type="button">
            Board
          </button>
          <button className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${view === "list" ? "bg-[var(--gold)] text-black" : "text-[var(--muted)]"}`} onClick={() => setView("list")} type="button">
            List
          </button>
        </div>
      </div>

      <AttentionBanner jobs={attentionJobs} onViewAll={() => setActiveFilter("attention")} />
      <PipelineStrip active={activeFilter === "attention" ? "all" : activeFilter} jobs={jobs} onSelect={setActiveFilter} />
      <JobFilters active={activeFilter} attentionCount={attentionJobs.length} onSelect={setActiveFilter} />

      {filteredJobs.length === 0 ? (
        <EmptyState title="No jobs here" message="This filter is clear. Switch back to All Jobs or add a new lead." actionHref="/jobs/new" actionLabel="+ Add Job" />
      ) : view === "list" || activeFilter === "attention" ? (
        <div className="grid gap-3">
          {filteredJobs.map((job) => (
            <JobCard job={job} key={job.id} list />
          ))}
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {visibleGroups.map((group) => {
            const groupJobs = jobs.filter((job) => group.statuses.includes(job.status));
            const value = groupJobs.reduce((sum, job) => sum + Number(job.estimated_value ?? 0), 0);
            const color = groupJobs[0] ? getStatusColor(groupJobs[0].status).dot : "var(--gold)";
            return (
              <section className="min-w-[260px] flex-1 rounded-[1.25rem] border bg-black/20" key={group.key} style={{ borderColor: color }}>
                <div className="border-b border-[var(--border)] p-3" style={{ background: groupJobs[0] ? `${color}12` : "rgba(212,175,55,0.07)" }}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-white">{group.label}</p>
                      <p className="mt-1 text-xs text-[var(--muted)]">{groupJobs.length} jobs{value > 0 ? ` | ${currency(value)}` : ""}</p>
                    </div>
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
                  </div>
                </div>
                <div className="grid min-h-[220px] gap-3 p-3">
                  {groupJobs.length ? (
                    groupJobs.map((job) => <JobCard compact job={job} key={job.id} />)
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
