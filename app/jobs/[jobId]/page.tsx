import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusPill } from "@/components/ui/status-pill";
import { SurveyForm } from "@/components/forms/survey-form";
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
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--gold)]">{bundle.job.roof_type ?? "Roofing"}</span>
            <StatusPill status={bundle.job.status} />
          </div>
          <h1 className="font-condensed text-3xl text-white mt-1">{bundle.job.job_title}</h1>
          <p className="text-sm text-[var(--muted)]">{bundle.job.property_address}</p>
        </div>
        <div className="flex gap-2">
          <Link className="button-ghost text-sm" href="/dashboard">Back</Link>
        </div>
      </div>

      {/* Customer + Job Info */}
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

      {/* Quote Summary */}
      {bundle.quote && (
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--gold)]">Quote</p>
              <p className="font-condensed text-2xl text-[var(--gold-l)] mt-1">{currency(bundle.quote.total)}</p>
              <p className="text-xs text-[var(--muted)]">{bundle.quote.quote_ref} — <StatusPill status={bundle.quote.status} /></p>
            </div>
            <Link className="button-secondary text-sm" href={`/jobs/${jobId}/quote`}>View Quote</Link>
          </div>
        </div>
      )}

      {/* Photos */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--gold)]">Photos ({bundle.photos.length})</p>
          <PhotoUploadButton jobId={jobId} />
        </div>
        {bundle.photos.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {bundle.photos.map(p => (
              <div key={p.id} className="rounded-xl overflow-hidden border border-[var(--border)]">
                {p.public_url ? (
                  <img src={p.public_url} alt={p.caption ?? p.photo_type} className="h-32 w-full object-cover" />
                ) : (
                  <div className="h-32 flex items-center justify-center bg-[var(--card2)] text-xs text-[var(--dim)]">Processing...</div>
                )}
                <div className="p-2">
                  <p className="text-xs font-semibold text-white">{p.photo_type}</p>
                  {p.caption && <p className="text-[10px] text-[var(--dim)]">{p.caption}</p>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[var(--dim)]">No photos yet. Upload from your phone or camera.</p>
        )}
      </div>

      {/* Survey */}
      <SurveyForm jobId={jobId} initialSurvey={bundle.survey} />

      {/* Materials */}
      {bundle.materials.length > 0 && (
        <div className="card p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--gold)] mb-3">Materials ({bundle.materials.length})</p>
          <div className="space-y-2">
            {bundle.materials.map(m => (
              <div key={m.id} className="rounded-xl border border-[var(--border)] p-3 flex justify-between items-center">
                <div>
                  <p className="text-sm font-semibold text-white">{m.item_name}</p>
                  <p className="text-xs text-[var(--muted)]">{m.quantity} {m.unit}</p>
                </div>
                <StatusPill status={m.required_status as any} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PhotoUploadButton({ jobId }: { jobId: string }) {
  return (
    <label className="button-secondary text-sm cursor-pointer">
      Upload Photos
      <input type="file" accept="image/*,video/*" multiple className="hidden" onChange={async (e) => {
        const files = e.target.files;
        if (!files?.length) return;
        for (const file of Array.from(files)) {
          const fd = new FormData();
          fd.append("file", file);
          fd.append("photo_type", "General");
          await fetch(`/api/jobs/${jobId}/photos`, { method: "POST", body: fd });
        }
        window.location.reload();
      }} />
    </label>
  );
}
