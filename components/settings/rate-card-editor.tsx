"use client";

import { useMemo, useState, useTransition } from "react";
import type { RateCardEntry } from "@/lib/pricing/rateCard";
import { currency } from "@/lib/utils";

type Props = {
  initialRates: RateCardEntry[];
  hasSavedRates: boolean;
};

export function RateCardEditor({ initialRates, hasSavedRates }: Props) {
  const [rates, setRates] = useState(initialRates);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const grouped = useMemo(() => {
    return rates.reduce<Record<string, RateCardEntry[]>>((acc, rate) => {
      acc[rate.category] = [...(acc[rate.category] ?? []), rate];
      return acc;
    }, {});
  }, [rates]);

  function updateRate(item: string, category: string, value: number) {
    setRates((current) => current.map((rate) => (rate.item === item && rate.category === category ? { ...rate, rate: value } : rate)));
  }

  async function saveRates() {
    setMessage(null);
    setError(null);
    const response = await fetch("/api/settings/rates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rates })
    });
    const result = (await response.json().catch(() => null)) as { ok?: boolean; error?: string; repricedQuotes?: number } | null;

    if (!response.ok || !result?.ok) {
      setError(result?.error || "Unable to save the Rate Card.");
      return;
    }

    setMessage(`Rate Card saved. ${result.repricedQuotes ?? 0} draft quote${result.repricedQuotes === 1 ? "" : "s"} repriced.`);
    startTransition(() => window.location.reload());
  }

  return (
    <div className="stack">
      {!hasSavedRates ? (
        <div className="card border-[var(--gold)]/40 bg-[var(--gold)]/5 p-4">
          <p className="font-semibold text-[var(--gold-l)]">No saved rates yet</p>
          <p className="mt-1 text-sm text-[var(--muted)]">
            These starter rates are loaded for editing. Save them once, then new and existing draft quotes can price themselves from the Rate Card.
          </p>
        </div>
      ) : null}

      <div className="card overflow-hidden">
        <div className="border-b border-[var(--border)] p-5">
          <p className="section-kicker text-[0.65rem] uppercase">Unit Rates</p>
          <h2 className="mt-2 font-condensed text-3xl text-white">Roofing Rate Card</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">Edit the prices Andy wants the quote engine to use for roof survey takeoffs and BOM line items.</p>
        </div>

        <div className="divide-y divide-[var(--border)]">
          {Object.entries(grouped).map(([category, categoryRates]) => (
            <section className="p-5" key={category}>
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--gold)]">{category}</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">{categoryRates.length} pricing rules</p>
                </div>
              </div>
              <div className="grid gap-3">
                {categoryRates.map((rate) => (
                  <div
                    className="grid gap-3 rounded-2xl border border-[var(--border)] bg-black/10 p-4 md:grid-cols-[1.4fr_0.5fr_0.7fr]"
                    key={`${rate.category}-${rate.item}`}
                  >
                    <div>
                      <p className="font-semibold text-white">{rate.item}</p>
                      <p className="mt-1 text-xs text-[var(--muted)]">Used when a quote line matches this item name.</p>
                    </div>
                    <div>
                      <p className="label mb-1">Unit</p>
                      <p className="rounded-xl border border-[var(--border)] px-3 py-3 text-sm text-[var(--text)]">{rate.unit}</p>
                    </div>
                    <div>
                      <label className="label mb-1" htmlFor={`rate-${rate.category}-${rate.item}`}>
                        Rate
                      </label>
                      <div className="flex items-center gap-2">
                        <span className="text-[var(--muted)]">£</span>
                        <input
                          className="field"
                          id={`rate-${rate.category}-${rate.item}`}
                          inputMode="decimal"
                          min="0"
                          onChange={(event) => updateRate(rate.item, rate.category, Number(event.target.value || 0))}
                          step="0.01"
                          type="number"
                          value={rate.rate}
                        />
                      </div>
                      <p className="mt-1 text-[0.68rem] text-[var(--muted)]">{currency(rate.rate)} per {rate.unit}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="sticky bottom-0 flex flex-col gap-3 border-t border-[var(--border)] bg-[var(--surface)]/95 p-5 backdrop-blur md:flex-row md:items-center md:justify-between">
          <div className="text-sm">
            {message ? <p className="text-[#7ce3a6]">{message}</p> : null}
            {error ? <p className="text-[#ff9a91]">{error}</p> : null}
            {!message && !error ? <p className="text-[var(--muted)]">Saving also reprices matching draft quotes that still have £0 lines.</p> : null}
          </div>
          <button className="button-primary min-h-11" disabled={isPending} onClick={saveRates} type="button">
            {isPending ? "Saving..." : "Save Rate Card"}
          </button>
        </div>
      </div>
    </div>
  );
}
