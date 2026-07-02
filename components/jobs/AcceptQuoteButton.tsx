"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/primitives";
import { getOptionTotal } from "@/lib/quotes/value";
import { currency } from "@/lib/utils";
import type { QuoteOption } from "@/lib/types";

type Props = {
  quoteId: string;
  options?: QuoteOption[];
};

export function AcceptQuoteButton({ quoteId, options = [] }: Props) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [optionId, setOptionId] = useState<string | null>(options.find((option) => option.recommended)?.id ?? options[0]?.id ?? null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [, startTransition] = useTransition();

  if (done) {
    return <p className="text-sm text-[#7ce3a6]">Quote marked accepted. Job moved to Accepted.</p>;
  }

  if (!expanded) {
    return (
      <Button variant="primary" size="md" onClick={() => setExpanded(true)}>
        Mark Accepted (Customer Confirmed)
      </Button>
    );
  }

  async function confirm() {
    if (options.length > 0 && !optionId) {
      setError("Choose which option the customer accepted.");
      return;
    }
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/quotes/${quoteId}/manual-accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ option_id: optionId, note: note.trim() || null })
    });
    const result = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
    setBusy(false);
    if (!response.ok || !result?.ok) {
      setError(result?.error || "Quote could not be marked accepted.");
      return;
    }
    setDone(true);
    startTransition(() => router.refresh());
  }

  return (
    <div className="rounded-2xl border border-[var(--border)] p-4">
      <p className="text-sm font-semibold text-[var(--text)]">Confirm verbal acceptance</p>
      <p className="mt-1 text-xs text-[var(--text-muted)]">
        Use this when the customer has confirmed they want to go ahead — by phone, in person, or any way other than clicking accept on the
        quote link. This moves the job to Accepted the same way a customer's own acceptance does.
      </p>

      {options.length > 0 ? (
        <div className="mt-3 space-y-2">
          {options.map((option) => (
            <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-[var(--border)] p-3 text-sm" key={option.id}>
              <span className="flex items-center gap-2">
                <input checked={optionId === option.id} name="accept-option" onChange={() => setOptionId(option.id)} type="radio" />
                <span className="text-[var(--text)]">{option.label}</span>
              </span>
              <span className="font-semibold text-[var(--gold)]">{currency(getOptionTotal(option) ?? 0)}</span>
            </label>
          ))}
        </div>
      ) : null}

      <label className="mt-3 block">
        <span className="label">Note (optional)</span>
        <input
          className="field min-h-11"
          onChange={(event) => setNote(event.target.value)}
          placeholder="e.g. confirmed by phone, 2 Jul"
          type="text"
          value={note}
        />
      </label>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button disabled={busy} onClick={confirm} size="md" variant="primary">
          {busy ? "Saving..." : "Confirm Accepted"}
        </Button>
        <Button disabled={busy} onClick={() => setExpanded(false)} size="md" variant="ghost">
          Cancel
        </Button>
      </div>
      {error ? <p className="mt-2 text-sm text-[#ff9a91]">{error}</p> : null}
    </div>
  );
}
