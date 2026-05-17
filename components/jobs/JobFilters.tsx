"use client";

import { PIPELINE_GROUPS, type PipelineGroupKey } from "@/lib/jobs/pipelineGroups";

type Props = {
  active: PipelineGroupKey | "all" | "attention";
  onSelect: (key: PipelineGroupKey | "all" | "attention") => void;
  attentionCount: number;
};

export function JobFilters({ active, onSelect, attentionCount }: Props) {
  const items: Array<{ key: PipelineGroupKey | "all" | "attention"; label: string }> = [
    { key: "all", label: "All Jobs" },
    ...PIPELINE_GROUPS.map((group) => ({ key: group.key, label: group.shortLabel })),
    { key: "attention", label: `Needs Attention (${attentionCount})` }
  ];

  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {items.map((item) => (
        <button
          className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition ${
            active === item.key ? "border-[var(--gold)] bg-[rgba(212,175,55,0.16)] text-[var(--gold-l)]" : "border-[var(--border)] bg-black/20 text-[var(--muted)]"
          }`}
          key={item.key}
          onClick={() => onSelect(item.key)}
          type="button"
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
