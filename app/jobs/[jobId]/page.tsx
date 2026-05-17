import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { PhotoUploadButton } from "@/components/forms/photo-upload";
import { DeleteJobAction } from "@/components/jobs/delete-job-action";
import { InvoiceActions } from "@/components/jobs/invoice-actions";
import { QuoteActions } from "@/components/jobs/quote-actions";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { StatusPill } from "@/components/ui/status-pill";
import { getJobBundle } from "@/lib/data";
import { getNextActionLabel } from "@/lib/job-workflow";
import { getNextAction } from "@/lib/jobs/nextAction";
import { getSurveyHighlights, getSurveyMeasurementsSummary } from "@/lib/survey-utils";
import { currency, formatDate } from "@/lib/utils";
import type { JobDocumentRecord } from "@/lib/types";

type Props = {
  params: Promise<{ jobId: string }>;
};

export default async function JobDetailPage({ params }: Props) {
  const { jobId } = await params;
  const bundle = await getJobBundle(jobId);

  if (!bundle) {
    notFound();
  }

  const materialsHref = `/jobs/${bundle.job.id}/materials` as Route;
  const roofSurveyHref = `/jobs/${bundle.job.id}/roof-survey` as Route;
  const surveyHighlights = getSurveyHighlights(bundle.survey);
  const surveyMeasurements = getSurveyMeasurementsSummary(bundle.survey);
  const documentGroups = groupDocuments(bundle.documents);
  const timeline = [
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

  return (
    <AppShell
      title={bundle.job.job_title}
      subtitle="This is the full job file: customer, survey, photos, quote progress, documents, and the next action needed to move the work forward."
      actions={
        <>
          <QuoteActions customerEmail={bundle.customer.email} jobId={bundle.job.id} quote={bundle.quote ?? null} />
          <Link className="button-ghost" href="/dashboard">
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
                  <h2 className="mt-3 font-condensed text-4xl leading-none text-white">{bundle.customer.full_name}</h2>
                  <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">{bundle.job.property_address}</p>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs text-[var(--muted)]">
                    <span className="rounded-full border border-[var(--border)] bg-black/20 px-3 py-1">{bundle.job.roof_type ?? "Roof type TBC"}</span>
                    <span className="rounded-full border border-[var(--border)] bg-black/20 px-3 py-1">{bundle.job.job_type ?? "Job type TBC"}</span>
                    <span className="rounded-full border border-[var(--border)] bg-black/20 px-3 py-1">{bundle.customer.town ?? bundle.job.postcode ?? "Town TBC"}</span>
                  </div>
                </div>
                <div className="rounded-[1.25rem] border border-[var(--gold)]/35 bg-[var(--gold)]/10 p-4 lg:min-w-[260px]">
                  <p className="section-kicker text-[0.58rem] uppercase">Next Action</p>
                  <p className="mt-2 text-lg font-semibold text-white">{nextAction.label}</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">{getNextActionLabel(bundle.job)}</p>
                  <SmartActionLink className="button-primary mt-4 min-h-11 w-full !rounded-xl !py-2 text-sm" href={nextAction.href}>
                    {nextAction.label}
                  </SmartActionLink>
                </div>
              </div>
            </div>

            <div className="grid gap-3 p-5 md:grid-cols-4">
              <DossierStat label="Contact" value={bundle.customer.phone ?? "No phone"} hint={bundle.customer.email ?? "No email"} href={bundle.customer.phone ? `tel:${bundle.customer.phone}` : undefined} />
              <DossierStat label="Commercial" value={bundle.job.estimated_value ? currency(bundle.job.estimated_value) : "TBC"} hint="Estimated value" />
              <DossierStat label="Survey" value={bundle.survey ? "Saved" : "Not started"} hint={bundle.survey ? formatDate(bundle.survey.updated_at ?? bundle.survey.created_at) : "Open survey workspace"} href={`/jobs/${bundle.job.id}/survey`} />
              <DossierStat label="Documents" value={bundle.documents.length.toString()} hint="Filed against this job" />
            </div>

            <div className="grid gap-3 border-t border-[var(--border)] bg-black/10 p-5 md:grid-cols-4">
              <Link className="button-secondary !min-h-11 !rounded-xl !px-3 !py-2 text-sm" href={`/jobs/${bundle.job.id}/survey`}>
                Survey
              </Link>
              <Link className="button-secondary !min-h-11 !rounded-xl !px-3 !py-2 text-sm" href={`/jobs/${bundle.job.id}/quote`}>
                Quote
              </Link>
              <Link className="button-secondary !min-h-11 !rounded-xl !px-3 !py-2 text-sm" href={materialsHref}>
                Materials
              </Link>
              <Link className="button-secondary !min-h-11 !rounded-xl !px-3 !py-2 text-sm" href={roofSurveyHref}>
                Takeoff Tool
              </Link>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="card p-5">
              <p className="section-kicker text-[0.65rem] uppercase">Customer</p>
              <div className="mt-4 space-y-3 text-sm">
                <InfoRow label="Name" value={bundle.customer.full_name} />
                <InfoRow label="Phone" value={bundle.customer.phone ?? "No phone saved"} href={bundle.customer.phone ? `tel:${bundle.customer.phone}` : undefined} />
                <InfoRow label="Email" value={bundle.customer.email ?? "No email saved"} />
                <InfoRow label="Address" value={bundle.job.property_address} />
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

          <div className="card p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="section-kicker text-[0.65rem] uppercase">{bundle.job.job_ref ?? "WR-J-TBC"}</p>
                <h2 className="mt-2 font-condensed text-3xl text-white">Job timeline</h2>
              </div>
              <Link className="button-ghost !px-4 !py-2 text-sm" href={`/jobs/${bundle.job.id}`}>
                Job file
              </Link>
            </div>
            <div className="mt-5 space-y-3">
              {timeline.map((event, index) => (
                <div className="grid grid-cols-[1rem_1fr] gap-3" key={`${event.label}-${index}`}>
                  <div className="relative flex justify-center">
                    <span className="mt-1.5 h-3 w-3 rounded-full bg-[var(--gold)] shadow-[0_0_18px_rgba(212,175,55,0.35)]" />
                    {index < timeline.length - 1 ? <span className="absolute top-5 h-[calc(100%+0.25rem)] w-px bg-[var(--border)]" /> : null}
                  </div>
                  <div className="rounded-2xl border border-[var(--border)] bg-black/20 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold text-white">{event.label}</p>
                      <p className="text-xs text-[var(--muted)]">{formatDate(event.date ?? null)}</p>
                    </div>
                    {event.detail ? <p className="mt-1 text-sm text-[var(--muted)]">{event.detail}</p> : null}
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
                <p className="text-3xl font-display text-[var(--gold-l)]">{currency(bundle.quote.total)}</p>
                <p className="text-sm text-[var(--muted)]">{bundle.quote.customer_email_subject}</p>
                <p className="text-sm text-[var(--text)]">Next step: {getNextActionLabel(bundle.job)}</p>
                <Link className="button-secondary !mt-4 w-full !py-2 text-sm" href={`/jobs/${bundle.job.id}/quote`}>
                  Open Quote Review
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
            <InvoiceActions jobId={bundle.job.id} invoices={bundle.invoices} quote={bundle.quote ?? null} />
          </div>

          <div className="card p-5">
            <p className="section-kicker text-[0.65rem] uppercase">Materials</p>
            <div className="mt-4 space-y-3">
              {bundle.materials.length > 0 ? (
                bundle.materials.map((material) => (
                  <div className="rounded-2xl border p-3" key={material.id}>
                    <p className="font-semibold text-white">{material.item_name}</p>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      {material.quantity} {material.unit} - {material.required_status}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-[var(--muted)]">Materials will appear after the first quote draft.</p>
              )}
            </div>
            <Link className="button-ghost mt-4 w-full" href={materialsHref}>
              Open Materials View
            </Link>
          </div>

          <div className="card p-5">
            <p className="section-kicker text-[0.65rem] uppercase">Documents</p>
            <div className="mt-4 grid gap-3">
              {bundle.documents.length > 0 ? (
                Object.entries(documentGroups).map(([group, documents]) =>
                  documents.length > 0 ? (
                    <div className="rounded-2xl border border-[var(--border)] bg-black/20 p-3" key={group}>
                      <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--gold-d)]">{group}</p>
                      <div className="mt-3 space-y-2">
                        {documents.map((document) => (
                          <div className="rounded-xl border border-[var(--border)] bg-black/20 p-3" key={document.id}>
                            <p className="font-semibold text-white">{document.display_name}</p>
                            <p className="mt-1 text-xs text-[var(--muted)]">{getDocumentDisplayType(document)}</p>
                            {document.public_url ? (
                              <a className="mt-2 inline-flex text-sm text-[var(--gold-l)] underline-offset-4 hover:underline" href={document.public_url} rel="noreferrer" target="_blank">
                                Open document
                              </a>
                            ) : (
                              <p className="mt-2 text-xs text-[var(--dim)]">Snapshot saved in job file</p>
                            )}
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
            <div className="mt-4 space-y-3">
              {bundle.email_logs.length > 0 ? (
                bundle.email_logs.map((item) => (
                  <div className="rounded-2xl border p-3" key={item.id}>
                    <p className="font-semibold text-white">{item.subject}</p>
                    <p className="mt-1 text-sm text-[var(--muted)]">{item.to_email}</p>
                    <p className="mt-1 text-xs text-[var(--dim)]">
                      {item.status} - {formatDate(item.sent_at ?? null)}
                    </p>
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

function groupDocuments(documents: JobDocumentRecord[]) {
  return {
    Survey: documents.filter((document) => document.document_type.includes("survey")),
    Quotes: documents.filter((document) => document.document_type.includes("quote")),
    Invoices: documents.filter((document) => document.document_type.includes("invoice")),
    Uploads: documents.filter((document) => !document.document_type.includes("survey") && !document.document_type.includes("quote") && !document.document_type.includes("invoice"))
  };
}

function getDocumentDisplayType(document: JobDocumentRecord) {
  if (document.document_type === "survey_snapshot") return "Survey snapshot";
  if (document.document_type === "quote_html") return "Quote HTML snapshot";
  if (document.document_type === "quote_pdf") return "Quote PDF";
  if (document.document_type === "invoice_pdf") return "Invoice PDF";
  if (document.document_type === "invoice_html") return "Invoice HTML snapshot";
  return document.document_type;
}
