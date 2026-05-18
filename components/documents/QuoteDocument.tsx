import { AddressBlock } from "@/components/documents/shared/AddressBlock";
import { DocFooter } from "@/components/documents/shared/DocFooter";
import { DocHeader } from "@/components/documents/shared/DocHeader";
import { DocumentBody, DocumentFrame, paragraphStyle } from "@/components/documents/shared/DocumentFrame";
import { LineItemTable } from "@/components/documents/shared/LineItemTable";
import { MetaStrip } from "@/components/documents/shared/MetaStrip";
import { SectionHead } from "@/components/documents/shared/SectionHead";
import { DOC } from "@/lib/theme/documentTheme";
import { currency, formatDate } from "@/lib/utils";
import type { JobBundle, QuoteRecord } from "@/lib/types";

export function QuoteDocument({ bundle, quote }: { bundle: JobBundle; quote: QuoteRecord }) {
  return (
    <DocumentFrame>
      <DocHeader title="Quotation" reference={quote.quote_ref} subtitle={bundle.business.trading_address} meta={`Issued ${formatDate(quote.created_at)}`} />
      <DocumentBody>
        <MetaStrip
          items={[
            { label: "Job Ref", value: bundle.job.job_ref },
            { label: "Prepared By", value: "Andy - We Are Roofing" },
            { label: "Guarantee", value: quote.guarantee_text || "10 Year Workmanship" },
            { label: "Status", value: quote.status }
          ]}
        />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <AddressBlock label="Customer" lines={[bundle.customer.full_name, bundle.customer.email, bundle.customer.phone]} />
          <AddressBlock label="Site Address" lines={[bundle.job.property_address, bundle.job.postcode, bundle.customer.town]} />
        </div>
        <div style={{ borderLeft: `4px solid ${DOC.gold}`, paddingLeft: 16, marginTop: 24 }}>
          <h2 style={{ margin: 0, color: DOC.body, fontFamily: DOC.fontSerif, fontSize: 30 }}>{bundle.job.job_title}</h2>
          <p style={{ ...paragraphStyle, color: DOC.muted, marginTop: 4 }}>{bundle.job.roof_type ?? "Roofing works"}</p>
        </div>
        <SectionHead>Roof Condition Report</SectionHead>
        <p style={paragraphStyle}>{quote.roof_report}</p>
        <SectionHead>Scope of Works & Pricing</SectionHead>
        <p style={{ ...paragraphStyle, marginBottom: 14 }}>{quote.scope_of_works}</p>
        {quote.options?.length ? (
          <div style={{ display: "grid", gridTemplateColumns: quote.options.length > 1 ? "1fr 1fr" : "1fr", gap: 14 }}>
            {quote.options.map((option) => (
              <div key={option.id} style={{ border: `2px solid ${option.recommended ? DOC.gold : DOC.lightRule}`, borderRadius: 14, padding: 14 }}>
                {option.recommended ? <p style={{ margin: 0, color: DOC.gold, fontFamily: DOC.fontSans, fontSize: 9, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase" }}>Recommended</p> : null}
                <h3 style={{ margin: "8px 0 4px", color: DOC.body, fontFamily: DOC.fontSerif, fontSize: 22 }}>{option.label}</h3>
                <p style={{ ...paragraphStyle, margin: "0 0 10px" }}>{option.description}</p>
                <p style={{ margin: 0, color: DOC.gold, fontFamily: DOC.fontSerif, fontSize: 26, fontWeight: 700 }}>{currency(option.total)}</p>
              </div>
            ))}
          </div>
        ) : (
          <LineItemTable
            rows={quote.cost_breakdown.map((line) => ({
              description: line.item,
              notes: Number(line.cost || 0) === 0 ? `${line.notes || ""} Rate not set - check Rate Card.`.trim() : line.notes,
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
        <p style={paragraphStyle}>{quote.guarantee_text}</p>
        <div style={{ marginTop: 16, background: "#f2eddf", borderLeft: `4px solid ${DOC.gold}`, padding: 16, borderRadius: 12 }}>
          <p style={paragraphStyle}>To accept this quotation, please reply confirming you are happy for We Are Roofing UK Ltd to proceed. We will then agree booking dates, access, and any scaffold arrangements.</p>
        </div>
        {quote.exclusions ? (
          <>
            <SectionHead>Exclusions</SectionHead>
            <p style={paragraphStyle}>{quote.exclusions}</p>
          </>
        ) : null}
        <SectionHead>Terms</SectionHead>
        <p style={paragraphStyle}>{quote.terms}</p>
      </DocumentBody>
      <DocFooter business={bundle.business} />
    </DocumentFrame>
  );
}
