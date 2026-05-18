import { AddressBlock } from "@/components/documents/shared/AddressBlock";
import { DocFooter } from "@/components/documents/shared/DocFooter";
import { DocHeader } from "@/components/documents/shared/DocHeader";
import { DocumentBody, DocumentFrame, paragraphStyle } from "@/components/documents/shared/DocumentFrame";
import { LineItemTable } from "@/components/documents/shared/LineItemTable";
import { MetaStrip } from "@/components/documents/shared/MetaStrip";
import { SectionHead } from "@/components/documents/shared/SectionHead";
import { formatDate } from "@/lib/utils";
import type { JobBundle } from "@/lib/types";

export function JobSheetDocument({ bundle }: { bundle: JobBundle }) {
  return (
    <DocumentFrame>
      <DocHeader title="Job Sheet" reference={bundle.job.job_ref ?? bundle.job.id} subtitle={bundle.job.job_title} meta={bundle.job.survey_date ? `Survey ${formatDate(bundle.job.survey_date)}` : "Site working copy"} />
      <DocumentBody>
        <MetaStrip
          items={[
            { label: "Crew Lead", value: "Andy" },
            { label: "Job Type", value: bundle.job.job_type },
            { label: "Roof Type", value: bundle.job.roof_type },
            { label: "Scaffold", value: bundle.survey?.scaffold_required ? "Required" : "TBC" }
          ]}
        />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <AddressBlock label="Customer" lines={[bundle.customer.full_name, bundle.customer.phone, bundle.customer.email]} />
          <AddressBlock label="Site" lines={[bundle.job.property_address, bundle.job.postcode, bundle.survey?.access_notes]} />
        </div>
        <SectionHead>Works Description</SectionHead>
        <p style={paragraphStyle}>{bundle.quote?.scope_of_works || bundle.survey?.recommended_works || bundle.job.internal_notes || "Works to be confirmed from survey and accepted quote."}</p>
        <SectionHead>Materials Checklist</SectionHead>
        <LineItemTable
          rows={(bundle.materials.length ? bundle.materials : []).map((material) => ({
            description: material.item_name,
            notes: material.required_status,
            quantity: material.quantity,
            unit: material.unit,
            amount: material.supplier ?? ""
          }))}
        />
        {bundle.materials.length === 0 ? <p style={paragraphStyle}>Materials will be confirmed from the accepted quote and supplier requirements.</p> : null}
        <SectionHead>Safety & Completion Checklist</SectionHead>
        <p style={paragraphStyle}>{bundle.survey?.safety_notes || "Confirm access, ladder/scaffold setup, weather conditions, waste handling, and customer-specific risks before starting."}</p>
        <ul style={{ color: "#1a1a1a", fontFamily: "Helvetica, Arial, sans-serif", fontSize: 13, lineHeight: 1.9, marginTop: 12 }}>
          <li>☐ Site access confirmed</li>
          <li>☐ Materials checked</li>
          <li>☐ Photos before / during / after works</li>
          <li>☐ Customer walkthrough completed</li>
        </ul>
      </DocumentBody>
      <DocFooter business={bundle.business} />
    </DocumentFrame>
  );
}
