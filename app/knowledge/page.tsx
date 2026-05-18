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

  return (
    <AppShell
      title="Knowledge Engine"
      subtitle="Bring Andrew's past quotes, house style, and pricing rules into the platform so every new draft starts in the right voice and commercial range."
    >
      <section className="page-grid">
        <div className="stack">
          <div className="card p-5">
            <p className="section-kicker text-[0.65rem] uppercase">Import Mapping</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-[var(--border)] p-4">
                <p className="font-semibold text-white">Notion `📋 Quotes`</p>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  Imports into `historical_quotes` for comparable totals, wording anchors, source year, and uplifted commercial references.
                </p>
              </div>
              <div className="rounded-2xl border border-[var(--border)] p-4">
                <p className="font-semibold text-white">Notion `🧠 Master Source Library`</p>
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
            <p className="section-kicker text-[0.65rem] uppercase">Knowledge Base</p>
            <p className="mt-3 text-4xl font-display text-[var(--gold-l)]">{knowledgeBase.length}</p>
            <p className="mt-1 text-sm text-[var(--muted)]">Reusable rules, style notes, pricing references, and email tone records.</p>
          </div>
          <div className="card p-5">
            <p className="section-kicker text-[0.65rem] uppercase">Historical Quotes</p>
            <p className="mt-3 text-4xl font-display text-[var(--gold-l)]">{historicalQuotes.length}</p>
            <p className="mt-1 text-sm text-[var(--muted)]">Imported comparables used as style and uplifted price anchors.</p>
            <p className="mt-3 text-sm text-[var(--muted)]">
              {syncedHistoricalQuotes} synced into Knowledge Base | {missingHistoricalQuotes} still missing
            </p>
          </div>
          <div className="card p-5">
            <p className="section-kicker text-[0.65rem] uppercase">Pricing Rules</p>
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
