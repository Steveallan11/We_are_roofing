"use client";

import { useState } from "react";
import { Button, PageSection } from "@/components/ui/primitives";
import { DiaryEntryForm } from "./DiaryEntryForm";
import { DiaryEntryList } from "./DiaryEntryList";
import { DIARY_TYPES, DIARY_TYPE_CONFIG, getDiaryLabel } from "./diaryConstants";
import type { DiaryEntryType } from "@/lib/types";

export function DiaryClientWrapper() {
  const [selectedType, setSelectedType] = useState<DiaryEntryType | null>(null);
  const [filterType, setFilterType] = useState<DiaryEntryType | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleEntryCreated = () => {
    setSelectedType(null);
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <div className="stack">
      {selectedType && (
        <DiaryEntryForm entryType={selectedType} onSuccess={handleEntryCreated} onCancel={() => setSelectedType(null)} />
      )}

      <PageSection kicker="Quick actions" title="What do you want to capture?" description="">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {DIARY_TYPES.map((type) => {
            const config = DIARY_TYPE_CONFIG[type];
            return (
              <button
                key={type}
                onClick={() => setSelectedType(type)}
                className="rounded-lg p-3 text-center transition-transform hover:scale-105 cursor-pointer text-white font-medium active:opacity-80"
                style={{ backgroundColor: config.color }}
              >
                <div className="text-3xl">{config.icon}</div>
                <p className="mt-2 text-sm font-semibold">{config.label}</p>
                <p className="text-[10px] opacity-90">{config.description}</p>
              </button>
            );
          })}
        </div>
      </PageSection>

      <PageSection
        kicker="Recent"
        title="Diary entries"
        description="All captured moments, linked to jobs and customers."
        actions={
          filterType ? (
            <Button variant="ghost" size="sm" onClick={() => setFilterType(null)}>
              Clear filter
            </Button>
          ) : null
        }
      >
        <div className="mb-3 flex flex-wrap gap-2">
          <button
            onClick={() => setFilterType(null)}
            className={`rounded-full px-3 py-1 text-sm transition-colors ${
              filterType === null
                ? "bg-[var(--gold)] text-black"
                : "border border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--gold)]"
            }`}
          >
            All
          </button>
          {DIARY_TYPES.map((type) => {
            const isActive = filterType === type;
            const config = DIARY_TYPE_CONFIG[type];
            return (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className="rounded-full px-3 py-1 text-sm transition-colors"
                style={
                  isActive
                    ? { backgroundColor: config.color, color: "#fff", borderColor: config.color }
                    : { borderWidth: 1, borderColor: "var(--border)", color: "var(--text-muted)" }
                }
              >
                {getDiaryLabel(type)}
              </button>
            );
          })}
        </div>
        <DiaryEntryList entryType={filterType} refreshTrigger={refreshTrigger} />
      </PageSection>
    </div>
  );
}
