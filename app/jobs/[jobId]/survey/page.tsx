import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { SurveyForm } from "@/components/forms/survey-form";
import { getJobBundle } from "@/lib/data";

type Props = {
  params: Promise<{ jobId: string }>;
};

export default async function SurveyPage({ params }: Props) {
  const { jobId } = await params;
  const bundle = await getJobBundle(jobId);
  if (!bundle) notFound();

  return (
    <AppShell
      title="Site Survey"
      subtitle="Capture the details needed for quoting and job overview: condition, measurements, access, likely cause, and what the customer is expecting."
      actions={
        <>
          <Link className="button-secondary" href={`/jobs/${bundle.job.id}/quote`}>
            Create Quote
          </Link>
          <Link className="button-ghost" href={`/jobs/${bundle.job.id}`}>
            Back to Job
          </Link>
        </>
      }
    >
      <div className="stack">
        <div className="card p-5">
          <p className="section-kicker text-[0.65rem] uppercase">Survey Route</p>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-[var(--border)] p-4">
              <p className="label">Roof Type</p>
              <p className="text-white">{bundle.job.roof_type ?? "Unknown"}</p>
            </div>
            <div className="rounded-2xl border border-[var(--border)] p-4">
              <p className="label">Job Type</p>
              <p className="text-white">{bundle.job.job_type ?? "Unknown"}</p>
            </div>
            <div className="rounded-2xl border border-[var(--border)] p-4">
              <p className="label">Customer</p>
              <p className="text-white">{bundle.customer.full_name}</p>
            </div>
          </div>
          <div className="mt-5 rounded-2xl border border-[var(--border)] bg-[rgba(212,175,55,0.05)] p-4 text-sm text-[var(--muted)]">
            Next refinement after this pass: add route-specific survey sections for flat roof, pitched/tiled, fascias/soffits/gutters,
            chimney/lead, and other roof types so the quote engine can work from richer structure.
          </div>
        </div>

        <SurveyForm initialSurvey={bundle.survey} />
      </div>
    </AppShell>
  );
}
