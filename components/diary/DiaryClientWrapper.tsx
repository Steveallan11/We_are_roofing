"use client";

import { useState } from "react";
import { Button, PageSection } from "@/components/ui/primitives";
import { DiaryEntryForm } from "./DiaryEntryForm";
import { DiaryEntryList } from "./DiaryEntryList";
import { StickyNotesBoard } from "./StickyNotesBoard";
import { ReminderList } from "./ReminderList";
import { DIARY_TYPES, DIARY_TYPE_CONFIG, getDiaryLabel } from "./diaryConstants";
import type { DiaryEntryType } from "@/lib/types";

type ViewTab = "entries" | "board";

export function DiaryClientWrapper() {
  const [selectedType, setSelectedType] = useState<DiaryEntryType | null>(null);
  const [filterType, setFilterType] = useState<DiaryEntryType | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [view, setView] = useState<ViewTab>("entries");

  const handleEntryCreated = () => {
    setSelectedType(null);
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <div className="stack">
      {selectedType && (
        <DiaryEntryForm entryType={selectedType} onSuccess={handleEntryCreated} onCancel={() => setSelectedType(null)} />
      )}

      <PageSection kicker="Reminders" title="Your reminders" description="">
        <ReminderList />
      </PageSection>

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

      <div className="flex gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-1">
        <button
          onClick={() => setView("entries")}
          className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
            view === "entries"
              ? "bg-[var(--gold)] text-black"
              : "text-[var(--text-muted)] hover:text-[var(--text)]"
          }`}
        >
          📋 Entries
        </button>
        <button
          onClick={() => setView("board")}
          className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
            view === "board"
              ? "bg-[var(--gold)] text-black"
              : "text-[var(--text-muted)] hover:text-[var(--text)]"
          }`}
        >
          📌 Sticky board
        </button>
      </div>

      {view === "entries" ? (
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
      ) : (
        <PageSection
          kicker="Board"
          title="Sticky notes"
          description="Quick visual notes. Drag to rearrange, tap colour to change."
        >
          <StickyNotesBoard />
        </PageSection>
      )}
    </div>
  );
}
