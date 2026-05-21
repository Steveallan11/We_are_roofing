import { AddressBlock } from "@/components/documents/shared/AddressBlock";
import { DocFooter } from "@/components/documents/shared/DocFooter";
import { DocHeader } from "@/components/documents/shared/DocHeader";
import { DocumentBody, DocumentFrame, paragraphStyle } from "@/components/documents/shared/DocumentFrame";
import { LineItemTable } from "@/components/documents/shared/LineItemTable";
import { SectionHead } from "@/components/documents/shared/SectionHead";
import { DOC } from "@/lib/theme/documentTheme";
import { currency, formatDate } from "@/lib/utils";
import type { JobBundle, QuoteRecord } from "@/lib/types";

export function QuoteDocument({ bundle, quote }: { bundle: JobBundle; quote: QuoteRecord }) {
  const visibleLineItems = quote.cost_breakdown.filter((line) => Number(line.cost ?? 0) > 0);

  return (
    <DocumentFrame>
      <DocHeader title="Quotation" reference={quote.quote_ref} subtitle={bundle.business.trading_address} meta={`Issued ${formatDate(quote.created_at)}`} />
      <DocumentBody>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <AddressBlock label="Customer" lines={[bundle.customer.full_name, bundle.customer.email, bundle.customer.phone]} />
          <AddressBlock label="Site Address" lines={[bundle.job.property_address, bundle.job.postcode, bundle.customer.town]} />
        </div>
        <div style={{ borderLeft: `4px solid ${DOC.gold}`, paddingLeft: 16, marginTop: 24 }}>
          <h2 style={{ margin: 0, color: DOC.body, fontFamily: DOC.fontSerif, fontSize: 30 }}>{bundle.job.job_title}</h2>
          <p style={{ ...paragraphStyle, color: DOC.muted, marginTop: 4 }}>{bundle.job.roof_type ?? "Roofing works"}</p>
        </div>
        <div style={{ background: "#fbf6e8", border: `1px solid ${DOC.lightRule}`, borderLeft: `4px solid ${DOC.gold}`, borderRadius: 12, marginTop: 22, padding: 18 }}>
          <p style={{ margin: 0, color: DOC.gold, fontFamily: DOC.fontSans, fontSize: 10, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase" }}>
            How to read this quote
          </p>
          <p style={{ ...paragraphStyle, fontSize: 15, lineHeight: 1.75, margin: "8px 0 0" }}>
            This quotation is structured in three parts: the roof report, the proposed scope of works, and the priced sections. Measurements from the takeoff are shown beside the relevant price lines where available.
          </p>
        </div>
        <SectionHead>Roof Condition Report</SectionHead>
        {renderParagraphs(quote.roof_report)}
        <SectionHead>Scope of Works & Pricing</SectionHead>
        {renderParagraphs(quote.scope_of_works)}
        {quote.options?.length ? (
          <div style={{ display: "grid", gridTemplateColumns: quote.options.length > 1 ? "1fr 1fr" : "1fr", gap: 14 }}>
            {quote.options.map((option) => (
              <div key={option.id} style={{ border: `2px solid ${option.recommended ? DOC.gold : DOC.lightRule}`, borderRadius: 14, padding: 14 }}>
                {option.recommended ? <p style={{ margin: 0, color: DOC.gold, fontFamily: DOC.fontSans, fontSize: 9, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase" }}>Recommended</p> : null}
                <h3 style={{ margin: "8px 0 4px", color: DOC.body, fontFamily: DOC.fontSerif, fontSize: 22 }}>{option.label}</h3>
                {renderParagraphs(option.description)}
                <p style={{ margin: 0, color: DOC.gold, fontFamily: DOC.fontSerif, fontSize: 26, fontWeight: 700 }}>{currency(option.total)}</p>
              </div>
            ))}
          </div>
        ) : (
          <LineItemTable
            rows={visibleLineItems.map((line) => ({
              description: line.quote_section || line.item,
              notes: buildLineNotes(line),
              quantity: line.quantity,
              unit: line.unit,
              amount: currency(line.cost)
            }))}
            totals={[
              { label: "Subtotal", value: currency(quote.subtotal) },
              { label: "VAT", value: currency(quote.vat_amount) },
              { label: "Total", value: currency(quote.total), strong: true }
            ]}
          />
        )}
        <SectionHead>Guarantee, Notes & Acceptance</SectionHead>
        {renderParagraphs(quote.guarantee_text)}
        <div style={{ marginTop: 16, background: "#f2eddf", borderLeft: `4px solid ${DOC.gold}`, padding: 16, borderRadius: 12 }}>
          <p style={{ ...paragraphStyle, fontSize: 15, lineHeight: 1.75 }}>
            To accept this quotation, use the secure link in the email or reply confirming you are happy for We Are Roofing UK Ltd to proceed. We will then agree booking dates, access, and any scaffold arrangements.
          </p>
        </div>
        {quote.exclusions ? (
          <>
            <SectionHead>Exclusions</SectionHead>
            {renderParagraphs(quote.exclusions)}
          </>
        ) : null}
        <SectionHead>Terms</SectionHead>
        {renderParagraphs(quote.terms)}
      </DocumentBody>
      <DocFooter business={bundle.business} />
    </DocumentFrame>
  );
}

function renderParagraphs(value?: string | null) {
  const paragraphs = splitDocumentText(value);
  if (!paragraphs.length) {
    return <p style={{ ...paragraphStyle, fontSize: 15, lineHeight: 1.75 }}>To be confirmed.</p>;
  }

  return paragraphs.map((paragraph, index) => (
    <p key={`${paragraph.slice(0, 18)}-${index}`} style={{ ...paragraphStyle, fontSize: 15, lineHeight: 1.75, margin: index === 0 ? "0 0 12px" : "12px 0" }}>
      {paragraph}
    </p>
  ));
}

function splitDocumentText(value?: string | null) {
  const text = value?.replace(/\r\n/g, "\n").trim();
  if (!text) return [];

  return text
    .split(/\n{2,}/)
    .map((block) => block.trim().replace(/\n/g, " "))
    .filter(Boolean)
    .flatMap(splitLongParagraph);
}

function splitLongParagraph(text: string) {
  if (text.length < 340) return [text];
  const sentences = text.match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g)?.map((sentence) => sentence.trim()).filter(Boolean) ?? [text];
  const paragraphs: string[] = [];
  let current = "";

  sentences.forEach((sentence) => {
    const next = current ? `${current} ${sentence}` : sentence;
    if (next.length > 280 && current) {
      paragraphs.push(current);
      current = sentence;
      return;
    }
    current = next;
  });

  if (current) paragraphs.push(current);
  return paragraphs;
}

function buildLineNotes(line: QuoteRecord["cost_breakdown"][number]) {
  return [line.measurement_label, line.quote_section ? line.item : null, line.notes].filter(Boolean).join(" - ");
}
