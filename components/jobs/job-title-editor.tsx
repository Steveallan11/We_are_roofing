"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Props = {
  jobId: string;
  jobRef?: string | null;
  title: string;
};

export function JobTitleEditor({ jobId, jobRef, title }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(title);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function saveTitle() {
    const nextTitle = value.trim();
    if (!nextTitle) {
      setError("Job title is required.");
      return;
    }

    setError(null);
    const response = await fetch(`/api/jobs/${jobId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ job_title: nextTitle })
    });

    const payload = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
    if (!response.ok || !payload?.ok) {
      setError(payload?.error || "Unable to update job title.");
      return;
    }

    setEditing(false);
    startTransition(() => {
      router.refresh();
    });
  }

  function cancelEdit() {
    setValue(title);
    setError(null);
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="rounded-2xl border border-[var(--gold)]/40 bg-[var(--gold)]/10 p-3">
        <label className="label" htmlFor="job-title-editor">
          Job title
        </label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input
            autoFocus
            className="field min-h-11 flex-1"
            id="job-title-editor"
            maxLength={160}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void saveTitle();
              if (event.key === "Escape") cancelEdit();
            }}
            value={value}
          />
          <button className="button-primary min-h-11 !px-4 !py-2 text-sm" disabled={isPending} onClick={saveTitle} type="button">
            {isPending ? "Saving..." : "Save"}
          </button>
          <button className="button-ghost min-h-11 !px-4 !py-2 text-sm" onClick={cancelEdit} type="button">
            Cancel
          </button>
        </div>
        {error ? <p className="mt-2 text-xs text-[#ff9a91]">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-black/20 p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="section-kicker text-[0.58rem] uppercase">{jobRef ?? "Job title"}</p>
          <h2 className="mt-2 font-condensed text-3xl leading-none text-white">{title}</h2>
        </div>
        <button className="button-ghost min-h-11 !px-4 !py-2 text-sm" onClick={() => setEditing(true)} type="button">
          Edit Title
        </button>
      </div>
      {error ? <p className="mt-2 text-xs text-[#ff9a91]">{error}</p> : null}
    </div>
  );
}
