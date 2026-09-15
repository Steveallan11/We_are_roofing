import { AddressBlock } from "@/components/documents/shared/AddressBlock";
import { DocFooter } from "@/components/documents/shared/DocFooter";
import { DocHeader } from "@/components/documents/shared/DocHeader";
import { DocumentCallout, DocumentGuide, StructuredText } from "@/components/documents/shared/DocumentContent";
import { DocumentBody, DocumentFrame } from "@/components/documents/shared/DocumentFrame";
import { LineItemTable } from "@/components/documents/shared/LineItemTable";
import { SectionHead } from "@/components/documents/shared/SectionHead";
import { formatLineAmountForDisplay, getOptionTotal, getQuotePipelineValue, isQuoteFromOptionValue } from "@/lib/quotes/value";
import { DOC } from "@/lib/theme/documentTheme";
import { currency, formatDate } from "@/lib/utils";
import type { JobBundle, QuoteRecord } from "@/lib/types";

export function QuoteDocument({ bundle, quote }: { bundle: JobBundle; quote: QuoteRecord }) {
  const visibleLineItems = quote.cost_breakdown.filter((line) => Number(line.cost ?? 0) > 0);
  const displayTotal = getQuotePipelineValue(quote) ?? 0;

  return (
    <DocumentFrame>
      <DocHeader title="Quotation" reference={quote.quote_ref} subtitle={bundle.business.trading_address} meta={`Issued ${formatDate(quote.created_at)}`} />
      <DocumentBody>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <AddressBlock label="Customer" lines={[bundle.customer.full_name, bundle.customer.email, bundle.customer.phone]} />
          <AddressBlock label="Site Address" lines={[bundle.job.property_address, bundle.job.postcode, bundle.customer.town]} />
        </div>
        <div style={{ borderBottom: `1px solid ${DOC.lightRule}`, marginTop: 26, paddingBottom: 18 }}>
          <p style={{ color: DOC.gold, fontFamily: DOC.fontSans, fontSize: 9, fontWeight: 800, letterSpacing: "0.16em", margin: "0 0 7px", textTransform: "uppercase" }}>Proposed roofing works</p>
          <h2 style={{ margin: 0, color: DOC.body, fontFamily: DOC.fontSans, fontSize: 30, lineHeight: 1.15 }}>{bundle.job.job_title}</h2>
          <p style={{ color: DOC.muted, fontFamily: DOC.fontSerif, fontSize: 16, lineHeight: 1.5, margin: "7px 0 0" }}>{bundle.job.roof_type ?? "Roofing works"}</p>
        </div>
        <DocumentCallout eyebrow="How to read this quote">
          Start with our findings and recommendation, then review the proposed work and price. Exclusions, guarantees and terms are grouped at the end so it is clear what is included before you accept.
        </DocumentCallout>
        <DocumentGuide items={["Roof condition", "Our recommendation", "Scope of works", quote.options?.length ? "Options and pricing" : "Price summary", "Guarantee and acceptance", "Exclusions and terms"]} />
        <SectionHead>Roof Condition Report</SectionHead>
        <StructuredText value={quote.roof_report} />
        <SectionHead>Our Recommendation</SectionHead>
        <StructuredText value={bundle.survey?.recommended_works || quote.scope_of_works} />
        <SectionHead>Scope of Works</SectionHead>
        <StructuredText value={quote.scope_of_works} />
        <SectionHead>{quote.options?.length ? "Options & Pricing" : "Price Summary"}</SectionHead>
        {quote.options?.length ? (
          <div style={{ display: "grid", gridTemplateColumns: quote.options.length > 1 ? "1fr 1fr" : "1fr", gap: 14 }}>
            {quote.options.map((option) => (
              <div key={option.id} style={{ border: `2px solid ${option.recommended ? DOC.gold : DOC.lightRule}`, borderRadius: 14, padding: 14 }}>
                {option.recommended ? <p style={{ margin: 0, color: DOC.gold, fontFamily: DOC.fontSans, fontSize: 9, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase" }}>Recommended</p> : null}
                <h3 style={{ margin: "8px 0 4px", color: DOC.body, fontFamily: DOC.fontSerif, fontSize: 22 }}>{option.label}</h3>
                <StructuredText value={option.description} fallback="Review the included work and price below." />
                <OptionLineSummary option={option} />
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
              amount: formatLineAmountForDisplay(line)
            }))}
            totals={[
              { label: "Subtotal", value: currency(quote.subtotal) },
              { label: "VAT", value: currency(quote.vat_amount) },
              { label: isQuoteFromOptionValue(quote) ? "From" : "Total", value: currency(displayTotal), strong: true }
            ]}
          />
        )}
        <SectionHead>Guarantee, Notes & Acceptance</SectionHead>
        <StructuredText value={quote.guarantee_text} />
        <DocumentCallout eyebrow="Ready to proceed?" title="Accept this quotation" tone="dark">
          <p style={{ margin: 0 }}>
            To accept this quotation, use the secure link in the email or reply confirming you are happy for We Are Roofing UK Ltd to proceed. We will then agree booking dates, access, and any scaffold arrangements.
          </p>
        </DocumentCallout>
        {quote.exclusions ? (
          <>
            <SectionHead>Exclusions</SectionHead>
            <StructuredText value={quote.exclusions} />
          </>
        ) : null}
        <SectionHead>Terms</SectionHead>
        <StructuredText value={quote.terms} />
      </DocumentBody>
      <DocFooter business={bundle.business} />
    </DocumentFrame>
  );
}

function buildLineNotes(line: QuoteRecord["cost_breakdown"][number]) {
  const directNote = line.billed_separately ? line.billed_separately_note?.trim() || "Paid directly to the supplier — not included in this total." : null;
  return [line.measurement_label, line.quote_section ? line.item : null, directNote, line.notes].filter(Boolean).join(" - ");
}

function OptionLineSummary({ option }: { option: NonNullable<QuoteRecord["options"]>[number] }) {
  const lines = (option.cost_breakdown ?? []).filter((line) => Number(line.cost ?? 0) > 0);

  return (
    <div style={{ marginTop: 12, fontFamily: DOC.fontSans }}>
      {lines.map((line, index) => (
        <div key={`${option.id}-${line.item}-${index}`} style={{ borderTop: `1px solid ${DOC.lightRule}`, padding: "8px 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <div>
              <div style={{ color: DOC.body, fontSize: 12, fontWeight: 800 }}>{customerLabel(line.quote_section || line.item)}</div>
              <div style={{ color: DOC.muted, fontFamily: DOC.fontSerif, fontSize: 12, lineHeight: 1.5 }}>
                {[
                  line.quote_section ? line.item : null,
                  line.measurement_label,
                  line.billed_separately ? line.billed_separately_note?.trim() || "Paid directly to the supplier — not in this total." : null
                ]
                  .filter(Boolean)
                  .join(" - ")}
              </div>
            </div>
            <strong style={{ color: DOC.gold, fontSize: 12, whiteSpace: "nowrap" }}>{formatLineAmountForDisplay(line)}</strong>
          </div>
        </div>
      ))}
      <div style={{ background: "#fbf6e8", border: `1px solid ${DOC.lightRule}`, borderRadius: 10, marginTop: 10, padding: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, paddingBottom: 4 }}>
          <span>Subtotal</span>
          <strong>{currency(option.subtotal)}</strong>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, paddingBottom: 6 }}>
          <span>VAT</span>
          <strong>{currency(option.vat_amount)}</strong>
        </div>
        <div style={{ borderTop: `1px solid ${DOC.lightRule}`, color: DOC.gold, display: "flex", fontSize: 18, fontWeight: 800, justifyContent: "space-between", paddingTop: 8 }}>
          <span>Total</span>
          <span>{currency(getOptionTotal(option) ?? 0)}</span>
        </div>
      </div>
    </div>
  );
}

function customerLabel(value: string) {
  const known: Record<string, string> = {
    access: "Access & scaffolding",
    labour: "Labour",
    materials: "Materials",
    roof_works: "Roofing works"
  };
  const key = value.trim().toLowerCase();
  return known[key] || value.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}
