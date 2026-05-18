"use client";

import Link from "next/link";
import type { Route } from "next";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { CostLineItem, QuoteOption, QuoteRecord } from "@/lib/types";
import { applyRateCardToCostBreakdown, findRateForItem, type RateCardEntry } from "@/lib/pricing/rateCard";
import { currency } from "@/lib/utils";

type Props = {
  jobId: string;
  quote: QuoteRecord | null;
  rateCard?: RateCardEntry[];
};

export function QuoteEditor({ jobId, quote, rateCard = [] }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [roofReport, setRoofReport] = useState(quote?.roof_report ?? "");
  const [scopeOfWorks, setScopeOfWorks] = useState(quote?.scope_of_works ?? "");
  const [guaranteeText, setGuaranteeText] = useState(quote?.guarantee_text ?? "");
  const [exclusions, setExclusions] = useState(quote?.exclusions ?? "");
  const [terms, setTerms] = useState(quote?.terms ?? "");
  const [emailSubject, setEmailSubject] = useState(quote?.customer_email_subject ?? "");
  const [emailBody, setEmailBody] = useState(quote?.customer_email_body ?? "");
  const [confidence, setConfidence] = useState<QuoteRecord["confidence"]>(quote?.confidence ?? "Medium");
  const [pricingNotes, setPricingNotes] = useState((quote?.pricing_notes ?? []).join("\n"));
  const [missingInfo, setMissingInfo] = useState((quote?.missing_info ?? []).join("\n"));
  const [costBreakdown, setCostBreakdown] = useState<CostLineItem[]>(() => {
    const initial = quote?.cost_breakdown?.length
      ? quote.cost_breakdown
      : [{ item: "Main works", cost: 0, vat_applicable: true, notes: "Draft pricing line item" }];
    return rateCard.length ? applyRateCardToCostBreakdown(initial, rateCard).updated : initial;
  });
  const [options, setOptions] = useState<QuoteOption[]>(() => quote?.options ?? []);
  const [messages, setMessages] = useState<Array<{ id: string; sender_type: string; sender_name?: string | null; message: string; created_at?: string }>>([]);
  const [reply, setReply] = useState("");

  useEffect(() => {
    if (!quote?.id) return;
    let active = true;
    fetch(`/api/quotes/${quote.id}/message`)
      .then((response) => response.json())
      .then((result) => {
        if (active && result?.ok) setMessages(result.messages ?? []);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [quote?.id]);

  const totals = useMemo(() => {
    const subtotal = Math.round(costBreakdown.reduce((sum, item) => sum + Number(item.cost || 0), 0) * 100) / 100;
    const vat = Math.round(costBreakdown.filter((item) => item.vat_applicable).reduce((sum, item) => sum + Number(item.cost || 0) * 0.2, 0) * 100) / 100;
    return { subtotal, vat, total: subtotal + vat };
  }, [costBreakdown]);
  const unpricedLines = useMemo(
    () => costBreakdown.filter((line) => Number(line.cost || 0) === 0 && !findRateForItem(line.item, rateCard)),
    [costBreakdown, rateCard]
  );

  if (!quote) {
    return (
      <div className="card p-5">
        <p className="text-sm text-[var(--muted)]">Generate the first quote draft from this job before review editing becomes available.</p>
      </div>
    );
  }

  const quoteId = quote.id;

  function updateLine(index: number, updates: Partial<CostLineItem>) {
    setCostBreakdown((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...updates } : item)));
  }

  function calculateOption(lines: CostLineItem[]) {
    const subtotal = Math.round(lines.reduce((sum, item) => sum + Number(item.cost || 0), 0) * 100) / 100;
    const vatAmount =
      Math.round(lines.filter((item) => item.vat_applicable).reduce((sum, item) => sum + Number(item.cost || 0) * 0.2, 0) * 100) / 100;
    return { subtotal, vat_amount: vatAmount, total: subtotal + vatAmount };
  }

  function makeOption(id: string, label: string, recommended: boolean, lines = costBreakdown): QuoteOption {
    const pricedLines = lines.map((line) => ({ ...line, cost: Number(line.cost || 0) }));
    return {
      id,
      label,
      description: recommended ? "Recommended specification based on the current survey and quote draft." : "Alternative specification for comparison.",
      cost_breakdown: pricedLines,
      recommended,
      ...calculateOption(pricedLines)
    };
  }

  function addOption() {
    setOptions((current) => {
      if (current.length === 0) {
        return [makeOption("option_a", "Option A - Standard", true), makeOption("option_b", "Option B - Alternative", false)];
      }
      const nextLetter = String.fromCharCode(65 + current.length);
      return [...current, makeOption(`option_${nextLetter.toLowerCase()}`, `Option ${nextLetter} - Alternative`, false)];
    });
  }

  function updateOption(optionId: string, updates: Partial<QuoteOption>) {
    setOptions((current) =>
      current.map((option) => {
        if (option.id !== optionId) return updates.recommended ? { ...option, recommended: false } : option;
        const next = { ...option, ...updates };
        const totals = calculateOption(next.cost_breakdown);
        return { ...next, ...totals };
      })
    );
  }

  function updateOptionLine(optionId: string, index: number, updates: Partial<CostLineItem>) {
    setOptions((current) =>
      current.map((option) => {
        if (option.id !== optionId) return option;
        const cost_breakdown = option.cost_breakdown.map((line, lineIndex) => (lineIndex === index ? { ...line, ...updates } : line));
        return { ...option, cost_breakdown, ...calculateOption(cost_breakdown) };
      })
    );
  }

  function addOptionLine(optionId: string) {
    setOptions((current) =>
      current.map((option) => {
        if (option.id !== optionId) return option;
        const cost_breakdown = [...option.cost_breakdown, { item: "Additional works", cost: 0, vat_applicable: true, notes: "" }];
        return { ...option, cost_breakdown, ...calculateOption(cost_breakdown) };
      })
    );
  }

  function deleteOptionLine(optionId: string, index: number) {
    setOptions((current) =>
      current.map((option) => {
        if (option.id !== optionId) return option;
        const cost_breakdown = option.cost_breakdown.filter((_, lineIndex) => lineIndex !== index);
        return { ...option, cost_breakdown, ...calculateOption(cost_breakdown) };
      })
    );
  }

  function applyRates() {
    const { updated, pricingNotes: newNotes } = applyRateCardToCostBreakdown(costBreakdown, rateCard);
    setCostBreakdown(updated);
    if (newNotes.length) {
      setPricingNotes((current) => [current, ...newNotes].filter(Boolean).join("\n"));
      setSuccess("Rate Card pricing applied. Save changes to keep the new totals.");
      setError(null);
      return;
    }
    setError("No matching Rate Card items found for the remaining £0 lines.");
    setSuccess(null);
  }

  async function saveQuote() {
    setError(null);
    setSuccess(null);
    const response = await fetch(`/api/quotes/${quoteId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roof_report: roofReport,
        scope_of_works: scopeOfWorks,
        cost_breakdown: costBreakdown.map((item) => ({ ...item, cost: Number(item.cost || 0) })),
        guarantee_text: guaranteeText,
        exclusions,
        terms,
        customer_email_subject: emailSubject,
        customer_email_body: emailBody,
        confidence,
        pricing_notes: pricingNotes
          .split("\n")
          .map((item) => item.trim())
          .filter(Boolean),
        missing_info: missingInfo
          .split("\n")
          .map((item) => item.trim())
          .filter(Boolean),
        options
      })
    });

    const result = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
    if (!response.ok || !result?.ok) {
      setError(result?.error || "Unable to save quote changes.");
      return;
    }

    setSuccess("Quote changes saved.");
    startTransition(() => router.refresh());
  }

  async function generatePdf() {
    setError(null);
    setSuccess(null);
    const response = await fetch(`/api/quotes/${quoteId}/pdf`, { method: "POST" });
    const result = (await response.json().catch(() => null)) as { ok?: boolean; error?: string; message?: string } | null;
    if (!response.ok || !result?.ok) {
      setError(result?.error || "Unable to generate the quote PDF.");
      return;
    }
    setSuccess(result.message || "Quote PDF generated.");
    startTransition(() => router.refresh());
  }

  async function sendReply() {
    if (!reply.trim()) return;
    const response = await fetch(`/api/quotes/${quoteId}/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sender_type: "admin", sender_name: "Andy", message: reply })
    });
    const result = (await response.json().catch(() => null)) as { ok?: boolean; message?: (typeof messages)[number]; error?: string } | null;
    if (!response.ok || !result?.ok) {
      setError(result?.error || "Reply could not be sent.");
      return;
    }
    if (result.message) setMessages((current) => [...current, result.message as (typeof messages)[number]]);
    setReply("");
  }

  return (
    <div className="stack">
      <div className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="section-kicker text-[0.65rem] uppercase">Editable Draft</p>
            <p className="mt-2 text-sm text-[var(--muted)]">Adjust wording, totals, and customer email content before approval.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            {rateCard.length ? (
              <button className="button-ghost" disabled={isPending} onClick={applyRates} type="button">
                Apply Rate Card
              </button>
            ) : null}
            <button className="button-secondary" disabled={isPending} onClick={generatePdf} type="button">
              Generate PDF
            </button>
            <button className="button-primary" disabled={isPending} onClick={saveQuote} type="button">
              {isPending ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </div>

      <div className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="section-kicker text-[0.65rem] uppercase">Quote Options</p>
            <p className="mt-2 text-sm text-[var(--muted)]">Create Option A/B/C comparisons before the customer accepts a route.</p>
          </div>
          <button className="button-ghost" onClick={addOption} type="button">
            {options.length ? "Add Option" : "Create Option A/B"}
          </button>
        </div>
        {options.length > 0 ? (
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {options.map((option) => (
              <div
                className="rounded-2xl border p-4"
                key={option.id}
                style={{ borderColor: option.recommended ? "var(--gold)" : "var(--border)", background: "var(--surface-deep)" }}
              >
                {option.recommended ? <p className="section-kicker text-[0.65rem] uppercase text-[var(--gold)]">Recommended</p> : null}
                <label className="mt-3 block">
                  <span className="label">Option label</span>
                  <input className="field" onChange={(event) => updateOption(option.id, { label: event.target.value })} value={option.label} />
                </label>
                <label className="mt-3 block">
                  <span className="label">Customer description</span>
                  <textarea className="field min-h-20" onChange={(event) => updateOption(option.id, { description: event.target.value })} value={option.description} />
                </label>
                <div className="mt-4 space-y-3">
                  {option.cost_breakdown.map((line, index) => (
                    <div className="rounded-xl border border-[var(--border)] p-3" key={`${option.id}-${line.item}-${index}`}>
                      <div className="grid gap-3 md:grid-cols-[1fr_120px_92px_80px]">
                        <label className="block">
                          <span className="label">Item</span>
                          <input className="field" onChange={(event) => updateOptionLine(option.id, index, { item: event.target.value })} value={line.item} />
                        </label>
                        <label className="block">
                          <span className="label">Price</span>
                          <input className="field" inputMode="decimal" onChange={(event) => updateOptionLine(option.id, index, { cost: Number(event.target.value || 0) })} step="0.01" type="number" value={line.cost} />
                        </label>
                        <label className="mt-6 flex min-h-11 items-center gap-2 text-sm text-[var(--text)]">
                          <input checked={line.vat_applicable} onChange={(event) => updateOptionLine(option.id, index, { vat_applicable: event.target.checked })} type="checkbox" />
                          VAT
                        </label>
                        <button className="button-ghost mt-5 !px-3 !py-2 text-xs text-[#ff9a91]" onClick={() => deleteOptionLine(option.id, index)} type="button">
                          Delete
                        </button>
                      </div>
                      <label className="mt-3 block">
                        <span className="label">Notes</span>
                        <textarea className="field min-h-16" onChange={(event) => updateOptionLine(option.id, index, { notes: event.target.value })} value={line.notes} />
                      </label>
                    </div>
                  ))}
                  <button className="button-ghost !px-3 !py-2 text-xs" onClick={() => addOptionLine(option.id)} type="button">
                    + Add line to {option.label}
                  </button>
                </div>
                <div className="mt-4 grid gap-2 rounded-xl border border-[var(--border)] bg-black/10 p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--muted)]">Subtotal</span>
                    <span>{currency(option.subtotal)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--muted)]">VAT</span>
                    <span>{currency(option.vat_amount)}</span>
                  </div>
                  <div className="flex items-center justify-between font-semibold text-[var(--gold-l)]">
                    <span>Total</span>
                    <span>{currency(option.total)}</span>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <label className="flex items-center gap-2 text-sm text-[var(--text)]">
                    <input checked={option.recommended} onChange={() => updateOption(option.id, { recommended: true })} type="radio" />
                    Mark recommended
                  </label>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 rounded-2xl border border-[var(--border)] bg-black/10 p-4 text-sm text-[var(--muted)]">
            No quote options yet. The single cost breakdown above is still used unless you create options.
          </p>
        )}
      </div>

      <div className="card p-5">
        <p className="section-kicker text-[0.65rem] uppercase">Quote Wording</p>
        <div className="mt-4 grid gap-4">
          <div>
            <label className="label" htmlFor="roof-report">
              Roof Report
            </label>
            <textarea className="field min-h-40" id="roof-report" onChange={(event) => setRoofReport(event.target.value)} value={roofReport} />
          </div>
          <div>
            <label className="label" htmlFor="scope-of-works">
              Scope of Works
            </label>
            <textarea className="field min-h-40" id="scope-of-works" onChange={(event) => setScopeOfWorks(event.target.value)} value={scopeOfWorks} />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label" htmlFor="guarantee-text">
                Guarantee
              </label>
              <textarea className="field min-h-28" id="guarantee-text" onChange={(event) => setGuaranteeText(event.target.value)} value={guaranteeText} />
            </div>
            <div>
              <label className="label" htmlFor="exclusions">
                Exclusions
              </label>
              <textarea className="field min-h-28" id="exclusions" onChange={(event) => setExclusions(event.target.value)} value={exclusions} />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="terms">
              Terms
            </label>
            <textarea className="field min-h-28" id="terms" onChange={(event) => setTerms(event.target.value)} value={terms} />
          </div>
        </div>
      </div>

      <div className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="section-kicker text-[0.65rem] uppercase">Cost Breakdown</p>
            <p className="mt-2 text-sm text-[var(--muted)]">Rate Card matches fill £0 lines from survey quantities where possible.</p>
          </div>
          <Link className="button-ghost" href={"/settings/rates" as Route}>
            Open Rate Card
          </Link>
        </div>
        {unpricedLines.length ? (
          <div className="mt-4 rounded-2xl border border-[var(--gold)]/30 bg-[var(--gold)]/5 p-4 text-sm text-[var(--gold-l)]">
            {unpricedLines.length} line{unpricedLines.length === 1 ? "" : "s"} still need pricing. Add matching item names in the Rate Card, or enter the total manually.
          </div>
        ) : null}
        <div className="mt-4 space-y-4">
          {costBreakdown.map((line, index) => (
            <div className="rounded-2xl border border-[var(--border)] p-4" key={`${line.item}-${index}`}>
              <div className="grid gap-4 md:grid-cols-[1.4fr_0.8fr_0.8fr]">
                <div>
                  <label className="label" htmlFor={`line-item-${index}`}>
                    Item
                  </label>
                  <input
                    className="field"
                    id={`line-item-${index}`}
                    onChange={(event) => updateLine(index, { item: event.target.value })}
                    value={line.item}
                  />
                </div>
                <div>
                  <label className="label" htmlFor={`line-cost-${index}`}>
                    Cost
                  </label>
                  <input
                    className="field"
                    id={`line-cost-${index}`}
                    onChange={(event) => updateLine(index, { cost: Number(event.target.value || 0) })}
                    step="0.01"
                    type="number"
                    value={line.cost}
                  />
                </div>
                <label className="mt-6 flex items-center gap-3 text-sm text-[var(--text)]">
                  <input
                    checked={line.vat_applicable}
                    onChange={(event) => updateLine(index, { vat_applicable: event.target.checked })}
                    type="checkbox"
                  />
                  VAT applies
                </label>
              </div>
              <div className="mt-4">
                <label className="label" htmlFor={`line-notes-${index}`}>
                  Notes
                </label>
                <textarea
                  className="field min-h-20"
                  id={`line-notes-${index}`}
                  onChange={(event) => updateLine(index, { notes: event.target.value })}
                  value={line.notes}
                />
              </div>
            </div>
          ))}
          <button
            className="button-ghost"
            onClick={() =>
              setCostBreakdown((current) => [...current, { item: "Additional works", cost: 0, vat_applicable: true, notes: "" }])
            }
            type="button"
          >
            Add Line Item
          </button>
        </div>
        <div className="mt-5 grid gap-2 rounded-2xl border border-[var(--border)] p-4 text-sm md:max-w-sm md:ml-auto">
          <div className="flex items-center justify-between">
            <span className="text-[var(--muted)]">Subtotal</span>
            <span>{currency(totals.subtotal)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[var(--muted)]">VAT</span>
            <span>{currency(totals.vat)}</span>
          </div>
          <div className="flex items-center justify-between font-semibold text-[var(--gold-l)]">
            <span>Total</span>
            <span>{currency(totals.total)}</span>
          </div>
        </div>
      </div>

      <div className="card p-5">
        <p className="section-kicker text-[0.65rem] uppercase">Email and Review Notes</p>
        <div className="mt-4 grid gap-4">
          <div>
            <label className="label" htmlFor="email-subject">
              Customer Email Subject
            </label>
            <input className="field" id="email-subject" onChange={(event) => setEmailSubject(event.target.value)} value={emailSubject} />
          </div>
          <div>
            <label className="label" htmlFor="email-body">
              Customer Email Body
            </label>
            <textarea className="field min-h-32" id="email-body" onChange={(event) => setEmailBody(event.target.value)} value={emailBody} />
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="label" htmlFor="confidence">
                Confidence
              </label>
              <select className="field" id="confidence" onChange={(event) => setConfidence(event.target.value as QuoteRecord["confidence"])} value={confidence ?? "Medium"}>
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="label" htmlFor="pricing-notes">
                Pricing Notes
              </label>
              <textarea className="field min-h-24" id="pricing-notes" onChange={(event) => setPricingNotes(event.target.value)} value={pricingNotes} />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="missing-info">
              Missing Info
            </label>
            <textarea className="field min-h-24" id="missing-info" onChange={(event) => setMissingInfo(event.target.value)} value={missingInfo} />
          </div>
        </div>
      </div>

      <div className="card p-5">
        <p className="section-kicker text-[0.65rem] uppercase">Customer Messages</p>
        <div className="mt-4 space-y-3">
          {messages.length ? (
            messages.map((message) => (
              <div className="rounded-2xl border border-[var(--border)] bg-black/10 p-4 text-sm" key={message.id}>
                <p className="font-semibold text-white">{message.sender_type === "admin" ? "We Are Roofing" : message.sender_name || "Customer"}</p>
                <p className="mt-2 text-[var(--muted)]">{message.message}</p>
              </div>
            ))
          ) : (
            <p className="rounded-2xl border border-[var(--border)] bg-black/10 p-4 text-sm text-[var(--muted)]">No customer questions on this quote yet.</p>
          )}
        </div>
        <div className="mt-4 flex flex-col gap-3 md:flex-row">
          <textarea className="field min-h-20 md:flex-1" onChange={(event) => setReply(event.target.value)} placeholder="Reply to the customer..." value={reply} />
          <button className="button-primary h-11" onClick={sendReply} type="button">
            Send Reply
          </button>
        </div>
      </div>

      {success ? <p className="text-sm text-[#7ce3a6]">{success}</p> : null}
      {error ? <p className="text-sm text-[#ff9a91]">{error}</p> : null}
    </div>
  );
}
