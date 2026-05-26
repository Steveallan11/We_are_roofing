import { AddressBlock } from "@/components/documents/shared/AddressBlock";
import { DocFooter } from "@/components/documents/shared/DocFooter";
import { DocHeader } from "@/components/documents/shared/DocHeader";
import { DocumentBody, DocumentFrame, paragraphStyle } from "@/components/documents/shared/DocumentFrame";
import { LineItemTable } from "@/components/documents/shared/LineItemTable";
import { MetaStrip } from "@/components/documents/shared/MetaStrip";
import { SectionHead } from "@/components/documents/shared/SectionHead";
import { getQuotePipelineValue } from "@/lib/quotes/value";
import { getSurveyHighlights, getSurveyMeasurementsSummary } from "@/lib/survey-utils";
import { currency, formatDate } from "@/lib/utils";
import type { JobBundle } from "@/lib/types";

export function SurveyReportDocument({ bundle }: { bundle: JobBundle }) {
  const survey = bundle.survey;
  const adaptive = survey?.adaptive_sections ? Object.entries(survey.adaptive_sections) : [];
  const findings = adaptive.flatMap(([section, value]) =>
    Object.entries((value ?? {}) as Record<string, unknown>)
      .filter(([, item]) => item != null && item !== "" && !(Array.isArray(item) && item.length === 0))
      .slice(0, 8)
      .map(([key, item]) => ({
        description: humanize(`${section} ${key}`),
        notes: Array.isArray(item) ? item.join(", ") : String(item)
      }))
  );
  const findingRows = findings.length ? findings : getSurveyHighlights(survey).map((item) => ({ description: item, notes: "" }));

  return (
    <DocumentFrame>
      <DocHeader title="Survey Report" reference={`SR-${bundle.job.job_ref ?? bundle.job.id}`} subtitle={bundle.job.job_title} meta={formatDate(survey?.updated_at ?? survey?.created_at)} />
      <DocumentBody>
        <MetaStrip
          items={[
            { label: "Property", value: bundle.job.postcode || bundle.customer.town },
            { label: "Job Ref", value: bundle.job.job_ref },
            { label: "Survey Type", value: survey?.survey_type || "Site Survey" },
            { label: "Surveyor", value: survey?.surveyor_name || "Andy" }
          ]}
        />
        <AddressBlock label="Customer Contact" lines={[bundle.customer.full_name, bundle.customer.phone, bundle.customer.email, bundle.job.property_address]} />
        <SectionHead>Introduction</SectionHead>
        <p style={paragraphStyle}>{survey?.problem_observed || survey?.raw_notes || "Survey information has not been captured yet."}</p>
        <SectionHead>Condition Findings</SectionHead>
        <LineItemTable
          rows={findingRows.map((item) => ({
            description: item.description,
            notes: item.notes
          }))}
        />
        <SectionHead>Measurements</SectionHead>
        <p style={paragraphStyle}>{getSurveyMeasurementsSummary(survey)}</p>
        <SectionHead>Recommended Works</SectionHead>
        <p style={paragraphStyle}>{survey?.recommended_works || "Recommended works to be confirmed."}</p>
        {bundle.quote ? (
          <>
            <SectionHead>Indicative Budget</SectionHead>
            <p style={paragraphStyle}>{currency(getQuotePipelineValue(bundle.quote) ?? 0)} based on the current quote draft {bundle.quote.quote_ref}.</p>
          </>
        ) : null}
      </DocumentBody>
      <DocFooter business={bundle.business} />
    </DocumentFrame>
  );
}

function humanize(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}
