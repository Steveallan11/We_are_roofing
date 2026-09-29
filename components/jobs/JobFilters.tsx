"use client";

import { PIPELINE_GROUPS } from "@/lib/jobs/pipelineGroups";
import type { WorkspaceFilter } from "@/components/jobs/jobs-workspace";

type Props = {
  active: WorkspaceFilter;
  onSelect: (key: WorkspaceFilter) => void;
  attentionCount: number;
  staleCount: number;
  archivedCount: number;
};

export function JobFilters({ active, onSelect, attentionCount, staleCount, archivedCount }: Props) {
  const items: Array<{ key: WorkspaceFilter; label: string }> = [
    { key: "all", label: "All" },
    ...PIPELINE_GROUPS.map((group) => ({ key: group.key, label: group.shortLabel })),
    { key: "attention", label: `Attention ${attentionCount}` },
    { key: "stale", label: `Quiet 45+ days ${staleCount}` },
    { key: "archived", label: `Archived ${archivedCount}` }
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
