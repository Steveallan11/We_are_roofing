import Link from "next/link";
import { notFound } from "next/navigation";
import { QuoteEditor } from "@/components/jobs/quote-editor";
import { AppShell } from "@/components/layout/app-shell";
import { QuoteActions } from "@/components/jobs/quote-actions";
import { StatusPill } from "@/components/ui/status-pill";
import { getJobBundle } from "@/lib/data";
import { currency } from "@/lib/utils";

type Props = {
  params: Promise<{ jobId: string }>;
  searchParams?: Promise<{ prefill?: string; surveyId?: string }>;
};

export default async function QuotePage({ params, searchParams }: Props) {
  const { jobId } = await params;
  const query = searchParams ? await searchParams : undefined;
  const bundle = await getJobBundle(jobId);
  if (!bundle) notFound();

  const quote = bundle.quote ?? null;
  const displayQuoteRef = quote?.quote_ref ?? "No Draft Yet";
  const displayStatus = quote?.status ?? "Draft";

  return (
    <AppShell
      title="Quote Review"
      subtitle="Review the saved quote, approve it when the wording and totals are right, then send it to the customer."
      actions={<QuoteActions customerEmail={bundle.customer.email} jobId={bundle.job.id} quote={quote} />}
    >
      <section className="page-grid">
        <div className="stack">
          {query?.prefill === "roof-survey" ? (
            <div className="card border-[var(--gold)]/40 bg-[var(--gold)]/5 p-4">
              <p className="text-sm text-[var(--gold-l)]">Pre-populated from roof survey takeoff. Add rates, waste factors, and final wording to complete the quote.</p>
            </div>
          ) : null}
          <div className="card p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="section-kicker text-[0.65rem] uppercase">{bundle.job.job_ref ?? "WR-J-TBC"} · {displayQuoteRef}</p>
                <h2 className="mt-2 font-condensed text-3xl text-white">{bundle.customer.full_name}</h2>
                <p className="mt-2 text-sm text-[var(--muted)]">{bundle.job.property_address}</p>
              </div>
              <StatusPill status={displayStatus} />
            </div>

            <div className="gold-divider my-5" />

            {quote ? (
              <div className="space-y-5 text-sm leading-7 text-[var(--text)]">
                <section>
                  <h3 className="font-condensed text-2xl text-[var(--gold-l)]">Roof Report</h3>
                  <p className="mt-2">{quote.roof_report}</p>
                </section>
                <section>
                  <h3 className="font-condensed text-2xl text-[var(--gold-l)]">Scope of Works</h3>
                  <p className="mt-2 whitespace-pre-line">{quote.scope_of_works}</p>
                </section>
                <section>
                  <h3 className="font-condensed text-2xl text-[var(--gold-l)]">Guarantee</h3>
                  <p className="mt-2">{quote.guarantee_text}</p>
                </section>
                <section>
                  <h3 className="font-condensed text-2xl text-[var(--gold-l)]">Terms</h3>
                  <p className="mt-2">{quote.terms}</p>
                </section>
              </div>
            ) : (
              <div className="rounded-2xl border border-[var(--border)] p-4 text-sm text-[var(--muted)]">
                No saved quote draft yet. Use <span className="text-[var(--text)]">Create Quote</span> to generate and store the first draft from this job record.
              </div>
            )}
          </div>

          <QuoteEditor jobId={bundle.job.id} quote={quote} />
        </div>

        <aside className="stack">
          <div className="card p-5">
            <p className="section-kicker text-[0.65rem] uppercase">Cost Breakdown</p>
            {quote ? (
              <>
                <div className="mt-4 space-y-3">
                  {quote.cost_breakdown.map((line) => (
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
                    <span>{currency(quote.subtotal)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--muted)]">VAT</span>
                    <span>{currency(quote.vat_amount)}</span>
                  </div>
                  <div className="flex items-center justify-between font-semibold text-[var(--gold-l)]">
                    <span>Total</span>
                    <span>{currency(quote.total)}</span>
                  </div>
                </div>
              </>
            ) : (
              <p className="mt-4 text-sm text-[var(--muted)]">The pricing breakdown will appear here once the first quote draft has been created.</p>
            )}
          </div>

          {quote ? (
            <div className="card p-5">
              <p className="section-kicker text-[0.65rem] uppercase">AI Review</p>
              <div className="mt-4 space-y-3 text-sm">
                <p>
                  <span className="text-[var(--muted)]">Confidence:</span> {quote.confidence}
                </p>
                <div>
                  <p className="text-[var(--muted)]">Missing Info</p>
                  <ul className="mt-2 space-y-1 text-[var(--text)]">
                    {quote.missing_info.length > 0 ? quote.missing_info.map((item) => <li key={item}>- {item}</li>) : <li>- No blocking gaps found</li>}
                  </ul>
                </div>
                <div>
                  <p className="text-[var(--muted)]">Pricing Notes</p>
                  <ul className="mt-2 space-y-1 text-[var(--text)]">
                    {quote.pricing_notes.length > 0 ? quote.pricing_notes.map((item) => <li key={item}>- {item}</li>) : <li>- No extra pricing notes</li>}
                  </ul>
                </div>
              </div>
            </div>
          ) : null}

          <div className="card p-5">
            <p className="section-kicker text-[0.65rem] uppercase">Quote Documents</p>
            <div className="mt-4 space-y-3">
              {bundle.documents.filter((document) => document.quote_id === quote?.id).length > 0 ? (
                bundle.documents
                  .filter((document) => document.quote_id === quote?.id)
                  .map((document) => (
                    <div className="rounded-2xl border p-3" key={document.id}>
                      <p className="font-semibold text-white">{document.display_name}</p>
                      <p className="mt-1 text-xs text-[var(--muted)]">{document.document_type}</p>
                      {document.public_url ? (
                        <a className="mt-2 inline-flex text-sm text-[var(--gold-l)] underline-offset-4 hover:underline" href={document.public_url} rel="noreferrer" target="_blank">
                          Open document
                        </a>
                      ) : null}
                    </div>
                  ))
              ) : (
                <p className="text-sm text-[var(--muted)]">Generate the first document snapshot to keep the quote inside the job file.</p>
              )}
            </div>
          </div>

          <div className="flex gap-3">
            <Link className="button-ghost" href={`/jobs/${bundle.job.id}`}>
              Back to Job
            </Link>
          </div>
        </aside>
      </section>
    </AppShell>
  );
}
