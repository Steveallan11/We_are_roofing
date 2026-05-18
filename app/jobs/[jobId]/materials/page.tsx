import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { MaterialsEditor } from "@/components/materials/materials-editor";
import { getJobBundle, getSuppliers } from "@/lib/data";

type Props = {
  params: Promise<{ jobId: string }>;
};

export default async function MaterialsPage({ params }: Props) {
  const { jobId } = await params;
  const [bundle, suppliers] = await Promise.all([getJobBundle(jobId), getSuppliers()]);
  if (!bundle) notFound();

  return (
    <AppShell
      title="Materials"
      subtitle="This view gives the office and site team a simple, single list of what the quote is likely to need before booking or ordering."
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
          <h2 className="mt-2 font-condensed text-3xl text-white">{bundle.job.job_title}</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">{bundle.job.property_address}</p>
        </div>

        <MaterialsEditor initialMaterials={bundle.materials} jobId={bundle.job.id} quoteId={bundle.quote?.id ?? null} suppliers={suppliers} />
      </div>
    </AppShell>
  );
}
