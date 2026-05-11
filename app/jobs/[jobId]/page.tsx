import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { PhotoUploadButton } from "@/components/forms/photo-upload";
import { QuoteActions } from "@/components/jobs/quote-actions";
import { StatusPill } from "@/components/ui/status-pill";
import { getJobBundle } from "@/lib/data";
import { getNextActionLabel } from "@/lib/job-workflow";
import { currency, formatDate } from "@/lib/utils";

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
          <div className="card p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="section-kicker text-[0.65rem] uppercase">{bundle.job.job_ref ?? "WR-J-TBC"}</p>
                <h2 className="mt-2 font-condensed text-3xl text-white">{bundle.customer.full_name}</h2>
                <p className="mt-2 text-sm text-[var(--muted)]">{bundle.job.property_address}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--muted)]">
                  <span className="rounded-full border border-[var(--border)] px-3 py-1">{bundle.job.roof_type ?? "Roof type TBC"}</span>
                  <span className="rounded-full border border-[var(--border)] px-3 py-1">{bundle.job.job_type ?? "Job type TBC"}</span>
                  {bundle.quote ? <StatusPill status={bundle.quote.status} /> : null}
                </div>
              </div>
              <StatusPill status={bundle.job.status} />
            </div>
            <div className="gold-divider my-4" />
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <p className="section-kicker text-[0.58rem] uppercase">Contact</p>
                <p className="mt-2 text-sm text-[var(--text)]">{bundle.customer.phone ?? "No phone saved"}</p>
                <p className="text-sm text-[var(--muted)]">{bundle.customer.email ?? "No email saved"}</p>
              </div>
              <div>
                <p className="section-kicker text-[0.58rem] uppercase">Commercial</p>
                <p className="mt-2 text-sm text-[var(--text)]">
                  {bundle.job.estimated_value ? currency(bundle.job.estimated_value) : "Estimate still to confirm"}
                </p>
                <p className="text-sm text-[var(--muted)]">Last updated {formatDate(bundle.job.updated_at ?? null)}</p>
              </div>
              <div>
                <p className="section-kicker text-[0.58rem] uppercase">Next Action</p>
                <p className="mt-2 text-sm text-[var(--text)]">{getNextActionLabel(bundle.job)}</p>
                <p className="text-sm text-[var(--muted)]">Created {formatDate(bundle.job.created_at ?? null)}</p>
              </div>
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
                <p className="text-sm text-[var(--text)]">{bundle.survey?.measurements ?? "Not captured yet"}</p>
              </div>
              <div>
                <p className="label">Access</p>
                <p className="text-sm text-[var(--text)]">{bundle.survey?.access_notes ?? "Not captured yet"}</p>
              </div>
              <div>
                <p className="label">Survey Snapshot</p>
                <p className="text-sm text-[var(--text)]">
                  {bundle.documents.some((document) => document.document_type === "survey_snapshot") ? "Saved in Documents" : "Will appear after survey save"}
                </p>
              </div>
            </div>
            <div className="mt-4">
              <Link className="button-secondary" href={`/jobs/${bundle.job.id}/survey`}>
                Open Survey Workspace
              </Link>
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
              </div>
            ) : (
              <p className="mt-4 text-sm text-[var(--muted)]">No quote draft saved yet.</p>
            )}
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
            <div className="mt-4 space-y-3">
              {bundle.documents.length > 0 ? (
                bundle.documents.map((document) => (
                  <div className="rounded-2xl border p-3" key={document.id}>
                      <p className="font-semibold text-white">{document.display_name}</p>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      {document.document_type === "survey_snapshot"
                        ? "Survey snapshot"
                        : document.document_type === "quote_html"
                          ? "Quote HTML snapshot"
                          : document.document_type === "quote_pdf"
                            ? "Quote PDF"
                            : document.document_type}
                    </p>
                    {document.public_url ? (
                      <a className="mt-2 inline-flex text-sm text-[var(--gold-l)] underline-offset-4 hover:underline" href={document.public_url} rel="noreferrer" target="_blank">
                        Open document
                      </a>
                    ) : null}
                  </div>
                ))
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
        </aside>
      </section>
    </AppShell>
  );
}
