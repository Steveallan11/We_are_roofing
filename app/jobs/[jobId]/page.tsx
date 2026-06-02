import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { CustomerContactEditor } from "@/components/customers/customer-contact-editor";
import { DocumentUploadButton } from "@/components/forms/document-upload";
import { PhotoUploadButton } from "@/components/forms/photo-upload";
import { DeleteJobAction } from "@/components/jobs/delete-job-action";
import { InvoiceActions } from "@/components/jobs/invoice-actions";
import { JobTitleEditor } from "@/components/jobs/job-title-editor";
import { PaymentSchedule } from "@/components/jobs/PaymentSchedule";
import { QuoteActions } from "@/components/jobs/quote-actions";
import { ScheduleWorks } from "@/components/jobs/ScheduleWorks";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { StatusPill } from "@/components/ui/status-pill";
import { getJobBundle, getPaymentSchedule } from "@/lib/data";
import { getJobDocumentHref } from "@/lib/documents";
import { getNextActionLabel } from "@/lib/job-workflow";
import { getNextAction } from "@/lib/jobs/nextAction";
import { buildQuoteOptionPriceSummary, getJobPipelineValue, getOptionTotal, getQuotePipelineValue, isFromOptionValue } from "@/lib/quotes/value";
import { getSurveyHighlights, getSurveyMeasurementsSummary } from "@/lib/survey-utils";
import { currency, formatDate } from "@/lib/utils";
import type { JobDocumentRecord, QuoteOption } from "@/lib/types";

type Props = {
  params: Promise<{ jobId: string }>;
};

export default async function JobDetailPage({ params }: Props) {
  const { jobId } = await params;
  const [bundle, paymentSchedule] = await Promise.all([getJobBundle(jobId), getPaymentSchedule(jobId)]);

  if (!bundle) {
    notFound();
  }

  const materialsHref = `/jobs/${bundle.job.id}/materials` as Route;
  const roofSurveyHref = `/jobs/${bundle.job.id}/roof-survey` as Route;
  const surveyHighlights = getSurveyHighlights(bundle.survey);
  const surveyMeasurements = getSurveyMeasurementsSummary(bundle.survey);
  const documentGroups = groupDocuments(bundle.documents);
  const workflowTimeline = [
    { label: "Job created", date: bundle.job.created_at, detail: bundle.job.job_ref ?? "Job file opened" },
    { label: "Survey booked", date: bundle.job.survey_date, detail: bundle.survey ? "Survey workspace active" : "Waiting for survey" },
    { label: "Survey completed", date: bundle.survey?.updated_at ?? bundle.survey?.created_at, detail: bundle.survey ? "Survey details saved" : null },
    { label: "Quote generated", date: bundle.quote?.created_at, detail: bundle.quote?.quote_ref ?? null },
    { label: "Quote sent", date: bundle.quote?.sent_at ?? bundle.job.quote_sent_at, detail: bundle.quote?.status === "Sent" ? "Customer has received quote" : null },
    { label: "Accepted", date: bundle.job.accepted_at, detail: bundle.job.status === "Accepted" ? "Ready to book in" : null },
    { label: "Completed", date: bundle.job.completed_at, detail: bundle.job.status === "Completed" ? "Ready for final paperwork" : null }
  ].filter((event) => event.date || event.detail);
  const nextAction = getNextAction({
    ...bundle.job,
    customer: bundle.customer,
    quote: bundle.quote ?? null
  });
  const commercialValue = getJobPipelineValue({ ...bundle.job, quote: bundle.quote ?? null });
  const commercialLabel = commercialValue ? `${isFromOptionValue({ ...bundle.job, quote: bundle.quote ?? null }) ? "From " : ""}${currency(commercialValue)}` : "TBC";
  const quoteDisplayValue = getQuotePipelineValue(bundle.quote ?? null);
  const quoteDisplayLabel = quoteDisplayValue ? `${bundle.quote && isFromOptionValue({ ...bundle.job, quote: bundle.quote }) ? "From " : ""}${currency(quoteDisplayValue)}` : "TBC";
  const activityFeed = buildActivityFeed({
    documents: bundle.documents,
    emailLogs: bundle.email_logs,
    events: workflowTimeline,
    jobId: bundle.job.id
  });
  const totalDocumentCount = bundle.documents.length;
  const uploadedDocumentCount = documentGroups.Uploads.length;
  const generatedDocumentCount = totalDocumentCount - uploadedDocumentCount;
  const materialsSummary = summarizeMaterials(bundle.materials);

  return (
        <AppShell
      title={bundle.job.job_title}
      subtitle="Full job file with the customer details, survey notes, quote progress, paperwork, and the next step needed to keep this one moving."
      actions={
        <>
          <QuoteActions customerEmail={bundle.customer.email} customerName={bundle.customer.full_name} documents={bundle.documents} jobId={bundle.job.id} jobTitle={bundle.job.job_title} quote={bundle.quote ?? null} />
          <Link className="button-ghost hidden lg:inline-flex" href="/dashboard">
            Back
          </Link>
        </>
      }
    >
      <section className="page-grid">
        <div className="stack">
          <div className="card overflow-hidden">
            <div className="border-b border-[var(--border)] bg-black/20 p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="section-kicker text-[0.65rem] uppercase">{bundle.job.job_ref ?? "WR-J-TBC"}</p>
                    <StatusBadge status={bundle.job.status} />
                    {bundle.quote ? <StatusPill status={bundle.quote.status} /> : null}
                  </div>
                  <div className="mt-4">
                    <JobTitleEditor jobId={bundle.job.id} jobRef={bundle.job.job_ref} title={bundle.job.job_title} />
                  </div>
                  <h2 className="mt-3 font-condensed text-4xl leading-none text-white">{bundle.customer.full_name}</h2>
                  <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">{bundle.job.property_address}</p>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs text-[var(--muted)]">
                    <span className="rounded-full border border-[var(--border)] bg-black/20 px-3 py-1">{bundle.job.roof_type ?? "Roof type TBC"}</span>
                    <span className="rounded-full border border-[var(--border)] bg-black/20 px-3 py-1">{bundle.job.job_type ?? "Job type TBC"}</span>
                    <span className="rounded-full border border-[var(--border)] bg-black/20 px-3 py-1">{bundle.customer.town ?? bundle.job.postcode ?? "Town TBC"}</span>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2 lg:hidden">
                    <SmartActionLink className="button-secondary button-md" href={bundle.customer.phone ? `tel:${bundle.customer.phone}` : `/customers/${bundle.customer.id}`}>
                      Call Customer
                    </SmartActionLink>
                    <SmartActionLink className="button-secondary button-md" href={`/comms?job=${bundle.job.id}&channel=sms`}>
                      Message
                    </SmartActionLink>
                  </div>
                </div>
                <div className="rounded-[1.25rem] border border-[var(--gold-border)] bg-[var(--gold-bg)] p-4 lg:min-w-[260px]">
                  <p className="section-kicker text-[0.58rem] uppercase">Next Action</p>
                  <p className="mt-2 text-lg font-semibold text-white">{nextAction.label}</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">{getNextActionLabel(bundle.job)}</p>
                  <SmartActionLink className="button-primary button-lg w-full mt-4 lg:button-md" href={nextAction.href}>
                    {nextAction.label}
                  </SmartActionLink>
                </div>
              </div>
            </div>

            <div className="grid gap-3 p-5 md:grid-cols-4">
              <DossierStat label="Contact" value={bundle.customer.phone ?? "No phone"} hint={bundle.customer.email ?? "No email"} href={bundle.customer.phone ? `tel:${bundle.customer.phone}` : undefined} />
              <DossierStat label="Job Value" value={commercialLabel} hint="Current pipeline value" />
              <DossierStat label="Survey" value={bundle.survey ? "Saved" : "Not started"} hint={bundle.survey ? formatDate(bundle.survey.updated_at ?? bundle.survey.created_at) : "Open survey workspace"} href={`/jobs/${bundle.job.id}/survey`} />
              <DossierStat label="Documents" value={bundle.documents.length.toString()} hint="Uploads, reports, and PDFs" />
            </div>

            <div className="grid gap-3 border-t border-[var(--border)] bg-black/10 p-5 md:grid-cols-5">
              <Link className="button-secondary button-sm" href={`/jobs/${bundle.job.id}/book-survey`}>
                Book Survey
              </Link>
              <Link className="button-secondary button-sm" href={`/jobs/${bundle.job.id}/survey`}>
                Survey
              </Link>
              <Link className="button-secondary button-sm" href={`/jobs/${bundle.job.id}/quote`}>
                Quote
              </Link>
              <Link className="button-secondary button-sm" href={materialsHref}>
                Materials
              </Link>
              <Link className="button-secondary button-sm" href={roofSurveyHref}>
                Takeoff Tool
              </Link>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="card p-5">
              <p className="section-kicker text-[0.65rem] uppercase">Customer</p>
              <div className="mt-4">
                <CustomerContactEditor compact customer={bundle.customer} />
              </div>
            </div>

            <div className="card p-5">
              <p className="section-kicker text-[0.65rem] uppercase">Job Snapshot</p>
              <div className="mt-4 space-y-3 text-sm">
                <InfoRow label="Job ref" value={bundle.job.job_ref ?? "WR-J-TBC"} />
                <InfoRow label="Roof type" value={bundle.job.roof_type ?? "TBC"} />
                <InfoRow label="Job type" value={bundle.job.job_type ?? "TBC"} />
                <InfoRow label="Last updated" value={formatDate(bundle.job.updated_at ?? null)} />
              </div>
            </div>
          </div>

          <ScheduleWorks job={bundle.job} />
          <PaymentSchedule initialSchedule={paymentSchedule} job={bundle.job} quote={bundle.quote ?? null} />

          <div className="card p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="section-kicker text-[0.65rem] uppercase">{bundle.job.job_ref ?? "WR-J-TBC"}</p>
                <h2 className="mt-2 font-condensed text-3xl text-white">Recent activity</h2>
                <p className="mt-2 text-sm text-[var(--muted)]">Key job milestones, emails, and filed documents in date order.</p>
              </div>
              <Link className="button-ghost button-sm" href={`/jobs/${bundle.job.id}`}>
                Job file
              </Link>
            </div>
            <div className="mt-5 space-y-3">
              {activityFeed.map((event, index) => (
                <div className="grid grid-cols-[1rem_1fr] gap-3" key={`${event.type}-${event.label}-${index}`}>
                  <div className="relative flex justify-center">
                    <span className={`mt-1.5 h-3 w-3 rounded-full shadow-[0_0_18px_rgba(212,175,55,0.35)] ${getActivityDotClass(event.type)}`} />
                    {index < activityFeed.length - 1 ? <span className="absolute top-5 h-[calc(100%+0.25rem)] w-px bg-[var(--border)]" /> : null}
                  </div>
                  <div className="rounded-2xl border border-[var(--border)] bg-black/20 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-white">{event.label}</p>
                        <span className="rounded-full border border-[var(--border)] bg-black/20 px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-[0.18em] text-[var(--dim)]">
                          {event.badge}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--muted)]">{formatDate(event.date ?? null)}</p>
                    </div>
                    {event.detail ? <p className="mt-1 text-sm text-[var(--muted)]">{event.detail}</p> : null}
                    {event.href ? (
                      <Link className="mt-3 inline-flex text-sm font-semibold text-[var(--gold-l)] underline-offset-4 hover:underline" href={event.href as Route}>
                        Open
                      </Link>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-5">
            <p className="section-kicker text-[0.65rem] uppercase">Survey Summary</p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <p className="label">Observed Problem</p>
                <p className="text-sm text-[var(--text)]">{bundle.survey?.problem_observed ?? "Not captured yet"}</p>
              </div>
              <div>
                <p className="label">Recommended Works</p>
                <p className="text-sm text-[var(--text)]">{bundle.survey?.recommended_works ?? "Not captured yet"}</p>
              </div>
              <div>
                <p className="label">Measurements</p>
                <p className="text-sm text-[var(--text)]">{surveyMeasurements}</p>
              </div>
              <div>
                <p className="label">Access</p>
                <p className="text-sm text-[var(--text)]">{bundle.survey?.access_notes ?? "Not captured yet"}</p>
              </div>
              <div>
                <p className="label">Specialist Highlights</p>
                <p className="text-sm text-[var(--text)]">{surveyHighlights.length > 0 ? surveyHighlights.join(" | ") : "Will appear once the specialist survey is saved"}</p>
              </div>
              <div>
                <p className="label">Survey Snapshot</p>
                <p className="text-sm text-[var(--text)]">
                  {bundle.documents.some((document) => document.document_type === "survey_snapshot") ? "Saved in Documents" : "Will appear after survey save"}
                </p>
              </div>
            </div>
            <div className="mt-4">
              <div className="flex flex-wrap gap-3">
                <Link className="button-secondary" href={`/jobs/${bundle.job.id}/survey`}>
                  Open Survey Workspace
                </Link>
                <Link className="button-secondary" href={`/jobs/${bundle.job.id}/survey/video`}>
                  Video Survey
                </Link>
                <Link className="button-ghost" href={roofSurveyHref}>
                  Roof Survey Tool
                </Link>
              </div>
            </div>
          </div>

          <div className="card p-5">
            <p className="section-kicker text-[0.65rem] uppercase">Site Photos</p>
            <div className="mt-4">
              <PhotoUploadButton jobId={bundle.job.id} />
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {bundle.photos.length > 0 ? (
                bundle.photos.map((photo) => (
                  <div className="overflow-hidden rounded-2xl border" key={photo.id}>
                    {photo.public_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img alt={photo.caption ?? photo.photo_type} className="h-44 w-full object-cover" src={photo.public_url} />
                    ) : (
                      <div className="flex h-44 items-center justify-center bg-card2 text-sm text-[var(--muted)]">Photo awaiting upload</div>
                    )}
                    <div className="p-3">
                      <p className="font-semibold text-white">{photo.photo_type}</p>
                      <p className="mt-1 text-sm text-[var(--muted)]">{photo.caption ?? "No caption"}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="surface-muted rounded-2xl border p-4 text-sm text-[var(--muted)]">No site photos saved yet.</div>
              )}
            </div>
          </div>
        </div>

        <aside className="stack">
          <div className="card p-5">
            <p className="section-kicker text-[0.65rem] uppercase">Quote Status</p>
            {bundle.quote ? (
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[var(--muted)]">{bundle.quote.quote_ref}</span>
                  <StatusPill status={bundle.quote.status} />
                </div>
                <p className="text-3xl font-display text-[var(--gold-l)]">{quoteDisplayLabel}</p>
                <p className="text-sm text-[var(--muted)]">{bundle.quote.customer_email_subject}</p>
                <p className="text-sm text-[var(--text)]">Next step: {getNextActionLabel(bundle.job)}</p>
                {bundle.quote.options?.length ? (
                  <div className="mt-4 space-y-3">
                    {bundle.quote.options.map((option) => (
                      <div className="rounded-2xl border border-[var(--border)] bg-black/20 p-3" key={option.id}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-white">{option.label}</p>
                            {option.recommended ? <p className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-[var(--gold)]">Recommended</p> : null}
                          </div>
                          <p className="shrink-0 font-semibold text-[var(--gold-l)]">{currency(getOptionTotal(option) ?? 0)}</p>
                        </div>
                        <QuoteOptionMiniBreakdown option={option} />
                      </div>
                    ))}
                  </div>
                ) : null}
                <Link className="button-secondary !mt-4 w-full !py-2 text-sm" href={`/jobs/${bundle.job.id}/quote`}>
                  Open Quote Review
                </Link>
                <Link className="button-primary !mt-2 w-full !py-2 text-sm" href={`/jobs/${bundle.job.id}/quote/preview`}>
                  Preview Before Send
                </Link>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <p className="text-sm text-[var(--muted)]">No quote draft saved yet.</p>
                <Link className="button-secondary w-full !py-2 text-sm" href={`/jobs/${bundle.job.id}/survey`}>
                  Generate From Survey
                </Link>
              </div>
            )}
          </div>

          <div className="card p-5">
            <p className="section-kicker text-[0.65rem] uppercase">Invoices & Filing</p>
            <p className="mt-3 text-sm text-[var(--muted)]">
              Raise invoices from the approved quote, file PDFs into this job, and track paid/unpaid status.
            </p>
            <InvoiceActions customerEmail={bundle.customer.email} customerName={bundle.customer.full_name} invoices={bundle.invoices} jobId={bundle.job.id} jobTitle={bundle.job.job_title} quote={bundle.quote ?? null} />
          </div>

          <div className="card p-5">
            <p className="section-kicker text-[0.65rem] uppercase">Materials</p>
            <div className="mt-4 rounded-2xl border border-[var(--border)] bg-black/20 p-4">
              <p className="font-semibold text-white">{bundle.materials.length > 0 ? "Materials list created" : "Materials not created yet"}</p>
              <p className="mt-2 text-sm text-[var(--muted)]">
                {bundle.materials.length > 0
                  ? `${bundle.materials.length} item${bundle.materials.length === 1 ? "" : "s"} on file${materialsSummary ? ` | ${materialsSummary}` : ""}. Open the dedicated materials view to check suppliers, status, quantities, and notes.`
                  : "Materials will appear after the first quote draft. Keep this job file clean and use the dedicated materials view for ordering."}
              </p>
            </div>
            <Link className={bundle.materials.length > 0 ? "button-primary mt-4 w-full" : "button-ghost mt-4 w-full"} href={materialsHref}>
              Open Materials View
            </Link>
          </div>

            <div className="card p-5">
              <p className="section-kicker text-[0.65rem] uppercase">Documents</p>
              <p className="mt-3 text-sm text-[var(--muted)]">
                Keep supplier files, customer paperwork, reports, and generated PDFs together so they are ready to preview or attach when sending the quote.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <MiniInfoCard label="All files" value={String(totalDocumentCount)} hint="Everything on this job file" />
                <MiniInfoCard label="Uploaded" value={String(uploadedDocumentCount)} hint="Manual uploads and third-party files" />
                <MiniInfoCard label="Generated" value={String(generatedDocumentCount)} hint="Quote, invoice, and survey outputs" />
              </div>
              <div className="mt-4">
                <DocumentUploadButton jobId={bundle.job.id} />
              </div>
              <div className="mt-4 grid gap-2">
              {bundle.quote ? (
                <Link className="button-primary !justify-start !px-3 !py-2 text-sm" href={`/jobs/${bundle.job.id}/quote/preview`}>
                  Preview Quote
                </Link>
              ) : null}
              {bundle.invoices.map((invoice) => (
                <Link className="button-secondary !justify-start !px-3 !py-2 text-sm" href={`/jobs/${bundle.job.id}/invoice/${invoice.id}/preview`} key={invoice.id}>
                  Preview Invoice {invoice.invoice_ref}
                </Link>
              ))}
              <Link className="button-ghost !justify-start !px-3 !py-2 text-sm" href={`/jobs/${bundle.job.id}/jobsheet/preview`}>
                Preview Job Sheet
              </Link>
              <Link className="button-ghost !justify-start !px-3 !py-2 text-sm" href={`/jobs/${bundle.job.id}/survey/report/preview`}>
                Preview Survey Report
              </Link>
              <Link className="button-ghost !justify-start !px-3 !py-2 text-sm" href={`/jobs/${bundle.job.id}/completion/preview`}>
                Preview Completion Certificate
              </Link>
            </div>
            <div className="mt-4 grid gap-3">
              {bundle.documents.length > 0 ? (
                Object.entries(documentGroups).map(([group, documents]) =>
                  documents.length > 0 ? (
                    <div className="rounded-2xl border border-[var(--border)] bg-black/20 p-3" key={group}>
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--gold-d)]">{group}</p>
                        <span className="text-xs text-[var(--muted)]">{documents.length} file{documents.length === 1 ? "" : "s"}</span>
                      </div>
                      <div className="mt-3 space-y-2">
                        {documents.map((document) => (
                          <div className="rounded-xl border border-[var(--border)] bg-black/20 p-3" key={document.id}>
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                              <div className="min-w-0">
                                <p className="truncate font-semibold text-white">{document.display_name}</p>
                                <p className="mt-1 text-xs text-[var(--muted)]">
                                  {getDocumentDisplayType(document)}
                                  {document.created_at ? ` | Added ${formatDate(document.created_at)}` : ""}
                                  {document.file_size ? ` | ${formatFileSize(document.file_size)}` : ""}
                                </p>
                              </div>
                              <a className="inline-flex shrink-0 text-sm font-semibold text-[var(--gold-l)] underline-offset-4 hover:underline" href={getJobDocumentHref(document)} target="_blank">
                                Open document
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null
                )
              ) : (
                <p className="text-sm text-[var(--muted)]">Generated quote documents and supporting files will appear here.</p>
              )}
            </div>
          </div>

          <div className="card p-5">
            <p className="section-kicker text-[0.65rem] uppercase">Email Log</p>
            <p className="mt-3 text-sm text-[var(--muted)]">Everything sent from this job file, with quick links back to the related quote when available.</p>
            <div className="mt-4 space-y-3">
              {bundle.email_logs.length > 0 ? (
                bundle.email_logs.map((item) => (
                  <div className="rounded-2xl border p-3" key={item.id}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-white">{item.subject}</p>
                        <p className="mt-1 text-sm text-[var(--muted)]">{item.to_email ?? item.to_phone ?? "Recipient not saved"}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {item.channel ? <span className="rounded-full border border-[var(--border)] bg-black/20 px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-[var(--dim)]">{item.channel}</span> : null}
                        {item.template_type ? <span className="rounded-full border border-[var(--border)] bg-black/20 px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-[var(--dim)]">{item.template_type}</span> : null}
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-[var(--dim)]">
                      {item.status} | {formatDate(item.sent_at ?? null)}
                      {item.opened_at ? ` | Opened ${formatDate(item.opened_at)}` : ""}
                      {item.clicked_at ? ` | Clicked ${formatDate(item.clicked_at)}` : ""}
                    </p>
                    {item.quote_id ? (
                      <Link className="mt-3 inline-flex text-sm font-semibold text-[var(--gold-l)] underline-offset-4 hover:underline" href={`/jobs/${bundle.job.id}/quote/preview`}>
                        Open related quote
                      </Link>
                    ) : null}
                  </div>
                ))
              ) : (
                <p className="text-sm text-[var(--muted)]">No quote emails have been sent yet.</p>
              )}
            </div>
          </div>

          <div className="card p-5">
            <p className="section-kicker text-[0.65rem] uppercase">Danger Zone</p>
            <p className="mt-3 text-sm text-[var(--muted)]">
              Use this for test jobs or mistaken records only. Live customer jobs should normally be marked Lost or Archived instead.
            </p>
            <div className="mt-4">
              <DeleteJobAction jobId={bundle.job.id} jobRef={bundle.job.job_ref} jobTitle={bundle.job.job_title} />
            </div>
          </div>
        </aside>
      </section>
    </AppShell>
  );
}

function SmartActionLink({ className, href, children }: { className: string; href: string; children: React.ReactNode }) {
  if (href.startsWith("tel:") || href.startsWith("mailto:") || href.startsWith("http")) {
    return (
      <a className={className} href={href}>
        {children}
      </a>
    );
  }

  return (
    <Link className={className} href={href as Route}>
      {children}
    </Link>
  );
}

function DossierStat({ label, value, hint, href }: { label: string; value: string; hint: string; href?: string }) {
  const content = (
    <>
      <p className="text-[0.62rem] font-bold uppercase tracking-[0.22em] text-[var(--dim)]">{label}</p>
      <p className="mt-2 truncate text-lg font-semibold text-white">{value}</p>
      <p className="mt-1 truncate text-xs text-[var(--muted)]">{hint}</p>
    </>
  );

  if (!href) return <div className="rounded-2xl border border-[var(--border)] bg-black/20 p-3">{content}</div>;
  if (href.startsWith("tel:")) {
    return (
      <a className="rounded-2xl border border-[var(--border)] bg-black/20 p-3 transition hover:border-[var(--gold)]/60" href={href}>
        {content}
      </a>
    );
  }
  return (
    <Link className="rounded-2xl border border-[var(--border)] bg-black/20 p-3 transition hover:border-[var(--gold)]/60" href={href as Route}>
      {content}
    </Link>
  );
}

function InfoRow({ label, value, href }: { label: string; value: string; href?: string }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl border border-[var(--border)] bg-black/20 p-3">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--dim)]">{label}</p>
      {href ? (
        <a className="max-w-[65%] text-right text-[var(--gold-l)] underline-offset-4 hover:underline" href={href}>
          {value}
        </a>
      ) : (
        <p className="max-w-[65%] text-right text-[var(--text)]">{value}</p>
      )}
    </div>
  );
}

function MiniInfoCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-black/20 p-3">
      <p className="text-[0.62rem] font-bold uppercase tracking-[0.22em] text-[var(--dim)]">{label}</p>
      <p className="mt-2 text-lg font-semibold text-white">{value}</p>
      <p className="mt-1 text-xs text-[var(--muted)]">{hint}</p>
    </div>
  );
}

function QuoteOptionMiniBreakdown({ option }: { option: QuoteOption }) {
  const rows = buildQuoteOptionPriceSummary(option);
  if (!rows.length) return null;

  return (
    <div className="mt-3 space-y-2 border-t border-[var(--border)] pt-3 text-xs">
      {rows.map((row) => (
        <div className="space-y-1" key={row.id}>
          <div className="flex justify-between gap-3 text-[var(--text)]">
            <span>{row.label}</span>
            <span className="font-semibold text-white">{currency(row.net)}</span>
          </div>
          <div className="flex justify-between gap-3 text-[var(--muted)]">
            <span>{row.vatLabel}</span>
            <span>{currency(row.vat)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function groupDocuments(documents: JobDocumentRecord[]) {
  return {
    Survey: documents.filter((document) => document.document_type.includes("survey")),
    Quotes: documents.filter((document) => document.document_type.includes("quote")),
    Invoices: documents.filter((document) => document.document_type.includes("invoice")),
    Uploads: documents.filter((document) => !document.document_type.includes("survey") && !document.document_type.includes("quote") && !document.document_type.includes("invoice"))
  };
}

type ActivityFeedItem = {
  type: "workflow" | "document" | "email";
  badge: string;
  label: string;
  detail: string | null;
  date: string | null | undefined;
  href?: string;
};

function buildActivityFeed({
  events,
  documents,
  emailLogs,
  jobId
}: {
  events: Array<{ label: string; detail: string | null; date: string | null | undefined }>;
  documents: JobDocumentRecord[];
  emailLogs: Array<{ subject: string; status: string; sent_at?: string | null; quote_id?: string | null; to_email?: string | null }>;
  jobId: string;
}): ActivityFeedItem[] {
  const workflowItems: ActivityFeedItem[] = events.map((event) => ({
    type: "workflow",
    badge: "Workflow",
    label: event.label,
    detail: event.detail,
    date: event.date
  }));

  const documentItems: ActivityFeedItem[] = documents.slice(0, 6).map((document) => ({
    type: "document",
    badge: "Document",
    label: document.display_name,
    detail: getDocumentDisplayType(document),
    date: document.created_at,
    href: getJobDocumentHref(document)
  }));

  const emailItems: ActivityFeedItem[] = emailLogs.slice(0, 6).map((item) => ({
    type: "email",
    badge: "Email",
    label: item.subject,
    detail: [item.status, item.to_email].filter(Boolean).join(" | ") || null,
    date: item.sent_at,
    href: item.quote_id ? `/jobs/${jobId}/quote/preview` : undefined
  }));

  return [...workflowItems, ...documentItems, ...emailItems]
    .filter((item) => item.date || item.detail)
    .sort((left, right) => new Date(right.date ?? 0).getTime() - new Date(left.date ?? 0).getTime())
    .slice(0, 10);
}

function getActivityDotClass(type: ActivityFeedItem["type"]) {
  if (type === "document") return "bg-[#3b82f6]";
  if (type === "email") return "bg-[#10b981]";
  return "bg-[var(--gold)]";
}

function getDocumentDisplayType(document: JobDocumentRecord) {
  if (document.document_type === "survey_snapshot") return "Survey snapshot";
  if (document.document_type === "quote_html") return "Quote HTML snapshot";
  if (document.document_type === "quote_pdf") return "Quote PDF";
  if (document.document_type === "invoice_pdf") return "Invoice PDF";
  if (document.document_type === "invoice_html") return "Invoice HTML snapshot";
  return document.document_type;
}

function formatFileSize(size: number) {
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function summarizeMaterials(materials: Array<{ required_status?: string | null }>) {
  const counts = materials.reduce<Record<string, number>>((summary, material) => {
    const status = material.required_status || "TBC";
    summary[status] = (summary[status] ?? 0) + 1;
    return summary;
  }, {});

  return Object.entries(counts)
    .slice(0, 3)
    .map(([status, count]) => `${count} ${status}`)
    .join(" | ");
}
