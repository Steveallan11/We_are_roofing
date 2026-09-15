"use client";

import * as React from "react";
import Link from "next/link";
import type { Route } from "next";
import { useSearchParams, useRouter, usePathname } from "next/navigation";

import { CustomerContactEditor } from "@/components/customers/customer-contact-editor";
import { JobDocumentsSection } from "@/components/documents/JobDocumentsSection";
import { GenerateHandoverDocumentsButton } from "@/components/documents/GenerateHandoverDocumentsButton";
import { DocumentUploadButton } from "@/components/forms/document-upload";
import { PhotoUploadButton } from "@/components/forms/photo-upload";
import { AcceptQuoteButton } from "@/components/jobs/AcceptQuoteButton";
import { DeleteJobAction } from "@/components/jobs/delete-job-action";
import { JobMoneyTab } from "@/components/jobs/JobMoneyTab";
import { JobTitleEditor } from "@/components/jobs/job-title-editor";
import { PaymentSchedule } from "@/components/jobs/PaymentSchedule";
import { ScheduleWorks } from "@/components/jobs/ScheduleWorks";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { NurtureSequenceStatus } from "@/components/jobs/NurtureSequenceStatus";

import {
  Badge,
  Button,
  Card,
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
import { buildQuoteOptionPriceSummary, getJobPipelineValue, getOptionTotal, getQuotePipelineValue, isFromOptionValue } from "@/lib/quotes/value";
import { getSurveyHighlights, getSurveyMeasurementsSummary } from "@/lib/survey-utils";
import { currency, formatDate, cn } from "@/lib/utils";
import { ActivityTimeline } from "@/components/activity/ActivityTimeline";
import { NextActionButton } from "@/components/jobs/NextActionButton";
import { JobDiaryTab } from "@/components/diary/JobDiaryTab";
import type { ActivityRecord } from "@/lib/activity/types";
import {
  groupDocuments,
  summarizeMaterials
} from "@/lib/jobs/jobDetail";
import type {
  Customer,
  EmailLog,
  InvoiceRecord,
  Job,
  JobDocumentRecord,
  JobExpense,
  JobPhoto,
  JobVariationRecord,
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
  variations: JobVariationRecord[];
  expenses?: JobExpense[];
  emailLogs: EmailLog[];
  activity?: ActivityRecord[];
  paymentSchedule: React.ComponentProps<typeof PaymentSchedule>["initialSchedule"];
};

type TabId = "overview" | "survey" | "quote" | "work" | "money" | "files" | "history";

const TABS: { value: TabId; label: string }[] = [
  { value: "overview", label: "Overview" },
  { value: "survey", label: "Survey" },
  { value: "quote", label: "Quote" },
  { value: "work", label: "Work" },
  { value: "money", label: "Money" },
  { value: "files", label: "Files" },
  { value: "history", label: "History" }
];

const LEGACY_TABS: Record<string, TabId> = {
  diary: "work",
  materials: "work",
  labour: "work",
  documents: "files",
  activity: "history"
};

export function JobDetailView(props: JobDetailViewProps) {
  const { job, customer, survey, quote, documents, photos, materials, labourPlan, invoices, variations, expenses, emailLogs, activity, paymentSchedule } = props;

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const requestedTab = searchParams?.get("tab") || "overview";
  const initialTab = LEGACY_TABS[requestedTab] ?? requestedTab;
  const validInitialTab = TABS.some((tab) => tab.value === initialTab) ? (initialTab as TabId) : "overview";

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
        survey={survey}
        quote={quote}
        invoices={invoices}
      />

      <MobileNextActionBar job={{ ...job, customer, quote: quote ?? null }} />

      <Tabs value={validInitialTab} onValueChange={handleTabChange} className="stack">
        <div className="sticky top-0 z-20 -mx-4 bg-[var(--obsidian)]/95 px-4 py-1 backdrop-blur-md md:relative md:mx-0 md:bg-transparent md:px-0 md:py-0 md:backdrop-blur-none">
          <TabsList className="job-tabs">
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
          />
        </TabsContent>

        <TabsContent value="survey">
          <SurveyTab job={job} survey={survey} documents={documents} photos={photos} />
        </TabsContent>

        <TabsContent value="quote">
          <QuoteTab job={job} quote={quote} />
        </TabsContent>

        <TabsContent value="work">
          <WorkTab job={job} materials={materials} labourPlan={labourPlan ?? null} />
        </TabsContent>

        <TabsContent value="money">
          <div className="stack">
            <JobMoneyTab
              job={job}
              jobId={job.id}
              jobTitle={job.job_title}
              quote={quote ?? null}
              invoices={invoices}
              variations={variations}
              expenses={expenses ?? []}
              materials={materials}
              documents={documents}
              customerName={customer.full_name}
              customerEmail={customer.email}
            />
            <PaymentSchedule initialSchedule={paymentSchedule} job={job} quote={quote ?? null} />
          </div>
        </TabsContent>

        <TabsContent value="files">
          <DocumentsTab
            job={job}
            documents={documents}
            invoices={invoices}
            quote={quote}
          />
        </TabsContent>

        <TabsContent value="history">
          <ActivityTab job={job} emailLogs={emailLogs} activity={activity ?? []} />
        </TabsContent>
      </Tabs>

    </div>
  );
}

/* -----------------  Sticky header  ----------------- */

function JobDetailHeader({
  job,
  customer,
  nextAction,
  stageColors,
  survey,
  quote,
  invoices
}: {
  job: Job;
  customer: Customer;
  nextAction: ReturnType<typeof getNextAction>;
  stageColors: { bg: string; border: string; text: string };
  survey?: SurveyRecord | null;
  quote?: QuoteRecord | null;
  invoices: InvoiceRecord[];
}) {
  const missingDetails = [
    !customer.phone ? "customer phone" : null,
    !customer.email ? "customer email" : null,
    !job.property_address ? "property address" : null,
    !job.roof_type ? "roof type" : null
  ].filter(Boolean) as string[];

  return (
    <Card className="job-workspace-header" padding="none">
      <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_300px] lg:p-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-[var(--text-muted)]">{job.job_ref ?? "Job reference pending"}</span>
            <StatusBadge status={job.status} />
          </div>
          <div className="mt-3">
            <JobTitleEditor jobId={job.id} jobRef={job.job_ref} title={job.job_title} />
          </div>
          <div className="mt-3 flex flex-col gap-1 text-sm text-[var(--text-muted)] sm:flex-row sm:flex-wrap sm:gap-x-5">
            <span className="font-semibold text-[var(--text-primary)]">{customer.full_name}</span>
            <span>{job.property_address}</span>
            {customer.phone ? <a className="font-semibold" href={`tel:${customer.phone}`}>{customer.phone}</a> : null}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <SmartButton variant="secondary" size="sm" href={customer.phone ? `tel:${customer.phone}` : `/customers/${customer.id}`}>
              Call customer
            </SmartButton>
            <SmartButton variant="secondary" size="sm" href={`/comms?job=${job.id}&compose=1`}>
              Send message
            </SmartButton>
            <SmartButton variant="ghost" size="sm" href={`/customers/${customer.id}`}>
              Customer details
            </SmartButton>
          </div>
        </div>

        <div className="job-next-action" style={{ backgroundColor: stageColors.bg, borderColor: stageColors.border }}>
          <p>Next step</p>
          <h3>{nextAction.label}</h3>
          <span>{getNextActionLabel(job)}</span>
          <SmartButton className="mt-4" fullWidth href={nextAction.href} size="lg" variant="primary">
            {nextAction.label}
          </SmartButton>
        </div>
      </div>

      <JobProgress invoices={invoices} job={job} quote={quote} survey={survey} />

      {missingDetails.length > 0 ? (
        <div className="job-missing-details">
          <span aria-hidden="true">i</span>
          <p><strong>Details to add:</strong> {missingDetails.join(", ")}.</p>
          <Link href={`/customers/${customer.id}` as Route}>Add details</Link>
        </div>
      ) : null}
    </Card>
  );
}

function JobProgress({
  job,
  survey,
  quote,
  invoices
}: {
  job: Job;
  survey?: SurveyRecord | null;
  quote?: QuoteRecord | null;
  invoices: InvoiceRecord[];
}) {
  const workStatuses: Job["status"][] = ["Accepted", "Materials Needed", "Materials Ordered", "Scaffold In Situ", "Booked", "In Progress"];
  const quoteStatuses: Job["status"][] = ["Survey Complete", "Ready For AI Quote", "Quote Drafted", "Ready To Send", "Quote Sent", "Follow-Up Needed"];
  const currentIndex = job.status === "Completed" ? 4 : workStatuses.includes(job.status) ? 3 : quoteStatuses.includes(job.status) ? 2 : job.status === "Survey Needed" ? 1 : 0;
  const paid = invoices.some((invoice) => invoice.status === "Paid");
  const steps = [
    { label: "Details", complete: currentIndex > 0 },
    { label: "Survey", complete: Boolean(survey) || currentIndex > 1 },
    { label: "Quote", complete: Boolean(quote) && currentIndex > 2 },
    { label: "Work", complete: job.status === "Completed" },
    { label: "Payment", complete: paid }
  ];

  return (
    <div className="job-progress" aria-label="Job progress">
      {steps.map((step, index) => {
        const current = !step.complete && index === currentIndex;
        return (
          <div className={`job-progress__step ${step.complete ? "is-complete" : ""} ${current ? "is-current" : ""}`} key={step.label}>
            <span aria-hidden="true">{step.complete ? "✓" : index + 1}</span>
            <p>{step.label}</p>
          </div>
        );
      })}
    </div>
  );
}

/* -----------------  Overview tab  ----------------- */

function OverviewTab({
  job,
  customer,
  survey,
  documents,
  commercialLabel
}: {
  job: Job;
  customer: Customer;
  survey?: SurveyRecord | null;
  documents: JobDocumentRecord[];
  commercialLabel: string;
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
        <Stat label="Job value" value={commercialLabel} hint="Current quoted value" />
        <Stat
          label="Survey"
          value={survey ? "Saved" : "Not started"}
          hint={survey ? formatDate(survey.updated_at ?? survey.created_at) : "Open survey workspace"}
          href={`/jobs/${job.id}/survey`}
          tone={survey ? "active" : "pending"}
        />
        <Stat label="Files" value={documents.length.toString()} hint="Reports, PDFs and uploads" />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <PageSection kicker="Customer">
          <CustomerContactEditor compact customer={customer} />
        </PageSection>
        <PageSection kicker="Job details">
          <div className="space-y-2 text-sm">
            <InfoRow label="Job ref" value={job.job_ref ?? "WR-J-TBC"} />
            <InfoRow label="Roof type" value={job.roof_type ?? "TBC"} />
            <InfoRow label="Job type" value={job.job_type ?? "TBC"} />
            <InfoRow label="Last updated" value={formatDate(job.updated_at ?? null)} />
          </div>
        </PageSection>
      </div>
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
        kicker="Survey"
        title="Site findings"
        actions={
          <>
            <SmartButton variant="primary" size="md" href={`/jobs/${job.id}/survey`}>
              Open survey
            </SmartButton>
            <SmartButton variant="ghost" size="md" href={`/jobs/${job.id}/roof-survey`}>
              Measure roof
            </SmartButton>
          </>
        }
      >
        <div className="grid gap-4 md:grid-cols-2">
          <SurveyField label="Problem found" value={survey?.problem_observed} />
          <SurveyField label="Recommended work" value={survey?.recommended_works} />
          <SurveyField label="Measurements" value={measurements} />
          <SurveyField label="Access notes" value={survey?.access_notes} />
          <SurveyField label="Important findings" value={highlights.length ? highlights.join(" | ") : null} />
          <SurveyField
            label="Saved report"
            value={hasSnapshot ? "Available in Files" : "Created when the survey is saved"}
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
            Create from survey
          </SmartButton>
          <SmartButton variant="ghost" size="md" href={`/jobs/${job.id}/quote`}>
            Create quote manually
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
            Review quote
          </SmartButton>
          <SmartButton variant="primary" size="md" href={`/jobs/${job.id}/quote/preview`}>
            Preview customer copy
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

      {quote.status !== "Accepted" && quote.status !== "Declined" ? (
        <div className="mt-4 border-t border-[var(--border)] pt-4">
          <AcceptQuoteButton options={quote.options ?? []} quoteId={quote.id} />
        </div>
      ) : null}

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

/* -----------------  Work tab  ----------------- */

function WorkTab({ job, materials, labourPlan }: { job: Job; materials: MaterialRecord[]; labourPlan?: LabourPlanRecord | null }) {
  return (
    <div className="stack">
      <PageSection
        kicker="Site diary"
        title="Notes, photos and daily updates"
        description="Keep the whole team up to date from the job site."
      >
        <JobDiaryTab jobId={job.id} />
      </PageSection>
      <div className="grid gap-4 xl:grid-cols-2">
        <MaterialsTab job={job} materials={materials} />
        <LabourTab job={job} labourPlan={labourPlan} />
      </div>
      <ScheduleWorks job={job} />
    </div>
  );
}

/* -----------------  Materials section  ----------------- */

function MaterialsTab({ job, materials }: { job: Job; materials: MaterialRecord[] }) {
  const summary = summarizeMaterials(materials);

  return (
    <PageSection
      kicker="Materials"
      title={materials.length > 0 ? `${materials.length} ${materials.length === 1 ? "item" : "items"} on file` : "Materials list empty"}
      description={summary || undefined}
      actions={
        <SmartButton variant={materials.length > 0 ? "primary" : "secondary"} size="md" href={`/jobs/${job.id}/materials`}>
          {materials.length > 0 ? "Open materials" : "Create list"}
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

/* -----------------  Labour section  ----------------- */

function LabourTab({ job, labourPlan }: { job: Job; labourPlan?: LabourPlanRecord | null }) {
  const entries = labourPlan?.entries ?? [];
  const costTotal = entries.reduce((sum, entry) => sum + Number(entry.estimated_cost || 0), 0);
  const chargeTotal = entries.reduce((sum, entry) => sum + Number(entry.charge_total || 0), 0);
  const margin = chargeTotal > 0 ? ((chargeTotal - costTotal) / chargeTotal) * 100 : 0;

  return (
    <PageSection
      kicker="Labour"
      title={entries.length > 0 ? `${entries.length} labour ${entries.length === 1 ? "row" : "rows"} planned` : "No labour plan yet"}
      description="Plan the crew, working days, labour cost and customer charge."
      actions={
        <SmartButton variant={entries.length > 0 ? "primary" : "secondary"} size="md" href={`/jobs/${job.id}/labour`}>
          {entries.length > 0 ? "Open labour plan" : "Create labour plan"}
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
  quote
}: {
  job: Job;
  documents: JobDocumentRecord[];
  invoices: InvoiceRecord[];
  quote?: QuoteRecord | null;
}) {
  const docGroups = groupDocuments(documents);
  const uploadedCount = docGroups.Uploads.length + docGroups.Receipts.length;
  const generatedCount = documents.length - uploadedCount;

  return (
    <div className="stack">
      <PageSection
        kicker="Files and paperwork"
        title={`${documents.length} ${documents.length === 1 ? "file" : "files"} on job`}
        description="Quotes, invoices, reports, photos and uploaded paperwork in one place."
        actions={<div className="flex flex-wrap gap-2"><GenerateHandoverDocumentsButton jobId={job.id} /><DocumentUploadButton jobId={job.id} /></div>}
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label="All files" value={String(documents.length)} hint="Everything filed" />
          <Stat label="Uploaded" value={String(uploadedCount)} hint="Your uploaded files" />
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
          {job.status === "Completed" ? (
            <SmartButton variant="primary" size="md" href={`/jobs/${job.id}/completion/preview`}>
              Preview Completion & Guarantee
            </SmartButton>
          ) : null}
        </div>

        {documents.length > 0 ? (
          <div className="mt-5 border-t border-[var(--border)] pt-4">
            <JobDocumentsSection jobId={job.id} documents={documents} documentGroups={docGroups} />
          </div>
        ) : (
          <p className="mt-4 text-sm text-[var(--text-muted)]">Generated quote documents and supporting files will appear here.</p>
        )}
      </PageSection>

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
      <PageSection kicker="Job history" title="What has happened" description="A dated record of updates made to this job.">
        <ActivityTimeline entries={activity} jobId={job.id} emptyMessage="No activity logged yet. Activity is recorded automatically as the job progresses." />
      </PageSection>

      <PageSection
        kicker="Sent messages"
        title={`${emailLogs.length} ${emailLogs.length === 1 ? "email" : "emails"}`}
        description="Delivery information for emails sent from this job."
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
