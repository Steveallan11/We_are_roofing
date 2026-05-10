import Link from "next/link";
import { notFound } from "next/navigation";
import { PhotoUploadButton } from "@/components/forms/photo-upload";
import { StatusPill } from "@/components/ui/status-pill";
import { getJobBundle } from "@/lib/data";
import { currency, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ jobId: string }> };

export default async function JobDetailPage({ params }: Props) {
  const { jobId } = await params;
  const bundle = await getJobBundle(jobId);
  if (!bundle) notFound();

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--gold)]">{bundle.job.roof_type ?? "Roofing"}</span>
            <StatusPill status={bundle.job.status} />
          </div>
          <h1 className="mt-1 font-condensed text-3xl text-white">{bundle.job.job_title}</h1>
          <p className="text-sm text-[var(--muted)]">{bundle.job.property_address}</p>
        </div>
        <div className="flex gap-2">
          <Link className="button-secondary text-sm" href={`/jobs/${jobId}/survey`}>
            Open Survey
          </Link>
          <Link className="button-ghost text-sm" href="/dashboard">
            Back
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="card p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--gold)]">Customer</p>
          <h3 className="mt-1 font-condensed text-xl text-white">{bundle.customer?.full_name ?? "Unknown"}</h3>
          <div className="mt-2 space-y-1 text-sm text-[var(--muted)]">
            {bundle.customer?.phone && <p>{bundle.customer.phone}</p>}
            {bundle.customer?.email && <p>{bundle.customer.email}</p>}
          </div>
        </div>
        <div className="card p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--gold)]">Job Details</p>
          <div className="mt-2 grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-[var(--dim)]">Type</p>
              <p className="text-[var(--text)]">{bundle.job.job_type ?? "-"}</p>
            </div>
            <div>
              <p className="text-[var(--dim)]">Value</p>
              <p className="text-[var(--gold-l)]">{bundle.job.estimated_value ? currency(bundle.job.estimated_value) : "TBC"}</p>
            </div>
            <div>
              <p className="text-[var(--dim)]">Source</p>
              <p className="text-[var(--text)]">{bundle.job.source ?? "-"}</p>
            </div>
            <div>
              <p className="text-[var(--dim)]">Updated</p>
              <p className="text-[var(--text)]">{formatDate(bundle.job.updated_at ?? null)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="card p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--gold)]">Photos ({bundle.photos.length})</p>
          <PhotoUploadButton jobId={jobId} />
        </div>
        {bundle.photos.length > 0 ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {bundle.photos.map((photo: any) => (
              <div key={photo.id} className="overflow-hidden rounded-xl border border-[var(--border)]">
                {photo.public_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photo.public_url} alt={photo.caption ?? photo.photo_type} className="h-32 w-full object-cover" />
                ) : (
                  <div className="flex h-32 items-center justify-center bg-[var(--card2)] text-xs text-[var(--dim)]">Processing...</div>
                )}
                <div className="p-2">
                  <p className="text-xs font-semibold text-white">{photo.photo_type}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[var(--dim)]">No photos yet. Upload from your phone or camera.</p>
        )}
      </div>

      <div className="card p-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--gold)]">Survey Workflow</p>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-[var(--text)]">
              {bundle.survey ? "Survey started. Continue in the dedicated field screen." : "No survey saved yet. Open the field survey screen to capture site information."}
            </p>
            <p className="mt-1 text-xs text-[var(--dim)]">Use the dedicated survey page for roof-type sections, notes, and on-site updates.</p>
          </div>
          <Link className="button-primary text-sm" href={`/jobs/${jobId}/survey`}>
            {bundle.survey ? "Continue Survey" : "Start Survey"}
          </Link>
        </div>
      </div>
    </div>
  );
}
