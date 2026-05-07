import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { StatusPill } from "@/components/ui/status-pill";
import { getJobBundle, getKnowledgeBase } from "@/lib/data";
import { generateQuoteFromBundle } from "@/lib/quote";
import { currency } from "@/lib/utils";

type Props = {
  params: Promise<{ jobId: string }>;
};

export default async function QuotePage({ params }: Props) {
  const { jobId } = await params;
  const bundle = await getJobBundle(jobId);
  if (!bundle) notFound();

  const knowledge = await getKnowledgeBase();
  const generatedQuote = await generateQuoteFromBundle(bundle, knowledge);
  const previewQuote = bundle.quote ?? generatedQuote;
  const displayQuoteRef = bundle.quote?.quote_ref ?? "Draft Preview";
  const displayStatus = bundle.quote?.status ?? "Draft";

  return (
    <AppShell
      title="Quote Review"
      subtitle="This is the customer-facing draft view. The API save/approve/send endpoints still need wiring, but the review structure and pricing logic are now in place."
      actions={
        <>
          <span className="button-primary">Approve Quote</span>
          <span className="button-secondary">Send Quote</span>
        </>
      }
    >
      <section className="page-grid">
        <div className="stack">
          <div className="card p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="section-kicker text-[0.65rem] uppercase">{displayQuoteRef}</p>
                <h2 className="mt-2 font-condensed text-3xl text-white">{bundle.customer.full_name}</h2>
                <p className="mt-2 text-sm text-[var(--muted)]">{bundle.job.property_address}</p>
              </div>
              <StatusPill status={displayStatus} />
            </div>

            <div className="gold-divider my-5" />

            <div className="space-y-5 text-sm leading-7 text-[var(--text)]">
              <section>
                <h3 className="font-condensed text-2xl text-[var(--gold-l)]">Roof Report</h3>
                <p className="mt-2">{previewQuote.roof_report}</p>
              </section>
              <section>
                <h3 className="font-condensed text-2xl text-[var(--gold-l)]">Scope of Works</h3>
                <p className="mt-2 whitespace-pre-line">{previewQuote.scope_of_works}</p>
              </section>
              <section>
                <h3 className="font-condensed text-2xl text-[var(--gold-l)]">Guarantee</h3>
                <p className="mt-2">{previewQuote.guarantee_text}</p>
              </section>
              <section>
                <h3 className="font-condensed text-2xl text-[var(--gold-l)]">Terms</h3>
                <p className="mt-2">{previewQuote.terms}</p>
              </section>
            </div>
          </div>
        </div>

        <aside className="stack">
          <div className="card p-5">
            <p className="section-kicker text-[0.65rem] uppercase">Cost Breakdown</p>
            <div className="mt-4 space-y-3">
              {previewQuote.cost_breakdown.map((line) => (
                <div className="flex items-start justify-between gap-3 rounded-2xl border p-3" key={line.item}>
                  <div>
                    <p className="font-semibold text-white">{line.item}</p>
                    <p className="mt-1 text-xs text-[var(--muted)]">{line.notes}</p>
                  </div>
                  <p className="font-display text-2xl text-[var(--gold-l)]">{currency(line.cost)}</p>
                </div>
              ))}
            </div>
            <div className="gold-divider my-4" />
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-[var(--muted)]">Subtotal</span>
                <span>{currency(previewQuote.subtotal)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[var(--muted)]">VAT</span>
                <span>{currency(previewQuote.vat_amount)}</span>
              </div>
              <div className="flex items-center justify-between font-semibold text-[var(--gold-l)]">
                <span>Total</span>
                <span>{currency(previewQuote.total)}</span>
              </div>
            </div>
          </div>

          <div className="card p-5">
            <p className="section-kicker text-[0.65rem] uppercase">AI Review</p>
            <div className="mt-4 space-y-3 text-sm">
              <p>
                <span className="text-[var(--muted)]">Confidence:</span> {previewQuote.confidence}
              </p>
              <div>
                <p className="text-[var(--muted)]">Missing Info</p>
                <ul className="mt-2 space-y-1 text-[var(--text)]">
                  {previewQuote.missing_info.length > 0 ? (
                    previewQuote.missing_info.map((item) => <li key={item}>• {item}</li>)
                  ) : (
                    <li>• No blocking gaps found</li>
                  )}
                </ul>
              </div>
              <div>
                <p className="text-[var(--muted)]">Pricing Notes</p>
                <ul className="mt-2 space-y-1 text-[var(--text)]">
                  {previewQuote.pricing_notes.length > 0 ? (
                    previewQuote.pricing_notes.map((item) => <li key={item}>• {item}</li>)
                  ) : (
                    <li>• No extra pricing notes</li>
                  )}
                </ul>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <Link className="button-ghost" href={`/jobs/${bundle.job.id}`}>
              Back to Job
            </Link>
            <span className="button-secondary">API save next</span>
          </div>
        </aside>
      </section>
    </AppShell>
  );
}
