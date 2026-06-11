"use client";

import { useEffect, useState } from "react";
import { getDiaryIcon, getDiaryColor } from "./diaryConstants";
import type { DiaryEntry } from "@/lib/types";

type Props = {
  jobId: string;
};

export function JobDiaryTimeline({ jobId }: Props) {
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    fetch(`/api/diary/entries?job_id=${jobId}&limit=100`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data?.ok) {
          setEntries((data.entries ?? []) as DiaryEntry[]);
        } else {
          setError(data?.error || "Unable to load entries");
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Error loading entries");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [jobId]);

  if (isLoading) {
    return <p className="text-sm text-[var(--text-muted)]">Loading entries…</p>;
  }

  if (error) {
    return <p className="text-sm text-[#fca5a5]">{error}</p>;
  }

  if (entries.length === 0) {
    return <p className="text-sm text-[var(--text-muted)]">No diary entries yet. Quick log something!</p>;
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
        <div className="flex gap-2 flex-1">
          <span className="text-lg" style={{ color }}>
            {icon}
          </span>
          <div className="min-w-0 flex-1">
            {entry.title && <p className="font-semibold text-[var(--text)]">{entry.title}</p>}
            {entry.body && <p className="mt-1 text-sm text-[var(--text-muted)]">{entry.body}</p>}
            {entry.photos && entry.photos.length > 0 && (
              <div className="mt-2 flex gap-1">
                {entry.photos.slice(0, 3).map((photo, idx) => (
                  <img
                    key={idx}
                    src={photo.url}
                    alt={photo.caption || "Photo"}
                    className="h-10 w-10 rounded object-cover"
                  />
                ))}
                {entry.photos.length > 3 && (
                  <div className="flex h-10 w-10 items-center justify-center rounded bg-[var(--ink)] text-[10px] font-medium text-[var(--text-muted)]">
                    +{entry.photos.length - 3}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        <span className="shrink-0 text-xs text-[var(--text-muted)]">{date}</span>
      </div>
    </div>
  );
}
