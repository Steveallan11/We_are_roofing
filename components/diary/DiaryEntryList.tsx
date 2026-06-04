"use client";

import { useEffect, useState } from "react";
import { getDiaryColor, getDiaryIcon } from "./diaryConstants";
import type { DiaryEntry, DiaryEntryType } from "@/lib/types";

type Props = {
  entryType?: DiaryEntryType | null;
  refreshTrigger?: number;
};

export function DiaryEntryList({ entryType, refreshTrigger }: Props) {
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    const params = new URLSearchParams();
    params.set("limit", "50");
    if (entryType) params.set("entry_type", entryType);

    fetch(`/api/diary/entries?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (!data?.ok) {
          setError(data?.error || "Unable to load entries");
          setEntries([]);
        } else {
          setEntries((data.entries ?? []) as DiaryEntry[]);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Unable to load entries");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [entryType, refreshTrigger]);

  if (isLoading) {
    return <p className="text-sm text-[var(--text-muted)]">Loading entries…</p>;
  }

  if (error) {
    return <p className="text-sm text-[#fca5a5]">{error}</p>;
  }

  if (entries.length === 0) {
    return <p className="text-sm text-[var(--text-muted)]">No {entryType ? entryType.replace("_", " ") : ""} entries yet.</p>;
  }

  return (
    <div className="space-y-2">
      {entries.map((entry) => (
        <DiaryEntryCard key={entry.id} entry={entry} />
      ))}
    </div>
  );
}

function DiaryEntryCard({ entry }: { entry: DiaryEntry }) {
  const date = new Date(entry.created_at).toLocaleString("en-GB", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });

  const icon = getDiaryIcon(entry.entry_type);
  const color = getDiaryColor(entry.entry_type);

  return (
    <div
      className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3"
      style={{ borderLeft: `3px solid ${color}` }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex gap-2">
          <span className="text-xl" style={{ color }}>
            {icon}
          </span>
          <div className="min-w-0">
            {entry.title && <p className="font-semibold text-[var(--text)]">{entry.title}</p>}
            {entry.body && <p className="mt-1 text-sm text-[var(--text-muted)] line-clamp-2">{entry.body}</p>}
            {entry.entry_type === "task" && entry.task_due_date && (
              <p className="mt-1 text-xs" style={{ color }}>
                Due: {new Date(entry.task_due_date).toLocaleDateString("en-GB")}
              </p>
            )}
            {entry.entry_type === "expense" && entry.expense_amount ? (
              <p className="mt-1 text-xs font-medium" style={{ color }}>
                £{entry.expense_amount.toFixed(2)}
              </p>
            ) : null}
            {entry.entry_type === "payment" && entry.payment_amount && entry.payment_to_name ? (
              <p className="mt-1 text-xs font-medium" style={{ color }}>
                £{entry.payment_amount.toFixed(2)} to {entry.payment_to_name}
              </p>
            ) : entry.entry_type === "payment" && entry.payment_amount ? (
              <p className="mt-1 text-xs font-medium" style={{ color }}>
                £{entry.payment_amount.toFixed(2)}
              </p>
            ) : null}
          </div>
        </div>
        <span className="shrink-0 text-xs text-[var(--text-muted)]">{date}</span>
      </div>
    </div>
  );
}
