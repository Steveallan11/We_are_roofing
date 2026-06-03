import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { LabourEditor } from "@/components/jobs/labour-editor";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/primitives";
import { getJobBundle, getJobLabourPlan, getLabourPeople, getLabourRates } from "@/lib/data";

type Props = {
  params: Promise<{ jobId: string }>;
};

export default async function JobLabourPage({ params }: Props) {
  const { jobId } = await params;
  const [bundle, rates, people, labourPlan] = await Promise.all([getJobBundle(jobId), getLabourRates(), getLabourPeople(), getJobLabourPlan(jobId)]);
  if (!bundle) notFound();

  return (
    <AppShell
      title="Labour Plan"
      subtitle={`${bundle.job.job_ref ?? "WR-J-TBC"} · ${bundle.customer.full_name} · estimate labour, assign crew, and feed quote options.`}
      actions={
        <Button asChild variant="ghost" size="md">
          <Link href={`/jobs/${bundle.job.id}` as Route}>Back to Job</Link>
        </Button>
      }
    >
      <LabourEditor
        initialPlan={labourPlan}
        jobId={bundle.job.id}
        people={people}
        quoteId={bundle.quote?.id ?? null}
        rates={rates}
      />
    </AppShell>
  );
}
