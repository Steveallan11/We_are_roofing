"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function CompleteTodayTaskButton({ taskId }: { taskId: string }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function completeTask() {
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/diary/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: taskId })
      });
      const result = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !result.ok) throw new Error(result.error ?? "Could not complete task.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not complete task.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <span className="flex shrink-0 flex-col items-end gap-1">
      <button
        className="priority-row__action rounded-md px-2 py-1 hover:bg-[var(--surface-hover)] disabled:opacity-50"
        type="button"
        disabled={saving}
        onClick={completeTask}
        aria-label="Mark task complete"
      >
        {saving ? "Saving…" : "Done"}
      </button>
      {error ? <span className="max-w-36 text-right text-xs text-red-600" role="alert">{error}</span> : null}
    </span>
  );
}
