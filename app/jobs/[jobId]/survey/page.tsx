import Link from "next/link";
import { notFound } from "next/navigation";
import { PhotoUploadButton } from "@/components/forms/photo-upload";
import { SurveyForm } from "@/components/forms/survey-form";
import { StatusPill } from "@/components/ui/status-pill";
import { getJobBundle } from "@/lib/data";
import { formatDate } from "@/lib/utils";

type Props = { params: Promise<{ jobId: string }> };

export default async function SurveyPage({ params }: Props) {
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
          <h1 className="mt-1 font-condensed text-3xl text-white">Site Survey</h1>
          <p className="text-sm text-[var(--muted)]">
            {bundle.customer?.full_name ?? "Unknown customer"} · {bundle.job.property_address}
          </p>
        </div>
        <div className="flex gap-2">
          <Link className="button-secondary text-sm" href={`/jobs/${jobId}`}>
            Job Overview
          </Link>
          <Link className="button-ghost text-sm" href="/dashboard">
            Dashboard
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--gold)]">Customer</p>
          <p className="mt-2 font-condensed text-xl text-white">{bundle.customer?.full_name ?? "Unknown"}</p>
          <p className="mt-1 text-sm text-[var(--muted)]">{bundle.customer?.phone ?? "No phone saved"}</p>
        </div>
        <div className="card p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--gold)]">Survey Status</p>
          <p className="mt-2 text-sm text-[var(--text)]">{bundle.survey ? "Survey already started" : "No survey saved yet"}</p>
          <p className="mt-1 text-xs text-[var(--dim)]">Updated {formatDate(bundle.survey?.updated_at ?? bundle.job.updated_at ?? null)}</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--gold)]">Photos</p>
              <p className="mt-2 text-sm text-[var(--text)]">{bundle.photos.length} uploaded</p>
            </div>
            <PhotoUploadButton jobId={jobId} />
          </div>
        </div>
      </div>

      {bundle.photos.length > 0 ? (
        <div className="card p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--gold)]">Latest Photos</p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {bundle.photos.slice(0, 8).map((photo: any) => (
              <div key={photo.id} className="overflow-hidden rounded-xl border border-[var(--border)]">
                {photo.public_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img alt={photo.caption ?? photo.photo_type} className="h-28 w-full object-cover" src={photo.public_url} />
                ) : (
                  <div className="flex h-28 items-center justify-center bg-[var(--card2)] text-xs text-[var(--dim)]">Processing...</div>
                )}
                <div className="p-2">
                  <p className="text-xs font-semibold text-white">{photo.photo_type}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <SurveyForm jobId={jobId} initialSurvey={bundle.survey} />
    </div>
  );
}
