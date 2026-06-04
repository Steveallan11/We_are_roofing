"use client";

import * as React from "react";
import Link from "next/link";
import type { Route } from "next";
import { useSearchParams, useRouter, usePathname } from "next/navigation";

import { CustomerContactEditor } from "@/components/customers/customer-contact-editor";
import { JobDocumentsSection } from "@/components/documents/JobDocumentsSection";
import { DocumentUploadButton } from "@/components/forms/document-upload";
import { PhotoUploadButton } from "@/components/forms/photo-upload";
import { DeleteJobAction } from "@/components/jobs/delete-job-action";
import { InvoiceActions } from "@/components/jobs/invoice-actions";
import { JobTitleEditor } from "@/components/jobs/job-title-editor";
import { PaymentSchedule } from "@/components/jobs/PaymentSchedule";
import { ScheduleWorks } from "@/components/jobs/ScheduleWorks";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { FieldActionBar } from "@/components/jobs/FieldActionBar";
import { NurtureSequenceStatus } from "@/components/jobs/NurtureSequenceStatus";

import {
  Badge,
  Button,
  Card,
  CardKicker,
  PageSection,
  Stat,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from "@/components/ui/primitives";

import { getJobStage, getStageColor } from "@/lib/jobs/statusColors";
import { getNextActionLabel } from "@/lib/job-workflow";
import { getNextAction } from "@/lib/jobs/nextAction";
import { getJobDocumentHref } from "@/lib/documents";
import { buildQuoteOptionPriceSummary, getJobPipelineValue, getOptionTotal, getQuotePipelineValue, isFromOptionValue } from "@/lib/quotes/value";
import { getSurveyHighlights, getSurveyMeasurementsSummary } from "@/lib/survey-utils";
import { currency, formatDate, cn } from "@/lib/utils";
import { ActivityTimeline } from "@/components/activity/ActivityTimeline";
import { NextActionButton } from "@/components/jobs/NextActionButton";
import type { ActivityRecord } from "@/lib/activity/types";
import {
  getDocumentDisplayType,
  groupDocuments,
  formatFileSize,
  summarizeMaterials
} from "@/lib/jobs/jobDetail";
import type {
  Customer,
  EmailLog,
  InvoiceRecord,
  Job,
  JobDocumentRecord,
  JobPhoto,
  LabourPlanRecord,
  MaterialRecord,
  QuoteOption,
  QuoteRecord,
  SurveyRecord
} from "@/lib/types";

export type JobDetailViewProps = {
  job: Job;
  customer: Customer;
  survey?: SurveyRecord | null;
  quote?: QuoteRecord | null;
  documents: JobDocumentRecord[];
  photos: JobPhoto[];
  materials: MaterialRecord[];
  labourPlan?: LabourPlanRecord | null;
  invoices: InvoiceRecord[];
  emailLogs: EmailLog[];
  activity?: ActivityRecord[];
  paymentSchedule: React.ComponentProps<typeof PaymentSchedule>["initialSchedule"];
};

type TabId = "overview" | "survey" | "quote" | "materials" | "labour" | "documents" | "activity";

const TABS: { value: TabId; label: string }[] = [
  { value: "overview", label: "Overview" },
  { value: "survey", label: "Survey" },
  { value: "quote", label: "Quote" },
  { value: "materials", label: "Materials" },
  { value: "labour", label: "Labour" },
  { value: "documents", label: "Documents" },
  { value: "activity", label: "Activity" }
];

export function JobDetailView(props: JobDetailViewProps) {
  const { job, customer, survey, quote, documents, photos, materials, labourPlan, invoices, emailLogs, activity, paymentSchedule } = props;

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initialTab = (searchParams?.get("tab") as TabId) || "overview";
  const validInitialTab = TABS.find((t) => t.value === initialTab) ? initialTab : "overview";

  const handleTabChange = (value: string) => {
    const params = new URLSearchParams(searchParams?.toString());
    if (value === "overview") {
      params.delete("tab");
    } else {
      params.set("tab", value);
    }
    const query = params.toString();
    const url = `${pathname}${query ? `?${query}` : ""}`;
    router.replace(url as Route, { scroll: false });
  };

  const nextAction = getNextAction({ ...job, customer, quote: quote ?? null });
  const stage = getJobStage(job.status);
  const stageColors = getStageColor(stage);
  const commercialValue = getJobPipelineValue({ ...job, quote: quote ?? null });
  const commercialLabel = commercialValue
    ? `${isFromOptionValue({ ...job, quote: quote ?? null }) ? "From " : ""}${currency(commercialValue)}`
    : "TBC";

  return (
    <div className="stack pb-20 lg:pb-0">
      <JobDetailHeader
        job={job}
        customer={customer}
        nextAction={nextAction}
        stageColors={stageColors}
      />

      <MobileNextActionBar job={{ ...job, customer, quote: quote ?? null }} />

      <Tabs value={validInitialTab} onValueChange={handleTabChange} className="stack">
        <div className="sticky top-0 z-20 -mx-4 bg-[var(--ink)]/80 px-4 backdrop-blur-md md:relative md:mx-0 md:px-0 md:bg-transparent md:backdrop-blur-none">
          <TabsList>
            {TABS.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="overview">
          <OverviewTab
            job={job}
            customer={customer}
            survey={survey}
            documents={documents}
            commercialLabel={commercialLabel}
            quote={quote}
            paymentSchedule={paymentSchedule}
          />
        </TabsContent>

        <TabsContent value="survey">
          <SurveyTab job={job} survey={survey} documents={documents} photos={photos} />
        </TabsContent>

        <TabsContent value="quote">
          <QuoteTab job={job} quote={quote} />
        </TabsContent>

        <TabsContent value="materials">
          <MaterialsTab job={job} materials={materials} />
        </TabsContent>

        <TabsContent value="labour">
          <LabourTab job={job} labourPlan={labourPlan ?? null} />
        </TabsContent>

        <TabsContent value="documents">
          <DocumentsTab
            job={job}
            documents={documents}
            invoices={invoices}
            quote={quote}
            customer={customer}
          />
        </TabsContent>

        <TabsContent value="activity">
          <ActivityTab job={job} emailLogs={emailLogs} activity={activity ?? []} />
        </TabsContent>
      </Tabs>

      <FieldActionBar jobId={job.id} />
    </div>
  );
}

/* -----------------  Sticky header  ----------------- */

function JobDetailHeader({
  job,
  customer,
  nextAction,
  stageColors
}: {
  job: Job;
  customer: Customer;
  nextAction: ReturnType<typeof getNextAction>;
  stageColors: { bg: string; border: string; text: string };
}) {
  return (
    <Card padding="none">
      <div className="border-b border-[var(--border)] p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <CardKicker>{job.job_ref ?? "WR-J-TBC"}</CardKicker>
              <StatusBadge status={job.status} />
            </div>
            <div className="mt-3">
              <JobTitleEditor jobId={job.id} jobRef={job.job_ref} title={job.job_title} />
            </div>
            <h2 className="mt-2 font-condensed text-3xl leading-tight text-[var(--text)] md:text-4xl">{customer.full_name}</h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">{job.property_address}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {job.roof_type ? <Badge size="sm" variant="neutral">{job.roof_type}</Badge> : null}
              {job.job_type ? <Badge size="sm" variant="neutral">{job.job_type}</Badge> : null}
              {(customer.town ?? job.postcode) ? <Badge size="sm" variant="neutral">{customer.town ?? job.postcode}</Badge> : null}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 lg:hidden">
              <SmartButton variant="secondary" size="md" href={customer.phone ? `tel:${customer.phone}` : `/customers/${customer.id}`}>
                Call
              </SmartButton>
              <SmartButton variant="secondary" size="md" href={`/comms?job=${job.id}&channel=sms`}>
                Message
              </SmartButton>
            </div>
          </div>

          <div
            className="rounded-xl border p-4 lg:min-w-[260px] lg:max-w-[280px]"
            style={{ backgroundColor: stageColors.bg, borderColor: stageColors.border }}
          >
            <p className="text-[0.58rem] font-bold uppercase tracking-[0.2em] text-[var(--dim)]">Next Action</p>
            <p className="mt-1.5 text-base font-semibold text-[var(--text)]">{nextAction.label}</p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">{getNextActionLabel(job)}</p>
            <SmartButton variant="primary" size="lg" href={nextAction.href} fullWidth className="mt-3">
              {nextAction.label}
            </SmartButton>
          </div>
        </div>
      </div>
    </Card>
  );
}

/* -----------------  Overview tab  ----------------- */

function OverviewTab({
  job,
  customer,
  survey,
  documents,
  commercialLabel,
  quote,
  paymentSchedule
}: {
  job: Job;
  customer: Customer;
  survey?: SurveyRecord | null;
  documents: JobDocumentRecord[];
  commercialLabel: string;
  quote?: QuoteRecord | null;
  paymentSchedule: React.ComponentProps<typeof PaymentSchedule>["initialSchedule"];
}) {
  return (
    <div className="stack">
      <div className="grid gap-3 md:grid-cols-4">
        <Stat
          label="Contact"
          value={customer.phone ?? "No phone"}
          hint={customer.email ?? "No email"}
          href={customer.phone ? `tel:${customer.phone}` : undefined}
        />
        <Stat label="Job Value" value={commercialLabel} hint="Current pipeline value" />
        <Stat
          label="Survey"
          value={survey ? "Saved" : "Not started"}
          hint={survey ? formatDate(survey.updated_at ?? survey.created_at) : "Open survey workspace"}
          href={`/jobs/${job.id}/survey`}
          tone={survey ? "active" : "pending"}
        />
        <Stat label="Documents" value={documents.length.toString()} hint="Uploads, reports, and PDFs" />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <PageSection kicker="Customer">
          <CustomerContactEditor compact customer={customer} />
        </PageSection>
        <PageSection kicker="Job Snapshot">
          <div className="space-y-2 text-sm">
            <InfoRow label="Job ref" value={job.job_ref ?? "WR-J-TBC"} />
            <InfoRow label="Roof type" value={job.roof_type ?? "TBC"} />
            <InfoRow label="Job type" value={job.job_type ?? "TBC"} />
            <InfoRow label="Last updated" value={formatDate(job.updated_at ?? null)} />
          </div>
        </PageSection>
      </div>

      <ScheduleWorks job={job} />
      <PaymentSchedule initialSchedule={paymentSchedule} job={job} quote={quote ?? null} />
    </div>
  );
}

/* -----------------  Survey tab  ----------------- */

function SurveyTab({
  job,
  survey,
  documents,
  photos
}: {
  job: Job;
  survey?: SurveyRecord | null;
  documents: JobDocumentRecord[];
  photos: JobPhoto[];
}) {
  const measurements = getSurveyMeasurementsSummary(survey);
  const highlights = getSurveyHighlights(survey);
  const hasSnapshot = documents.some((doc) => doc.document_type === "survey_snapshot");

  return (
    <div className="stack">
      <PageSection
        kicker="Survey Summary"
        title="Site findings"
        actions={
          <>
            <SmartButton variant="primary" size="md" href={`/jobs/${job.id}/survey`}>
              Open Workspace
            </SmartButton>
            <SmartButton variant="ghost" size="md" href={`/jobs/${job.id}/roof-survey`}>
              Takeoff Tool
            </SmartButton>
          </>
        }
      >
        <div className="grid gap-4 md:grid-cols-2">
          <SurveyField label="Observed Problem" value={survey?.problem_observed} />
          <SurveyField label="Recommended Works" value={survey?.recommended_works} />
          <SurveyField label="Measurements" value={measurements} />
          <SurveyField label="Access Notes" value={survey?.access_notes} />
          <SurveyField label="Specialist Highlights" value={highlights.length ? highlights.join(" | ") : null} />
          <SurveyField
            label="Survey Snapshot"
            value={hasSnapshot ? "Saved in Documents" : "Will appear after survey save"}
          />
        </div>
      </PageSection>

      <PageSection
        kicker="Site Photos"
        title={`${photos.length} ${photos.length === 1 ? "photo" : "photos"}`}
        actions={<PhotoUploadButton jobId={job.id} />}
      >
        {photos.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {photos.map((photo) => (
              <Card key={photo.id} padding="none" variant="outlined">
                {photo.public_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img alt={photo.caption ?? photo.photo_type} className="h-40 w-full object-cover" src={photo.public_url} />
                ) : (
                  <div className="flex h-40 items-center justify-center bg-[var(--surface-hover)] text-xs text-[var(--text-muted)]">
                    Awaiting upload
                  </div>
                )}
                <div className="p-3">
                  <p className="text-sm font-semibold text-[var(--text)]">{photo.photo_type}</p>
                  {photo.caption ? <p className="mt-1 text-xs text-[var(--text-muted)]">{photo.caption}</p> : null}
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[var(--text-muted)]">No site photos yet. Upload from the survey workspace or directly here.</p>
        )}
      </PageSection>
    </div>
  );
}

function SurveyField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-[0.62rem] font-bold uppercase tracking-[0.18em] text-[var(--dim)]">{label}</p>
      <p className="mt-1 text-sm text-[var(--text-second)]">{value || <span className="text-[var(--text-faint)] italic">Not captured yet</span>}</p>
    </div>
  );
}

/* -----------------  Quote tab  ----------------- */

function QuoteTab({ job, quote }: { job: Job; quote?: QuoteRecord | null }) {
  const quoteValue = getQuotePipelineValue(quote ?? null);
  const quoteLabel = quoteValue
    ? `${quote && isFromOptionValue({ ...job, quote }) ? "From " : ""}${currency(quoteValue)}`
    : "TBC";

  if (!quote) {
    return (
      <PageSection kicker="Quote" title="No quote draft saved yet">
        <p className="text-sm text-[var(--text-muted)]">
          Generate a draft from the completed survey or open the quote workspace to start.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <SmartButton variant="primary" size="md" href={`/jobs/${job.id}/survey`}>
            Generate From Survey
          </SmartButton>
          <SmartButton variant="ghost" size="md" href={`/jobs/${job.id}/quote`}>
            Open Quote Workspace
          </SmartButton>
        </div>
      </PageSection>
    );
  }

  return (
    <PageSection
      kicker={quote.quote_ref ?? "Quote"}
      title={quoteLabel}
      description={quote.customer_email_subject ?? undefined}
      actions={
        <>
          <SmartButton variant="secondary" size="md" href={`/jobs/${job.id}/quote`}>
            Open Review
          </SmartButton>
          <SmartButton variant="primary" size="md" href={`/jobs/${job.id}/quote/preview`}>
            Preview
          </SmartButton>
        </>
      }
    >
      <div className="space-y-2 text-sm text-[var(--text-muted)]">
        <div className="flex items-center justify-between">
          <span>Status</span>
          <StatusBadge status={quote.status} />
        </div>
        <div className="flex items-center justify-between">
          <span>Next step</span>
          <span className="text-[var(--text-second)]">{getNextActionLabel(job)}</span>
        </div>
      </div>

      {quote.status === "Sent" && (
        <div className="mt-4 border-t border-[var(--border)] pt-4">
          <NurtureSequenceStatus quoteId={quote.id} />
        </div>
      )}

      {quote.options?.length ? (
        <div className="mt-4 space-y-3 border-t border-[var(--border)] pt-4">
          {quote.options.map((option) => (
            <QuoteOptionCard option={option} key={option.id} />
          ))}
        </div>
      ) : null}
    </PageSection>
  );
}

function QuoteOptionCard({ option }: { option: QuoteOption }) {
  const rows = buildQuoteOptionPriceSummary(option);
  return (
    <Card variant="outlined" padding="sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-[var(--text)]">{option.label}</p>
          {option.recommended ? <Badge variant="gold" size="sm" className="mt-1">Recommended</Badge> : null}
        </div>
        <p className="shrink-0 font-display text-lg font-semibold text-[var(--gold)]">{currency(getOptionTotal(option) ?? 0)}</p>
      </div>
      {rows.length > 0 ? (
        <div className="mt-3 space-y-1.5 border-t border-[var(--border)] pt-3 text-xs">
          {rows.map((row) => (
            <div key={row.id}>
              <div className="flex justify-between gap-3 text-[var(--text-second)]">
                <span>{row.label}</span>
                <span className="font-semibold">{currency(row.net)}</span>
              </div>
              <div className="flex justify-between gap-3 text-[var(--text-muted)]">
                <span>{row.vatLabel}</span>
                <span>{currency(row.vat)}</span>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </Card>
  );
}

/* -----------------  Materials tab  ----------------- */

function MaterialsTab({ job, materials }: { job: Job; materials: MaterialRecord[] }) {
  const summary = summarizeMaterials(materials);

  return (
    <PageSection
      kicker="Materials"
      title={materials.length > 0 ? `${materials.length} ${materials.length === 1 ? "item" : "items"} on file` : "Materials list empty"}
      description={summary || undefined}
      actions={
        <SmartButton variant={materials.length > 0 ? "primary" : "secondary"} size="md" href={`/jobs/${job.id}/materials`}>
          {materials.length > 0 ? "Open Materials" : "Create List"}
        </SmartButton>
      }
    >
      {materials.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)]">
          Materials will appear after the first quote draft. Use the dedicated materials view to manage suppliers, status, quantities, and notes.
        </p>
      ) : (
        <p className="text-sm text-[var(--text-muted)]">
          Open the dedicated materials view to check suppliers, status, quantities, and notes.
        </p>
      )}
    </PageSection>
  );
}

/* -----------------  Labour tab  ----------------- */

function LabourTab({ job, labourPlan }: { job: Job; labourPlan?: LabourPlanRecord | null }) {
  const entries = labourPlan?.entries ?? [];
  const costTotal = entries.reduce((sum, entry) => sum + Number(entry.estimated_cost || 0), 0);
  const chargeTotal = entries.reduce((sum, entry) => sum + Number(entry.charge_total || 0), 0);
  const margin = chargeTotal > 0 ? ((chargeTotal - costTotal) / chargeTotal) * 100 : 0;

  return (
    <PageSection
      kicker="Labour"
      title={entries.length > 0 ? `${entries.length} labour ${entries.length === 1 ? "row" : "rows"} planned` : "No labour plan yet"}
      description="Estimate crew days, assign staff or subcontractors, track real labour cost, and pull the charge total into quote options."
      actions={
        <SmartButton variant={entries.length > 0 ? "primary" : "secondary"} size="md" href={`/jobs/${job.id}/labour`}>
          {entries.length > 0 ? "Open Labour Plan" : "Create Labour Plan"}
        </SmartButton>
      }
    >
      {entries.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)]">
          Use the labour plan to build roofer/labourer/foreman days before pricing the quote. Crew can be assigned later when the job is booked.
        </p>
      ) : (
        <div className="grid gap-3 md:grid-cols-3">
          <Stat label="Internal labour cost" value={currency(costTotal)} hint="Estimated real cost" />
          <Stat label="Quote labour charge" value={currency(chargeTotal)} hint="Customer-facing labour total" tone="active" />
          <Stat label="Labour margin" value={`${Math.round(margin)}%`} hint="Based on current plan" />
        </div>
      )}
    </PageSection>
  );
}

/* -----------------  Documents tab  ----------------- */

function DocumentsTab({
  job,
  documents,
  invoices,
  quote,
  customer
}: {
  job: Job;
  documents: JobDocumentRecord[];
  invoices: InvoiceRecord[];
  quote?: QuoteRecord | null;
  customer: Customer;
}) {
  const docGroups = groupDocuments(documents);
  const uploadedCount = docGroups.Uploads.length;
  const generatedCount = documents.length - uploadedCount;

  return (
    <div className="stack">
      <PageSection
        kicker="Documents"
        title={`${documents.length} ${documents.length === 1 ? "file" : "files"} on job`}
        description="Quote PDFs, invoices, customer paperwork, supplier docs."
        actions={<DocumentUploadButton jobId={job.id} />}
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label="All files" value={String(documents.length)} hint="Everything filed" />
          <Stat label="Uploaded" value={String(uploadedCount)} hint="Manual + third-party" />
          <Stat label="Generated" value={String(generatedCount)} hint="Quotes, invoices, reports" />
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {quote ? (
            <SmartButton variant="primary" size="md" href={`/jobs/${job.id}/quote/preview`}>
              Preview Quote
            </SmartButton>
          ) : null}
          {invoices.map((invoice) => (
            <SmartButton key={invoice.id} variant="secondary" size="md" href={`/jobs/${job.id}/invoice/${invoice.id}/preview`}>
              Preview Invoice {invoice.invoice_ref}
            </SmartButton>
          ))}
          <SmartButton variant="ghost" size="md" href={`/jobs/${job.id}/jobsheet/preview`}>
            Preview Job Sheet
          </SmartButton>
          <SmartButton variant="ghost" size="md" href={`/jobs/${job.id}/survey/report/preview`}>
            Preview Survey Report
          </SmartButton>
        </div>

        {documents.length > 0 ? (
          <div className="mt-5 border-t border-[var(--border)] pt-4">
            <JobDocumentsSection jobId={job.id} documents={documents} documentGroups={docGroups} />
          </div>
        ) : (
          <p className="mt-4 text-sm text-[var(--text-muted)]">Generated quote documents and supporting files will appear here.</p>
        )}
      </PageSection>

      <PageSection
        kicker="Invoices & Filing"
        title="Raise & file"
        description="Build invoices from the approved quote, file PDFs into this job, track paid/unpaid status."
      >
        <InvoiceActions
          customerEmail={customer.email}
          customerName={customer.full_name}
          invoices={invoices}
          jobId={job.id}
          jobTitle={job.job_title}
          quote={quote ?? null}
        />
      </PageSection>
    </div>
  );
}

function DocumentRow({ document }: { document: JobDocumentRecord }) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-[var(--border)] p-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-[var(--text)]">{document.display_name}</p>
        <p className="mt-0.5 text-xs text-[var(--text-muted)]">
          {getDocumentDisplayType(document)}
          {document.created_at ? ` · ${formatDate(document.created_at)}` : ""}
          {document.file_size ? ` · ${formatFileSize(document.file_size)}` : ""}
        </p>
      </div>
      <a
        className="shrink-0 text-xs font-semibold text-[var(--gold)] underline-offset-4 hover:underline"
        href={getJobDocumentHref(document)}
        target="_blank"
        rel="noreferrer"
      >
        Open →
      </a>
    </div>
  );
}

/* -----------------  Activity tab  ----------------- */

function ActivityTab({
  job,
  emailLogs,
  activity
}: {
  job: Job;
  emailLogs: EmailLog[];
  activity: ActivityRecord[];
}) {
  return (
    <div className="stack">
      <PageSection kicker="Recent activity" title="Timeline" description="Audited log of everything that happens on this job.">
        <ActivityTimeline entries={activity} jobId={job.id} emptyMessage="No activity logged yet. Activity is recorded automatically as the job progresses." />
      </PageSection>

      <PageSection
        kicker="Email Log"
        title={`${emailLogs.length} ${emailLogs.length === 1 ? "email" : "emails"} sent`}
        description="Everything sent from this job file."
      >
        {emailLogs.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">No quote emails have been sent yet.</p>
        ) : (
          <div className="space-y-2">
            {emailLogs.map((item) => (
              <Card key={item.id} variant="outlined" padding="sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[var(--text)]">{item.subject}</p>
                    <p className="mt-0.5 text-xs text-[var(--text-muted)]">{item.to_email ?? item.to_phone ?? "Recipient not saved"}</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {item.channel ? <Badge size="sm" variant="neutral">{item.channel}</Badge> : null}
                    {item.template_type ? <Badge size="sm" variant="neutral">{item.template_type}</Badge> : null}
                  </div>
                </div>
                <p className="mt-2 text-xs text-[var(--text-faint)]">
                  {item.status} · {formatDate(item.sent_at ?? null)}
                  {item.opened_at ? ` · Opened ${formatDate(item.opened_at)}` : ""}
                  {item.clicked_at ? ` · Clicked ${formatDate(item.clicked_at)}` : ""}
                </p>
              </Card>
            ))}
          </div>
        )}
      </PageSection>

      <PageSection
        kicker="Danger zone"
        title="Delete job"
        description="Use this for test jobs or mistakes only. Live customer jobs should be marked Lost or Archived instead."
      >
        <DeleteJobAction jobId={job.id} jobRef={job.job_ref} jobTitle={job.job_title} />
      </PageSection>
    </div>
  );
}

/* -----------------  Helpers  ----------------- */

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] py-2 last:border-b-0">
      <p className="text-[0.62rem] font-bold uppercase tracking-[0.18em] text-[var(--dim)]">{label}</p>
      <p className="max-w-[65%] text-right text-sm text-[var(--text-second)]">{value}</p>
    </div>
  );
}

function SmartButton({
  href,
  children,
  ...props
}: {
  href: string;
  children: React.ReactNode;
} & Omit<React.ComponentProps<typeof Button>, "asChild" | "children">) {
  if (href.startsWith("tel:") || href.startsWith("mailto:") || href.startsWith("http")) {
    return (
      <Button asChild {...props}>
        <a href={href}>{children}</a>
      </Button>
    );
  }
  return (
    <Button asChild {...props}>
      <Link href={href as Route}>{children}</Link>
    </Button>
  );
}

/* -----------------  Mobile sticky next-action bar  ----------------- */

function MobileNextActionBar({ job }: { job: React.ComponentProps<typeof NextActionButton>["job"] }) {
  return (
    <div className="fixed inset-x-0 bottom-[calc(var(--mobile-bottom-nav-height,4rem)+0.5rem)] z-30 px-4 lg:hidden">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--ink)]/95 p-2 shadow-[0_-6px_18px_rgba(0,0,0,0.45)] backdrop-blur-md">
        <NextActionButton job={job} size="md" fullWidth showWhyLabel />
      </div>
    </div>
  );
}
