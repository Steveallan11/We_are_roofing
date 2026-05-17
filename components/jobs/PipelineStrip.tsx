"use client";

import { PIPELINE_GROUPS, type PipelineGroupKey } from "@/lib/jobs/pipelineGroups";
import { currency } from "@/lib/utils";
import type { JobForAction } from "@/lib/jobs/nextAction";

type Props = {
  jobs: JobForAction[];
  active: PipelineGroupKey | "all";
  onSelect: (key: PipelineGroupKey | "all") => void;
};

export function PipelineStrip({ jobs, active, onSelect }: Props) {
  return (
    <div className="grid gap-3 md:grid-cols-5">
      {PIPELINE_GROUPS.map((group) => {
        const groupJobs = jobs.filter((job) => group.statuses.includes(job.status));
        const value = groupJobs.reduce((sum, job) => sum + Number(job.estimated_value ?? 0), 0);
        const selected = active === group.key;
        return (
          <button
            className={`card min-h-[108px] p-4 text-left transition hover:-translate-y-0.5 ${selected ? "ring-2 ring-[var(--gold)]" : ""}`}
            key={group.key}
            onClick={() => onSelect(selected ? "all" : group.key)}
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
