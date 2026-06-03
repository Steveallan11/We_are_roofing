"use client";

import { useState } from "react";
import { Button, PageSection } from "@/components/ui/primitives";
import { DiaryEntryForm } from "./DiaryEntryForm";
import { DiaryEntryList } from "./DiaryEntryList";
import type { DiaryEntryType } from "@/lib/types";

const QUICK_ACTIONS: Array<{ type: DiaryEntryType; label: string; icon: string; color: string; description: string }> = [
  { type: "voice_note", label: "Voice Note", icon: "🎤", color: "bg-[#3b82f6]", description: "Record yourself" },
  { type: "text_note", label: "Text Note", icon: "📝", color: "bg-[var(--gold)]", description: "Write a note" },
  { type: "photo", label: "Photo", icon: "📸", color: "bg-[#10b981]", description: "Capture receipt" },
  { type: "task", label: "Task", icon: "✓", color: "bg-[#f59e0b]", description: "Create a task" },
  { type: "reminder", label: "Reminder", icon: "⏰", color: "bg-[#ec4899]", description: "Set reminder" },
  { type: "expense", label: "Expense", icon: "💷", color: "bg-[#ef4444]", description: "Log expense" },
  { type: "payment", label: "Payment", icon: "💳", color: "bg-[#6366f1]", description: "Log payment" }
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
              className={`rounded-lg p-3 text-center transition-transform ${action.color} text-white hover:scale-105`}
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
