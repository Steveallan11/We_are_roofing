"use client";

import { useState } from "react";
import { Button } from "@/components/ui/primitives";
import { JobPicker } from "./JobPicker";
import { VoiceRecorder } from "./VoiceRecorder";
import type { DiaryEntryType } from "@/lib/types";

type Props = {
  entryType: DiaryEntryType;
  onSuccess: () => void;
  onCancel: () => void;
};

export function DiaryEntryForm({ entryType, onSuccess, onCancel }: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [jobId, setJobId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [amount, setAmount] = useState("");
  const [voiceTranscript, setVoiceTranscript] = useState("");

  const handleTranscript = (transcript: string) => {
    setVoiceTranscript(transcript);
    if (!body) {
      setBody(transcript);
    } else {
      setBody((prev) => `${prev}\n${transcript}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const payload: Record<string, unknown> = {
        entry_type: entryType,
        title: title || null,
        body: body || null,
        linked_job_id: jobId || null,
        voice_transcript: voiceTranscript || null
      };

      if (entryType === "task" || entryType === "reminder") {
        payload.task_due_date = dueDate || null;
      }
      if (entryType === "expense") {
        payload.expense_amount = amount ? Number(amount) : null;
        payload.expense_category = "other";
      }
      if (entryType === "payment") {
        payload.payment_amount = amount ? Number(amount) : null;
      }

      const response = await fetch("/api/diary/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create entry");
      }

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
      <h3 className="font-semibold capitalize">{entryType.replace("_", " ")}</h3>

      {entryType === "voice_note" && <VoiceRecorder onTranscript={handleTranscript} />}

      {["voice_note", "text_note", "photo", "reminder"].includes(entryType) && (
        <div>
          <label className="block text-sm font-medium text-[var(--text)]">Title (optional)</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder='e.g. "Bedford project notes"'
            className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--ink)] px-3 py-2 text-sm text-[var(--text)] focus:border-[var(--gold)] focus:outline-none"
          />
        </div>
      )}

      {["text_note", "voice_note", "photo"].includes(entryType) && (
        <div>
          <label className="block text-sm font-medium text-[var(--text)]">Notes</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={entryType === "voice_note" ? "Transcript appears here. Edit if needed." : "What did you capture?"}
            rows={entryType === "voice_note" ? 5 : 3}
            className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--ink)] px-3 py-2 text-sm text-[var(--text)] focus:border-[var(--gold)] focus:outline-none"
          />
        </div>
      )}

      {["task", "reminder", "expense", "payment"].includes(entryType) && (
        <div>
          <label className="block text-sm font-medium text-[var(--text)]">Description</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="What is this for?"
            rows={2}
            className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--ink)] px-3 py-2 text-sm text-[var(--text)] focus:border-[var(--gold)] focus:outline-none"
          />
        </div>
      )}

      {["task", "reminder"].includes(entryType) && (
        <div>
          <label className="block text-sm font-medium text-[var(--text)]">Due date</label>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--ink)] px-3 py-2 text-sm text-[var(--text)] focus:border-[var(--gold)] focus:outline-none"
          />
        </div>
      )}

      {["expense", "payment"].includes(entryType) && (
        <div>
          <label className="block text-sm font-medium text-[var(--text)]">Amount (£)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--ink)] px-3 py-2 text-sm text-[var(--text)] focus:border-[var(--gold)] focus:outline-none"
          />
        </div>
      )}

      <JobPicker value={jobId} onChange={(id) => setJobId(id)} />

      {error && <div className="rounded bg-[#ef4444]/15 p-2 text-sm text-[#fca5a5]">{error}</div>}

      <div className="flex gap-2">
        <Button variant="primary" size="md" type="submit" disabled={isLoading}>
          {isLoading ? "Saving..." : "Save"}
        </Button>
        <Button variant="ghost" size="md" type="button" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
