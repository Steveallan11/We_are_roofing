import { AppShell } from "@/components/layout/app-shell";
import { KnowledgeAdmin } from "@/components/knowledge/knowledge-admin";
import { getHistoricalQuotes, getKnowledgeBase, getPricingRules } from "@/lib/data";

export default async function KnowledgePage() {
  const [knowledgeBase, historicalQuotes, pricingRules] = await Promise.all([
    getKnowledgeBase(),
    getHistoricalQuotes(1000),
    getPricingRules()
  ]);
  const syncedHistoricalQuotes = knowledgeBase.filter(
    (entry) => entry.source_type === "historical_quote" || entry.category === "Historical Quote"
  ).length;
  const missingHistoricalQuotes = Math.max(0, historicalQuotes.length - syncedHistoricalQuotes);
  const syncPercent = historicalQuotes.length > 0 ? Math.round((syncedHistoricalQuotes / historicalQuotes.length) * 100) : 100;
  const rateCardReady = pricingRules.some((rule) => rule.rule_name && rule.flat_adjustment != null);

  return (
    <AppShell
      title="Knowledge Engine"
      subtitle="Bring Andrew's past quotes, house style, and pricing rules into the platform so every new draft starts in the right voice and commercial range."
    >
      <section className="page-grid">
        <div className="stack">
          <div className="card p-5">
            <p className="section-kicker text-[0.65rem] uppercase">Import Mapping</p>
            <h2 className="mt-2 font-condensed text-3xl text-white">Where the quote knowledge goes</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">Historical quotes feed comparable pricing and wording. Knowledge records feed style, scope, systems, and rules for new drafts.</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-[var(--border)] p-4">
                <p className="font-semibold text-white">Notion Quotes</p>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  Imports into `historical_quotes` for comparable totals, wording anchors, source year, and uplifted commercial references.
                </p>
              </div>
              <div className="rounded-2xl border border-[var(--border)] p-4">
                <p className="font-semibold text-white">Notion Master Source Library</p>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  Imports into `knowledge_base` for scope wording, system references, pricing priority, diagnostics, and retrieval hints.
                </p>
              </div>
            </div>
          </div>
          <KnowledgeAdmin
            historicalQuotesCount={historicalQuotes.length}
            historicalQuotesMissing={missingHistoricalQuotes}
            syncedHistoricalQuotes={syncedHistoricalQuotes}
          />
        </div>

        <aside className="stack">
          <div className="card p-5">
            <p className="section-kicker text-[0.65rem] uppercase">Sync Health</p>
            <p className="mt-3 text-4xl font-display text-[var(--gold-l)]">{syncPercent}%</p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {missingHistoricalQuotes > 0 ? `${missingHistoricalQuotes} historical quote${missingHistoricalQuotes === 1 ? "" : "s"} still need syncing.` : "Historical quote knowledge is synced."}
            </p>
          </div>
          <div className="card p-5">
            <p className="section-kicker text-[0.65rem] uppercase">Quote Knowledge</p>
            <div className="mt-4 grid gap-3">
              <KnowledgeMetric label="Historical quotes" value={String(historicalQuotes.length)} />
              <KnowledgeMetric label="Synced to KB" value={String(syncedHistoricalQuotes)} />
              <KnowledgeMetric label="Reusable records" value={String(knowledgeBase.length)} />
            </div>
          </div>
          <div className="card p-5">
            <p className="section-kicker text-[0.65rem] uppercase">Pricing Rules</p>
            <p className={`mt-3 rounded-2xl border px-3 py-2 text-sm ${rateCardReady ? "border-[#10b981]/35 bg-[#10b981]/10 text-[#9df0bd]" : "border-[#f59e0b]/35 bg-[#f59e0b]/10 text-[#ffd38b]"}`}>
              {rateCardReady ? "Rate card has active values." : "Rate card still needs values before quotes can price confidently."}
            </p>
            <div className="mt-4 space-y-3">
              {pricingRules.length > 0 ? (
                pricingRules.map((rule) => (
                  <div className="rounded-2xl border p-3" key={rule.id}>
                    <p className="font-semibold text-white">{rule.title}</p>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      {rule.year_from ?? "Any"} to {rule.year_to ?? "Any"} - x{rule.uplift_multiplier}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-[#ffcf7d]">0 rates configured - quotes can still show unpriced items until the Rate Card is filled in.</p>
              )}
            </div>
          </div>
        </aside>
      </section>
    </AppShell>
  );
}

function KnowledgeMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-black/20 p-3">
      <p className="text-[0.62rem] font-bold uppercase tracking-[0.2em] text-[var(--dim)]">{label}</p>
      <p className="mt-2 text-xl font-semibold text-white">{value}</p>
    </div>
  );
}
