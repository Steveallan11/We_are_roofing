"use client";

import { useState } from "react";
import { Button, PageSection } from "@/components/ui/primitives";
import { DiaryEntryForm } from "./DiaryEntryForm";
import { DiaryEntryList } from "./DiaryEntryList";
import type { DiaryEntryType } from "@/lib/types";

const QUICK_ACTIONS: Array<{ type: DiaryEntryType; label: string; icon: string; bgColor: string; description: string }> = [
  { type: "voice_note", label: "Voice Note", icon: "🎤", bgColor: "#3b82f6", description: "Record yourself" },
  { type: "text_note", label: "Text Note", icon: "📝", bgColor: "var(--gold)", description: "Write a note" },
  { type: "photo", label: "Photo", icon: "📸", bgColor: "#10b981", description: "Capture receipt" },
  { type: "task", label: "Task", icon: "✓", bgColor: "#f59e0b", description: "Create a task" },
  { type: "reminder", label: "Reminder", icon: "⏰", bgColor: "#ec4899", description: "Set reminder" },
  { type: "expense", label: "Expense", icon: "💷", bgColor: "#ef4444", description: "Log expense" },
  { type: "payment", label: "Payment", icon: "💳", bgColor: "#6366f1", description: "Log payment" }
];

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
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action.type}
              onClick={() => setSelectedType(action.type)}
              className="rounded-lg p-3 text-center transition-transform hover:scale-105 cursor-pointer text-white font-medium active:opacity-80"
              style={{ backgroundColor: action.bgColor }}
            >
              <div className="text-3xl">{action.icon}</div>
              <p className="mt-2 text-sm font-semibold">{action.label}</p>
              <p className="text-[10px] opacity-90">{action.description}</p>
            </button>
          ))}
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
          {[null, "voice_note", "text_note", "photo", "task", "reminder", "expense", "payment"].map((type) => (
            <button
              key={type || "all"}
              onClick={() => setFilterType(type as DiaryEntryType | null)}
              className={`rounded-full px-3 py-1 text-sm transition-colors ${
                filterType === type
                  ? "bg-[var(--gold)] text-black"
                  : "border border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--gold)]"
              }`}
            >
              {type ? type.replace("_", " ") : "All"}
            </button>
          ))}
        </div>
        <DiaryEntryList entryType={filterType} key={refreshTrigger} />
      </PageSection>
    </div>
  );
}
