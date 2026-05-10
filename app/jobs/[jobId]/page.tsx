import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusPill } from "@/components/ui/status-pill";
import { SurveyForm } from "@/components/forms/survey-form";
import { PhotoUploadButton } from "@/components/forms/photo-upload";
import { getJobBundle } from "@/lib/data";
import { currency, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ jobId: string }> };

export default async function JobDetailPage({ params }: Props) {
  const { jobId } = await params;
  const bundle = await getJobBundle(jobId);
  if (!bundle) notFound();

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--gold)]">{bundle.job.roof_type ?? "Roofing"}</span>
            <StatusPill status={bundle.job.status} />
          </div>
          <h1 className="font-condensed text-3xl text-white mt-1">{bundle.job.job_title}</h1>
          <p className="text-sm text-[var(--muted)]">{bundle.job.property_address}</p>
        </div>
        <Link className="button-ghost text-sm" href="/dashboard">Back</Link>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="card p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--gold)]">Customer</p>
          <h3 className="font-condensed text-xl text-white mt-1">{bundle.customer?.full_name ?? "Unknown"}</h3>
          <div className="mt-2 space-y-1 text-sm text-[var(--muted)]">
            {bundle.customer?.phone && <p>{bundle.customer.phone}</p>}
            {bundle.customer?.email && <p>{bundle.customer.email}</p>}
          </div>
        </div>
        <div className="card p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--gold)]">Job Details</p>
          <div className="mt-2 grid grid-cols-2 gap-3 text-sm">
            <div><p className="text-[var(--dim)]">Type</p><p className="text-[var(--text)]">{bundle.job.job_type ?? "—"}</p></div>
            <div><p className="text-[var(--dim)]">Value</p><p className="text-[var(--gold-l)]">{bundle.job.estimated_value ? currency(bundle.job.estimated_value) : "TBC"}</p></div>
            <div><p className="text-[var(--dim)]">Source</p><p className="text-[var(--text)]">{bundle.job.source ?? "—"}</p></div>
            <div><p className="text-[var(--dim)]">Updated</p><p className="text-[var(--text)]">{formatDate(bundle.job.updated_at ?? null)}</p></div>
          </div>
        </div>
      </div>

      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--gold)]">Photos ({bundle.photos.length})</p>
          <PhotoUploadButton jobId={jobId} />
        </div>
        {bundle.photos.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {bundle.photos.map((p: any) => (
              <div key={p.id} className="rounded-xl overflow-hidden border border-[var(--border)]">
                {p.public_url ? (
                  <img src={p.public_url} alt={p.caption ?? p.photo_type} className="h-32 w-full object-cover" />
                ) : (
                  <div className="h-32 flex items-center justify-center bg-[var(--card2)] text-xs text-[var(--dim)]">Processing...</div>
                )}
                <div className="p-2">
                  <p className="text-xs font-semibold text-white">{p.photo_type}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[var(--dim)]">No photos yet. Upload from your phone or camera.</p>
        )}
      </div>

      <SurveyForm jobId={jobId} initialSurvey={bundle.survey} />
    </div>
  );
}
