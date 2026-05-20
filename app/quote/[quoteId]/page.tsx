import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { PublicQuoteActions } from "@/components/quotes/public-quote-actions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { validatePublicQuoteAccess } from "@/lib/public-quote";
import type { QuoteOption, QuoteRecord } from "@/lib/types";
import { currency } from "@/lib/utils";

type Props = {
  params: Promise<{ quoteId: string }>;
  searchParams: Promise<{ token?: string }>;
};

export default async function PublicQuotePage({ params, searchParams }: Props) {
  const { quoteId } = await params;
  const { token } = await searchParams;
  const supabase = createSupabaseAdminClient();
  const { data: quote } = await supabase.from("quotes").select("*").eq("id", quoteId).single();
  if (!quote) notFound();

  const record = quote as QuoteRecord;
  const access = validatePublicQuoteAccess(record, token);
  if (!access.ok) notFound();

  const options = (record.options ?? []) as QuoteOption[];
  const optionTotals = options.map((option) => Number(option.total ?? 0)).filter(Number.isFinite);
  const displayTotal = optionTotals.length ? Math.min(...optionTotals) : Number(record.total ?? 0);

  return (
    <main className="min-h-screen bg-[var(--obsidian)] px-4 py-6 md:py-10">
      <div className="mx-auto max-w-5xl">
        <div className="overflow-hidden rounded-[1.5rem] border border-[var(--border)] bg-[var(--surface)] shadow-2xl">
          <div className="border-b border-[var(--border)] bg-black/35 px-5 py-6 md:px-8 md:py-8">
            <p className="section-kicker text-[0.68rem] uppercase text-[var(--gold)]">We Are Roofing UK Ltd</p>
            <div className="mt-4 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
              <div>
                <h1 className="font-display text-4xl leading-tight text-white md:text-6xl">Your Roofing Quote</h1>
                <p className="mt-3 font-ui text-sm text-[var(--text-muted)] md:text-base">Quote reference {record.quote_ref}</p>
              </div>
              <div className="rounded-2xl border border-[var(--gold)]/35 bg-[var(--gold)]/10 p-4 md:min-w-52">
                <p className="font-ui text-[0.68rem] font-bold uppercase tracking-[0.18em] text-[var(--gold)]">{options.length ? "From" : "Total"}</p>
                <p className="mt-1 font-display text-4xl text-[var(--gold-l)]">{currency(displayTotal)}</p>
              </div>
            </div>
          </div>

          <div className="grid gap-5 p-5 md:p-8">
            <QuoteSection title="Roof Report" intro="What we found and what it means for the roof.">
              <ReadableText value={record.roof_report} />
            </QuoteSection>

            <QuoteSection title="Scope of Works" intro="The work included in this quotation.">
              <ReadableText value={record.scope_of_works} />
            </QuoteSection>

            {record.guarantee_text ? (
              <QuoteSection title="Guarantee">
                <ReadableText value={record.guarantee_text} />
              </QuoteSection>
            ) : null}

            {record.exclusions ? (
              <QuoteSection title="Exclusions">
                <ReadableText value={record.exclusions} />
              </QuoteSection>
            ) : null}

            {record.terms ? (
              <QuoteSection title="Terms">
                <ReadableText value={record.terms} />
              </QuoteSection>
            ) : null}
          </div>
        </div>

        {options.length ? (
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {options.map((option) => (
              <div className={`card p-5 md:p-6 ${option.recommended ? "border-[var(--gold)]/55 bg-[var(--gold)]/5" : ""}`} key={option.id}>
                {option.recommended ? <p className="section-kicker text-[0.65rem] uppercase text-[var(--gold)]">Recommended</p> : null}
                <h2 className="mt-2 font-display text-3xl text-white">{option.label}</h2>
                <div className="mt-3 text-base leading-7 text-[var(--text-second)]">
                  <ReadableText value={option.description} compact />
                </div>
                <p className="mt-5 font-display text-4xl text-[var(--gold-l)]">{currency(option.total)}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="card mt-5 p-5">
            <p className="font-display text-3xl text-[var(--gold-l)]">{currency(record.total)}</p>
          </div>
        )}

        <PublicQuoteActions options={options} quoteId={record.id} token={access.mode === "token" ? token : null} />
      </div>
    </main>
  );
}

function QuoteSection({ children, intro, title }: { children: ReactNode; intro?: string; title: string }) {
  return (
    <section className="rounded-2xl border border-[var(--border)] bg-black/20 p-5 md:p-6">
      <p className="section-kicker text-[0.68rem] uppercase text-[var(--gold)]">{title}</p>
      {intro ? <p className="mt-2 font-ui text-sm text-[var(--text-muted)]">{intro}</p> : null}
      <div className="mt-4 space-y-4 text-[17px] leading-8 text-[var(--text-second)] md:text-[18px] md:leading-9">{children}</div>
    </section>
  );
}

function ReadableText({ value, compact = false }: { value?: string | null; compact?: boolean }) {
  const blocks = toReadableBlocks(value);
  if (!blocks.length) {
    return <p className={compact ? "font-ui text-base leading-7 text-[var(--text-muted)]" : "font-ui text-[17px] leading-8 text-[var(--text-muted)]"}>To be confirmed.</p>;
  }

  return (
    <>
      {blocks.map((block, index) => {
        if (block.kind === "list") {
          return (
            <ul className="space-y-2" key={`list-${index}`}>
              {block.items.map((item) => (
                <li className="flex gap-3 font-ui text-[17px] leading-8 text-[var(--text-second)]" key={item}>
                  <span className="mt-3 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--gold)]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          );
        }

        return (
          <p className={compact ? "font-ui text-base leading-7 text-[var(--text-second)]" : "font-ui text-[17px] leading-8 text-[var(--text-second)] md:text-[18px] md:leading-9"} key={`p-${index}`}>
            {block.text}
          </p>
        );
      })}
    </>
  );
}

type ReadableBlock = { kind: "paragraph"; text: string } | { kind: "list"; items: string[] };

function toReadableBlocks(value?: string | null): ReadableBlock[] {
  const text = value?.replace(/\r\n/g, "\n").trim();
  if (!text) return [];

  const rawBlocks = text.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);
  const blocks: ReadableBlock[] = [];

  rawBlocks.forEach((block) => {
    const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
    const listLines = lines.filter((line) => /^[-*•]|\d+[.)]/.test(line));

    if (listLines.length >= Math.max(1, lines.length - 1)) {
      blocks.push({
        kind: "list",
        items: lines.map((line) => line.replace(/^[-*•]\s*/, "").replace(/^\d+[.)]\s*/, "")).filter(Boolean)
      });
      return;
    }

    splitLongParagraph(lines.join(" ")).forEach((paragraph) => blocks.push({ kind: "paragraph", text: paragraph }));
  });

  return blocks;
}

function splitLongParagraph(text: string) {
  if (text.length < 320) return [text];
  const sentences = text.match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g)?.map((sentence) => sentence.trim()).filter(Boolean) ?? [text];
  const paragraphs: string[] = [];
  let current = "";

  sentences.forEach((sentence) => {
    const next = current ? `${current} ${sentence}` : sentence;
    if (next.length > 260 && current) {
      paragraphs.push(current);
      current = sentence;
    } else {
      current = next;
    }
  });

  if (current) paragraphs.push(current);
  return paragraphs;
}
