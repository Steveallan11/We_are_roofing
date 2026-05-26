import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { PublicQuoteActions } from "@/components/quotes/public-quote-actions";
import { buildQuoteOptionPriceDetailRows, getOptionTotal, getQuotePipelineValue } from "@/lib/quotes/value";
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
  const displayTotal = getQuotePipelineValue(record) ?? 0;

  return (
    <main className="min-h-screen bg-[var(--obsidian)] px-4 py-6 md:py-10">
      <div className="mx-auto max-w-5xl">
        <div className="overflow-hidden rounded-[1.75rem] border border-[var(--border)] bg-[var(--surface)] shadow-2xl">
          <div className="border-b border-[var(--border)] bg-black/35 px-5 py-7 md:px-9 md:py-10">
            <p className="section-kicker text-[0.68rem] uppercase text-[var(--gold)]">We Are Roofing UK Ltd</p>
            <div className="mt-5 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
              <div>
                <h1 className="font-display text-4xl leading-tight text-white md:text-6xl">Your Roofing Quote</h1>
                <p className="mt-4 max-w-2xl font-ui text-lg leading-8 text-[var(--text-second)]">
                  A clear explanation of what we found, what we recommend doing, and the next step if you would like to proceed.
                </p>
                <p className="mt-3 font-ui text-base font-semibold text-[var(--text-muted)]">Quote reference {record.quote_ref}</p>
              </div>
            </div>
          </div>

          <div className="grid gap-5 p-5 md:p-8">
            <section className="rounded-3xl border border-[var(--gold)]/25 bg-[var(--gold)]/10 p-5 md:p-7">
              <p className="section-kicker text-[0.68rem] uppercase text-[var(--gold)]">How to read this quote</p>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {[
                  ["1", "Roof report", "What we found and what it means."],
                  ["2", "Scope", "The work we are allowing for."],
                  ["3", "Options", "Choose the option that feels right, then confirm your details."]
                ].map(([step, title, body]) => (
                  <div className="rounded-2xl border border-[var(--border)] bg-black/20 p-4" key={step}>
                    <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-full bg-[var(--gold)] font-ui text-sm font-bold text-black">{step}</div>
                    <h2 className="font-ui text-lg font-bold text-white">{title}</h2>
                    <p className="mt-2 font-ui text-base leading-7 text-[var(--text-muted)]">{body}</p>
                  </div>
                ))}
              </div>
            </section>

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
              <div
                className={`rounded-[1.5rem] border bg-[#101010] p-5 shadow-xl md:p-6 ${
                  option.recommended ? "border-[var(--gold)]/60 shadow-[0_0_0_1px_rgba(212,175,55,0.12)]" : "border-[var(--border)]"
                }`}
                key={option.id}
              >
                {option.recommended ? <p className="section-kicker text-[0.65rem] uppercase text-[var(--gold)]">Recommended</p> : null}
                <h2 className={option.recommended ? "mt-2 font-display text-3xl leading-tight text-white" : "font-display text-3xl leading-tight text-white"}>{option.label}</h2>
                {hasReadableText(option.description) ? (
                  <div className="mt-3 text-base leading-7 text-[#d8d8d8]">
                    <ReadableText value={option.description} compact />
                  </div>
                ) : null}
                <OptionBreakdown option={option} />
              </div>
            ))}
          </div>
        ) : (
          <div className="card mt-5 p-5">
            <p className="font-display text-3xl text-[var(--gold-l)]">{currency(displayTotal)}</p>
          </div>
        )}

        <PublicQuoteActions options={options} quoteId={record.id} token={access.mode === "token" ? token : null} />
      </div>
    </main>
  );
}

function OptionBreakdown({ option }: { option: QuoteOption }) {
  const detailRows = buildQuoteOptionPriceDetailRows(option);
  const fallbackSubtotal = Math.max(0, Number(option.subtotal || 0));
  const fallbackVat = Math.max(0, Number(option.vat_amount || 0));
  const total = getOptionTotal(option) ?? fallbackSubtotal + fallbackVat;

  return (
    <div className="mt-5 rounded-2xl border border-[var(--gold)]/35 bg-[#17130a] p-4">
      <p className="font-ui text-[0.68rem] font-bold uppercase tracking-[0.18em] text-[var(--gold)]">Price summary</p>
      <div className="mt-4 space-y-4 font-ui text-sm text-[#e8e8e8]">
        {detailRows.length > 0 ? (
          <>
            {detailRows.map((row) => (
              <div className="rounded-xl border border-white/10 bg-black/20 p-3" key={row.id}>
                <PriceRow label={row.label} value={row.net} />
                <PriceRow label={`VAT on ${row.label.toLowerCase()}`} muted value={row.vat} />
                <PriceRow label={`${row.label} total`} muted value={row.gross} />
              </div>
            ))}
          </>
        ) : (
          <>
            <PriceRow label="Works subtotal" value={fallbackSubtotal} />
            <PriceRow label="VAT" muted value={fallbackVat} />
          </>
        )}
        <div className="flex items-end justify-between gap-4 border-t border-[var(--gold)]/30 pt-3">
          <span className="font-ui text-base font-bold text-white">Total including VAT</span>
          <strong className="shrink-0 font-display text-3xl text-[var(--gold-l)]">{currency(total)}</strong>
        </div>
      </div>
    </div>
  );
}

function PriceRow({ label, muted = false, value }: { label: string; muted?: boolean; value: number }) {
  return (
    <div className={`flex justify-between gap-4 ${muted ? "text-[#a8a8a8]" : "text-[#f2f2f2]"}`}>
      <span className="max-w-[68%]">{label}</span>
      <strong className="shrink-0 text-right text-white">{currency(value)}</strong>
    </div>
  );
}

function QuoteSection({ children, intro, title }: { children: ReactNode; intro?: string; title: string }) {
  return (
    <section className="rounded-3xl border border-[var(--border)] bg-black/20 p-5 md:p-7">
      <p className="section-kicker text-[0.68rem] uppercase text-[var(--gold)]">{title}</p>
      {intro ? <p className="mt-2 font-ui text-base leading-7 text-[var(--text-muted)]">{intro}</p> : null}
      <div className="mt-5 space-y-5 text-lg leading-9 text-[var(--text-second)] md:text-xl md:leading-10">{children}</div>
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
                <li className="flex gap-3 font-ui text-lg leading-9 text-[var(--text-second)] md:text-xl md:leading-10" key={item}>
                  <span className="mt-3 h-2 w-2 shrink-0 rounded-full bg-[var(--gold)]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          );
        }

        return (
          <p className={compact ? "font-ui text-base leading-7 text-[#d8d8d8]" : "font-ui text-lg leading-9 text-[var(--text-second)] md:text-xl md:leading-10"} key={`p-${index}`}>
            {block.text}
          </p>
        );
      })}
    </>
  );
}

function hasReadableText(value?: string | null) {
  return toReadableBlocks(value).some((block) => (block.kind === "paragraph" ? block.text.trim().length > 0 : block.items.length > 0));
}

type ReadableBlock = { kind: "paragraph"; text: string } | { kind: "list"; items: string[] };

function toReadableBlocks(value?: string | null): ReadableBlock[] {
  const text = value?.replace(/\r\n/g, "\n").trim();
  if (!text) return [];

  const rawBlocks = text.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);
  const blocks: ReadableBlock[] = [];

  rawBlocks.forEach((block) => {
    const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
    const listLines = lines.filter((line) => /^[-*\u2022]|\d+[.)]/.test(line));

    if (listLines.length >= Math.max(1, lines.length - 1)) {
      blocks.push({
        kind: "list",
        items: lines.map((line) => line.replace(/^[-*\u2022]\s*/, "").replace(/^\d+[.)]\s*/, "")).filter(Boolean)
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
