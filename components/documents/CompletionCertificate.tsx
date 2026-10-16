import { AddressBlock } from "@/components/documents/shared/AddressBlock";
import { DocFooter } from "@/components/documents/shared/DocFooter";
import { DocHeader } from "@/components/documents/shared/DocHeader";
import { DocumentCallout, StructuredText } from "@/components/documents/shared/DocumentContent";
import { DocumentBody, DocumentFrame, paragraphStyle } from "@/components/documents/shared/DocumentFrame";
import { MetaStrip } from "@/components/documents/shared/MetaStrip";
import { SectionHead } from "@/components/documents/shared/SectionHead";
import { DOC } from "@/lib/theme/documentTheme";
import { formatDate } from "@/lib/utils";
import type { JobBundle } from "@/lib/types";

export function CompletionCertificate({ bundle }: { bundle: JobBundle }) {
  const completedAt = bundle.job.completed_at;
  const completedLabel = completedAt ? formatDate(completedAt) : "To be confirmed from the actual site completion record";
  const guaranteeYears = bundle.completion_details?.warranty_years ?? extractGuaranteeYears(bundle.quote?.guarantee_text) ?? 15;
  const guaranteeEnd = completedAt ? new Date(completedAt) : null;
  guaranteeEnd?.setFullYear(guaranteeEnd.getFullYear() + guaranteeYears);

  return (
    <DocumentFrame>
      <DocHeader title="Completion Certificate" reference={`CC-${bundle.job.job_ref ?? bundle.job.id}`} subtitle={bundle.job.job_title} meta={`Completed ${completedLabel}`} />
      <DocumentBody>
        <MetaStrip
          items={[
            { label: "Job Ref", value: bundle.job.job_ref },
            { label: "Completion Date", value: completedLabel },
            { label: "Guarantee", value: `${guaranteeYears} ${guaranteeYears === 1 ? "Year" : "Years"}` },
            { label: "Expiry", value: guaranteeEnd ? formatDate(guaranteeEnd.toISOString()) : "Confirmed when completion date is recorded" }
          ]}
        />
        <DocumentCallout eyebrow="Certificate of completion" tone="success">
          <p style={{ ...paragraphStyle, fontSize: 20, margin: 0 }}>
            This certifies that We Are Roofing UK Ltd has completed the roofing works at the property below in accordance with the agreed scope.
          </p>
        </DocumentCallout>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <AddressBlock label="Property Owner" lines={[bundle.customer.full_name, bundle.customer.phone, bundle.customer.email]} />
          <AddressBlock label="Property Address" lines={[bundle.job.property_address, bundle.job.postcode, bundle.customer.town]} />
        </div>
        <SectionHead>Works Completed</SectionHead>
        <StructuredText value={bundle.completion_details?.works_summary || bundle.quote?.scope_of_works || bundle.survey?.recommended_works || bundle.job.job_title} />
        {completedVariations(bundle).length ? (
          <>
            <SectionHead>Additional Work Completed</SectionHead>
            <div style={{ display: "grid", gap: 8 }}>
              {completedVariations(bundle).map((variation) => (
                <div key={variation.id} style={{ border: `1px solid ${DOC.lightRule}`, borderRadius: 10, padding: 12 }}>
                  <strong style={{ color: DOC.body, fontFamily: DOC.fontSans, fontSize: 12 }}>{variation.variation_ref} · {variation.title}</strong>
                  {variation.description ? <p style={{ ...paragraphStyle, margin: "6px 0 0" }}>{variation.description}</p> : null}
                  {variation.line_items?.length ? <ul style={{ ...paragraphStyle, margin: "6px 0 0", paddingLeft: 20 }}>{variation.line_items.map((line) => <li key={line.id}>{line.description}</li>)}</ul> : null}
                </div>
              ))}
            </div>
          </>
        ) : null}
        <SectionHead>Installed Roofing System & Products</SectionHead>
        <StructuredText value={bundle.completion_details?.installed_system || bundle.survey?.recommended_works || bundle.job.roof_type || bundle.job.job_title} />
        <StructuredText value={bundle.completion_details?.product_details || bundle.materials.map((material) => `${material.item_name}${material.supplier ? ` — ${material.supplier}` : ""}${material.quantity ? ` (${material.quantity} ${material.unit || ""})` : ""}${material.notes ? `: ${material.notes}` : ""}`).join("\n") || "Product and manufacturer references were not recorded."} />
        <div style={{ marginTop: 22, background: DOC.dark, color: DOC.white, borderRadius: 14, padding: 20 }}>
          <div style={{ color: DOC.gold, fontFamily: DOC.fontSans, fontSize: 11, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase" }}>{guaranteeYears} Year Workmanship Guarantee</div>
          <p style={{ margin: "12px 0 0", color: "#e8e4da", fontFamily: DOC.fontSerif, fontSize: 16, lineHeight: 1.7 }}>
            Guarantee starts {completedLabel}{guaranteeEnd ? ` and expires ${formatDate(guaranteeEnd.toISOString())}` : " and expires after the verified completion date is recorded"}. Certificate number CC-{bundle.job.job_ref ?? bundle.job.id}.
          </p>
          {bundle.completion_details?.warranty_details || bundle.quote?.guarantee_text ? <p style={{ margin: "10px 0 0", color: "#cfc8b8", fontFamily: DOC.fontSerif, fontSize: 14, lineHeight: 1.65 }}>{bundle.completion_details?.warranty_details || bundle.quote?.guarantee_text}</p> : null}
        </div>
        <SectionHead>Signatures</SectionHead>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
          <Signature label="We Are Roofing UK Ltd" />
          <Signature label="Customer Acknowledgement" />
        </div>
      </DocumentBody>
      <DocFooter business={bundle.business} />
    </DocumentFrame>
  );
}

function completedVariations(bundle: JobBundle) {
  const accepted = bundle.variations.filter((variation) => ["Accepted", "Invoiced", "Paid"].includes(variation.status));
  const ids = bundle.completion_details?.included_variation_ids ?? accepted.map((variation) => variation.id);
  return accepted.filter((variation) => ids.includes(variation.id));
}

function extractGuaranteeYears(value?: string | null) {
  const match = value?.match(/\b(\d{1,2})\s*[- ]?years?\b/i);
  if (!match) return null;
  const years = Number(match[1]);
  return Number.isFinite(years) && years > 0 && years <= 50 ? years : null;
}

function Signature({ label }: { label: string }) {
  return (
    <div style={{ paddingTop: 42, borderBottom: `1px solid ${DOC.body}` }}>
      <p style={{ color: DOC.muted, fontFamily: DOC.fontSans, fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>{label}</p>
    </div>
  );
}
