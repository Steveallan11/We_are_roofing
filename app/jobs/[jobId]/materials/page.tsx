import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { getJobBundle } from "@/lib/data";
import { currency } from "@/lib/utils";

type Props = {
  params: Promise<{ jobId: string }>;
};

export default async function MaterialsPage({ params }: Props) {
  const { jobId } = await params;
  const bundle = await getJobBundle(jobId);
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

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {bundle.materials.map((material) => (
            <div className="card p-5" key={material.id}>
              <p className="section-kicker text-[0.65rem] uppercase">{material.category}</p>
              <h3 className="mt-2 font-condensed text-2xl text-white">{material.item_name}</h3>
              <p className="mt-2 text-sm text-[var(--text)]">
                {material.quantity} {material.unit}
              </p>
              <p className="mt-1 text-sm text-[var(--muted)]">{material.required_status}</p>
              <p className="mt-3 text-sm text-[var(--muted)]">{material.notes}</p>
              {material.estimated_price ? (
                <p className="mt-4 font-display text-2xl text-[var(--gold-l)]">{currency(material.estimated_price)}</p>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}

