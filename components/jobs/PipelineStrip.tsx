"use client";

import { PIPELINE_GROUPS, type PipelineGroupKey } from "@/lib/jobs/pipelineGroups";
import { getJobPipelineValue } from "@/lib/quotes/value";
import { currency } from "@/lib/utils";
import type { JobForAction } from "@/lib/jobs/nextAction";

type Props = {
  jobs: JobForAction[];
  active: PipelineGroupKey | "all";
  onSelect: (key: PipelineGroupKey | "all") => void;
};

function getStageColorVars(stage: string): { border: string; bg: string } {
  switch (stage) {
    case "alert":
      return { border: "var(--stage-alert)", bg: "var(--stage-alert-bg)" };
    case "pending":
      return { border: "var(--stage-pending)", bg: "var(--stage-pending-bg)" };
    case "ready":
      return { border: "var(--stage-ready)", bg: "var(--stage-ready-bg)" };
    case "active":
      return { border: "var(--stage-active)", bg: "var(--stage-active-bg)" };
    case "complete":
      return { border: "var(--stage-complete)", bg: "var(--stage-complete-bg)" };
    default:
      return { border: "var(--border)", bg: "transparent" };
  }
}

export function PipelineStrip({ jobs, active, onSelect }: Props) {
  return (
    <div className="grid gap-3 md:grid-cols-4 xl:grid-cols-8">
      {PIPELINE_GROUPS.map((group) => {
        const groupJobs = jobs.filter((job) => group.statuses.includes(job.status));
        const value = groupJobs.reduce((sum, job) => sum + Number(getJobPipelineValue(job) ?? 0), 0);
        const selected = active === group.key;
        const colors = getStageColorVars(group.stage);
        return (
          <button
            className={`card min-h-[108px] border-t-4 p-4 text-left transition hover:-translate-y-0.5 ${selected ? "ring-2 ring-[var(--gold)]" : ""}`}
            key={group.key}
            onClick={() => onSelect(selected ? "all" : group.key)}
            style={{ borderTopColor: `var(--stage-${group.stage})`, backgroundColor: selected ? colors.bg : undefined }}
            type="button"
          >
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.22em] text-[var(--dim)]">{group.label}</p>
            <div className="mt-3 flex items-end justify-between gap-3">
              <p className="font-display text-4xl leading-none text-[var(--gold-l)]">{groupJobs.length}</p>
              <p className="text-right text-sm text-[var(--muted)]">{value > 0 ? currency(value) : "£0"}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
