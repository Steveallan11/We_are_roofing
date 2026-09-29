"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/primitives";
import { resolveQuotePricingMode } from "@/lib/quotes/pricingMode";
import { getOptionTotal } from "@/lib/quotes/value";
import { currency } from "@/lib/utils";
import type { CostLineItem, QuoteOption, QuotePricingMode } from "@/lib/types";

type Props = {
  quoteId: string;
  options?: QuoteOption[];
  costBreakdown?: CostLineItem[];
  pricingMode?: QuotePricingMode | null;
};

export function AcceptQuoteButton({ costBreakdown = [], pricingMode, quoteId, options = [] }: Props) {
  const mode = resolveQuotePricingMode(pricingMode, options.length);
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [optionId, setOptionId] = useState<string | null>(options.find((option) => option.recommended)?.id ?? options[0]?.id ?? null);
  const [selectedLineIndexes, setSelectedLineIndexes] = useState<number[]>([]);
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
    if (mode === "options" && !optionId) {
      setError("Choose which option the customer accepted.");
      return;
    }
    if (mode === "selectable_items" && !selectedLineIndexes.length) {
      setError("Choose the work items the customer accepted.");
      return;
    }
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/quotes/${quoteId}/manual-accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        option_id: mode === "options" ? optionId : null,
        selected_line_indexes: mode === "selectable_items" ? selectedLineIndexes : [],
        note: note.trim() || null
      })
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

      {mode === "options" ? (
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

      {mode === "selectable_items" ? (
        <div className="mt-3 space-y-2">
          {costBreakdown.map((line, index) => {
            if (Number(line.cost || 0) <= 0 || line.billed_separately) return null;
            const selected = selectedLineIndexes.includes(index);
            const gross = Number(line.cost || 0) * (line.vat_applicable ? 1.2 : 1);
            return (
              <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-[var(--border)] p-3 text-sm" key={`accept-line-${index}`}>
                <span className="flex items-center gap-2">
                  <input
                    checked={selected}
                    onChange={() => setSelectedLineIndexes((current) => current.includes(index) ? current.filter((item) => item !== index) : [...current, index])}
                    type="checkbox"
                  />
                  <span className="text-[var(--text)]">{line.item}</span>
                </span>
                <span className="font-semibold text-[var(--gold)]">{currency(gross)}</span>
              </label>
            );
          })}
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
