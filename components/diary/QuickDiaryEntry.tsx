"use client";

import { useState } from "react";
import { Button } from "@/components/ui/primitives";
import { VoiceRecorder } from "./VoiceRecorder";
import { MediaEditor } from "./MediaEditor";
import type { DiaryEntryType } from "@/lib/types";

type EntryMode = "picker" | "voice" | "photo" | "text" | "task";

type Props = {
  jobId: string;
  onSuccess: () => void;
};

export function QuickDiaryEntry({ jobId, onSuccess }: Props) {
  const [mode, setMode] = useState<EntryMode>("picker");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [text, setText] = useState("");
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [photos, setPhotos] = useState<Array<{ url: string; caption?: string }>>([]);
  const [taskText, setTaskText] = useState("");
  const [taskDueDate, setTaskDueDate] = useState("");

  const handleMediaAdded = (url: string, caption?: string) => {
    setPhotos((prev) => [...prev, { url, caption }]);
  };

  const handleSubmit = async (entryType: DiaryEntryType) => {
    setIsLoading(true);
    setError(null);

    try {
      let body = "";
      if (entryType === "voice_note" && voiceTranscript) body = voiceTranscript;
      if (entryType === "text_note") body = text;
      if (entryType === "task") body = taskText;

      const payload: Record<string, unknown> = {
        entry_type: entryType,
        body: body || null,
        linked_job_id: jobId,
        photos: photos.length > 0 ? photos : []
      };

      if (entryType === "task" && taskDueDate) {
        payload.task_due_date = taskDueDate;
      }

      const response = await fetch("/api/diary/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save");
      }

      reset();
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const reset = () => {
    setMode("picker");
    setText("");
    setVoiceTranscript("");
    setPhotos([]);
    setTaskText("");
    setTaskDueDate("");
  };

  if (mode === "picker") {
    return (
      <div className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
        <p className="text-xs font-medium text-[var(--text-muted)]">Quick log</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <button
            onClick={() => setMode("voice")}
            className="flex flex-col items-center gap-1 rounded-lg border border-[var(--border)] p-2 text-center hover:bg-[var(--ink)]"
          >
            <span className="text-xl">🎤</span>
            <span className="text-[10px] font-medium text-[var(--text)]">Voice</span>
          </button>
          <button
            onClick={() => setMode("photo")}
            className="flex flex-col items-center gap-1 rounded-lg border border-[var(--border)] p-2 text-center hover:bg-[var(--ink)]"
          >
            <span className="text-xl">📷</span>
            <span className="text-[10px] font-medium text-[var(--text)]">Photo</span>
          </button>
          <button
            onClick={() => setMode("text")}
            className="flex flex-col items-center gap-1 rounded-lg border border-[var(--border)] p-2 text-center hover:bg-[var(--ink)]"
          >
            <span className="text-xl">📝</span>
            <span className="text-[10px] font-medium text-[var(--text)]">Note</span>
          </button>
          <button
            onClick={() => setMode("task")}
            className="flex flex-col items-center gap-1 rounded-lg border border-[var(--border)] p-2 text-center hover:bg-[var(--ink)]"
          >
            <span className="text-xl">✓</span>
            <span className="text-[10px] font-medium text-[var(--text)]">Task</span>
          </button>
        </div>
      </div>
    );
  }

  if (mode === "voice") {
    return (
      <div className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
        <VoiceRecorder onTranscript={setVoiceTranscript} />
        {error && <p className="text-xs text-[#fca5a5]">{error}</p>}
        <div className="flex gap-2">
          <Button
            variant="primary"
            size="sm"
            onClick={() => handleSubmit("voice_note")}
            disabled={isLoading || !voiceTranscript}
          >
            {isLoading ? "Saving…" : "Save"}
          </Button>
          <Button variant="ghost" size="sm" onClick={reset}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  if (mode === "photo") {
    return (
      <div className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-[var(--text)]">Photos & video</p>
          <button
            type="button"
            onClick={() => setMode("picker")}
            className="text-xs text-[var(--gold)] hover:text-[#fbbf24]"
          >
            + Add more
          </button>
        </div>
        <MediaEditor onMediaAdded={handleMediaAdded} onClose={() => {}} />
        {photos.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {photos.map((photo, idx) => (
              <div key={idx} className="relative overflow-hidden rounded-lg bg-[var(--ink)]">
                <img src={photo.url} alt="Media" className="h-20 w-full object-cover" />
                <button
                  onClick={() => setPhotos((prev) => prev.filter((_, i) => i !== idx))}
                  className="absolute right-1 top-1 rounded-full bg-[#ef4444]/80 text-[10px] text-white hover:bg-[#ef4444]"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add notes about photos (optional)"
          rows={2}
          className="mt-2 w-full rounded border border-[var(--border)] bg-[var(--ink)] px-2 py-1 text-sm text-[var(--text)]"
        />
        {error && <p className="text-xs text-[#fca5a5]">{error}</p>}
        <div className="flex gap-2">
          <Button
            variant="primary"
            size="sm"
            onClick={() => handleSubmit("photo")}
            disabled={isLoading || photos.length === 0}
          >
            {isLoading ? "Saving…" : "Save"}
          </Button>
          <Button variant="ghost" size="sm" onClick={reset}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  if (mode === "text") {
    return (
      <div className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="What happened?"
          rows={3}
          autoFocus
          className="w-full rounded border border-[var(--border)] bg-[var(--ink)] px-2 py-1 text-sm text-[var(--text)]"
        />
        {error && <p className="text-xs text-[#fca5a5]">{error}</p>}
        <div className="flex gap-2">
          <Button
            variant="primary"
            size="sm"
            onClick={() => handleSubmit("text_note")}
            disabled={isLoading || !text.trim()}
          >
            {isLoading ? "Saving…" : "Save"}
          </Button>
          <Button variant="ghost" size="sm" onClick={reset}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  if (mode === "task") {
    return (
      <div className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
        <textarea
          value={taskText}
          onChange={(e) => setTaskText(e.target.value)}
          placeholder="Task: e.g. 'Call customer', 'Order lead', 'Send quote', 'Return to fix gutter'"
          rows={2}
          autoFocus
          className="w-full rounded border border-[var(--border)] bg-[var(--ink)] px-2 py-1 text-sm text-[var(--text)]"
        />
        <div>
          <label className="block text-xs font-medium text-[var(--text-muted)]">Due date (optional)</label>
          <input
            type="date"
            value={taskDueDate}
            onChange={(e) => setTaskDueDate(e.target.value)}
            className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--ink)] px-2 py-1 text-sm text-[var(--text)]"
          />
        </div>
        {error && <p className="text-xs text-[#fca5a5]">{error}</p>}
        <div className="flex gap-2">
          <Button
            variant="primary"
            size="sm"
            onClick={() => handleSubmit("task")}
            disabled={isLoading || !taskText.trim()}
          >
            {isLoading ? "Saving…" : "Save"}
          </Button>
          <Button variant="ghost" size="sm" onClick={reset}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
