import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { MaterialsEditor } from "@/components/materials/materials-editor";
import { getJobBundle, getSuppliers } from "@/lib/data";
import { getJobPipelineValue, isFromOptionValue } from "@/lib/quotes/value";
import { currency } from "@/lib/utils";

type Props = {
  params: Promise<{ jobId: string }>;
};

export default async function MaterialsPage({ params }: Props) {
  const { jobId } = await params;
  const [bundle, suppliers] = await Promise.all([getJobBundle(jobId), getSuppliers()]);
  if (!bundle) notFound();
  const jobValue = getJobPipelineValue({ ...bundle.job, quote: bundle.quote ?? null });
  const jobValueLabel = jobValue ? `${isFromOptionValue({ ...bundle.job, quote: bundle.quote ?? null }) ? "From " : ""}${currency(jobValue)}` : "TBC";
  const requiredCount = bundle.materials.filter((material) => material.required_status === "Definitely Needed").length;
  const checkCount = bundle.materials.filter((material) => material.required_status === "May Be Needed" || material.required_status === "Check On Site").length;

  return (
    <AppShell
      title="Materials"
      subtitle="A practical ordering view for checking what is needed, assigning suppliers, and preparing the job before booking or site start."
      actions={
        <>
          <Link className="button-ghost" href={`/jobs/${bundle.job.id}`}>
            Back to Job
          </Link>
          <Link className="button-secondary" href={`/jobs/${bundle.job.id}/quote`}>
            Quote Review
          </Link>
        </>
      }
    >
      <div className="stack">
        <div className="card p-5">
          <p className="section-kicker text-[0.65rem] uppercase">Job</p>
          <div className="mt-2 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
            <div>
              <h2 className="font-condensed text-3xl text-white">{bundle.job.job_title}</h2>
              <p className="mt-2 text-sm text-[var(--muted)]">{bundle.job.property_address}</p>
              <p className="mt-2 text-sm text-[var(--muted)]">{bundle.job.job_ref ?? "WR-J-TBC"} | {bundle.customer.full_name}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[520px]">
              <ContextTile label="Job value" value={jobValueLabel} />
              <ContextTile label="Need to order" value={String(requiredCount)} />
              <ContextTile label="Check first" value={String(checkCount)} />
            </div>
          </div>
        </div>

        <MaterialsEditor initialMaterials={bundle.materials} jobId={bundle.job.id} quoteId={bundle.quote?.id ?? null} suppliers={suppliers} />
      </div>
    </AppShell>
  );
}

function ContextTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-black/20 p-3">
      <p className="text-[0.62rem] font-bold uppercase tracking-[0.18em] text-[var(--dim)]">{label}</p>
      <p className="mt-2 text-lg font-semibold text-white">{value}</p>
    </div>
  );
}
