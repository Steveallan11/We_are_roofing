"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/primitives";
import { JOB_STATUSES } from "@/lib/constants";
import type { JobStatus } from "@/lib/types";

type Props = {
  jobId: string;
  status: JobStatus;
  compact?: boolean;
  onUpdated?: (status: JobStatus) => void;
};

const ACTIVE_STATUSES = JOB_STATUSES.filter((status) => !["Completed", "Not Proceeding", "Lost", "Archived"].includes(status));

export function JobStatusMenu({ jobId, status, compact = false, onUpdated }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function updateStatus(nextStatus: JobStatus) {
    if (nextStatus === status || saving) return;
    setSaving(true);
    const response = await fetch("/api/jobs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ job_id: jobId, status: nextStatus })
    });
    const result = (await response.json().catch(() => null)) as { error?: string } | null;
    setSaving(false);
    if (!response.ok) {
      window.alert(result?.error || "Could not move this job. Please try again.");
      return;
    }
    onUpdated?.(nextStatus);
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={compact ? "button-ghost !min-h-9 !px-3 !py-1.5 text-xs" : "button-secondary !min-h-11 !px-4 !py-2 text-sm"}
          disabled={saving}
          onClick={(event) => event.stopPropagation()}
          type="button"
        >
          {saving ? "Moving..." : "Move job"}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-[70vh] overflow-y-auto">
        <DropdownMenuLabel>Move to pipeline stage</DropdownMenuLabel>
        {ACTIVE_STATUSES.map((nextStatus) => (
          <DropdownMenuItem disabled={nextStatus === status} key={nextStatus} onSelect={() => void updateStatus(nextStatus)}>
            {nextStatus === status ? `✓ ${nextStatus}` : nextStatus}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={status === "Completed"} onSelect={() => void updateStatus("Completed")}>Mark completed</DropdownMenuItem>
        <DropdownMenuItem disabled={status === "Not Proceeding"} onSelect={() => void updateStatus("Not Proceeding")}>Not proceeding</DropdownMenuItem>
        <DropdownMenuItem disabled={status === "Lost"} onSelect={() => void updateStatus("Lost")}>Mark lost</DropdownMenuItem>
        <DropdownMenuSeparator />
        {status === "Archived" ? (
          <DropdownMenuItem onSelect={() => void updateStatus("New Lead")}>Restore to new leads</DropdownMenuItem>
        ) : (
          <DropdownMenuItem destructive onSelect={() => void updateStatus("Archived")}>Archive job</DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
