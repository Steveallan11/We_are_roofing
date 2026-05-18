import { AddressBlock } from "@/components/documents/shared/AddressBlock";
import { DocFooter } from "@/components/documents/shared/DocFooter";
import { DocHeader } from "@/components/documents/shared/DocHeader";
import { DocumentBody, DocumentFrame, paragraphStyle } from "@/components/documents/shared/DocumentFrame";
import { MetaStrip } from "@/components/documents/shared/MetaStrip";
import { SectionHead } from "@/components/documents/shared/SectionHead";
import { DOC } from "@/lib/theme/documentTheme";
import { formatDate } from "@/lib/utils";
import type { JobBundle } from "@/lib/types";

export function CompletionCertificate({ bundle }: { bundle: JobBundle }) {
  const completedAt = bundle.job.completed_at || new Date().toISOString();
  const guaranteeEnd = new Date(completedAt);
  guaranteeEnd.setFullYear(guaranteeEnd.getFullYear() + 10);

  return (
    <DocumentFrame>
      <DocHeader title="Completion Certificate" reference={`CC-${bundle.job.job_ref ?? bundle.job.id}`} subtitle={bundle.job.job_title} meta={`Completed ${formatDate(completedAt)}`} />
      <DocumentBody>
        <MetaStrip
          items={[
            { label: "Job Ref", value: bundle.job.job_ref },
            { label: "Completion Date", value: formatDate(completedAt) },
            { label: "Guarantee", value: "10 Years" },
            { label: "Expiry", value: formatDate(guaranteeEnd.toISOString()) }
          ]}
        />
        <div style={{ borderTop: `2px solid ${DOC.gold}`, borderBottom: `2px solid ${DOC.gold}`, padding: "28px 18px", textAlign: "center", margin: "24px 0" }}>
          <p style={{ ...paragraphStyle, fontSize: 22 }}>
            This certifies that We Are Roofing UK Ltd has completed the roofing works at the property below in accordance with the agreed scope.
          </p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <AddressBlock label="Property Owner" lines={[bundle.customer.full_name, bundle.customer.phone, bundle.customer.email]} />
          <AddressBlock label="Property Address" lines={[bundle.job.property_address, bundle.job.postcode, bundle.customer.town]} />
        </div>
        <SectionHead>Works Completed</SectionHead>
        <p style={paragraphStyle}>{bundle.quote?.scope_of_works || bundle.survey?.recommended_works || bundle.job.job_title}</p>
        <div style={{ marginTop: 22, background: DOC.dark, color: DOC.white, borderRadius: 14, padding: 20 }}>
          <div style={{ color: DOC.gold, fontFamily: DOC.fontSans, fontSize: 11, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase" }}>10 Year Workmanship Guarantee</div>
          <p style={{ margin: "12px 0 0", color: "#e8e4da", fontFamily: DOC.fontSerif, fontSize: 16, lineHeight: 1.7 }}>
            Guarantee starts {formatDate(completedAt)} and expires {formatDate(guaranteeEnd.toISOString())}. Certificate number CC-{bundle.job.job_ref ?? bundle.job.id}.
          </p>
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

function Signature({ label }: { label: string }) {
  return (
    <div style={{ paddingTop: 42, borderBottom: `1px solid ${DOC.body}` }}>
      <p style={{ color: DOC.muted, fontFamily: DOC.fontSans, fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>{label}</p>
    </div>
  );
}
