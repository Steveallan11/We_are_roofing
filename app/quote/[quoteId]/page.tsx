import { notFound } from "next/navigation";
import { PublicQuoteActions } from "@/components/quotes/public-quote-actions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { QuoteOption, QuoteRecord } from "@/lib/types";
import { currency } from "@/lib/utils";

type Props = {
  params: Promise<{ quoteId: string }>;
};

export default async function PublicQuotePage({ params }: Props) {
  const { quoteId } = await params;
  const supabase = createSupabaseAdminClient();
  const { data: quote } = await supabase.from("quotes").select("*").eq("id", quoteId).single();
  if (!quote) notFound();

  const record = quote as QuoteRecord;
  const options = (record.options ?? []) as QuoteOption[];

  return (
    <main className="min-h-screen bg-[var(--obsidian)] px-4 py-8">
      <div className="mx-auto max-w-4xl">
        <div className="card p-6">
          <p className="section-kicker text-[0.65rem] uppercase">We Are Roofing UK Ltd</p>
          <h1 className="mt-3 font-display text-4xl text-white">Quotation {record.quote_ref}</h1>
          <p className="mt-4 whitespace-pre-wrap text-sm text-[var(--muted)]">{record.roof_report}</p>
          <h2 className="mt-8 font-display text-2xl text-white">Scope of Works</h2>
          <p className="mt-3 whitespace-pre-wrap text-sm text-[var(--muted)]">{record.scope_of_works}</p>
        </div>

        {options.length ? (
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {options.map((option) => (
              <div className="card p-5" key={option.id}>
                {option.recommended ? <p className="section-kicker text-[0.65rem] uppercase text-[var(--gold)]">Recommended</p> : null}
                <h2 className="mt-2 font-display text-2xl text-white">{option.label}</h2>
                <p className="mt-2 text-sm text-[var(--muted)]">{option.description}</p>
                <p className="mt-5 font-display text-3xl text-[var(--gold-l)]">{currency(option.total)}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="card mt-5 p-5">
            <p className="font-display text-3xl text-[var(--gold-l)]">{currency(record.total)}</p>
          </div>
        )}

        <PublicQuoteActions options={options} quoteId={record.id} />
      </div>
    </main>
  );
}
