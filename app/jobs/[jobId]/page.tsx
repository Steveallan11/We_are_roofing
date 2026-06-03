import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { JobDetailView } from "@/components/jobs/JobDetailView";
import { QuoteActions } from "@/components/jobs/quote-actions";
import { Button } from "@/components/ui/primitives";
import { getJobBundle, getPaymentSchedule } from "@/lib/data";

type Props = {
  params: Promise<{ jobId: string }>;
};

export default async function JobDetailPage({ params }: Props) {
  const { jobId } = await params;
  const [bundle, paymentSchedule] = await Promise.all([getJobBundle(jobId), getPaymentSchedule(jobId)]);

  if (!bundle) {
    notFound();
  }

  return (
    <AppShell
      title={bundle.job.job_title}
      subtitle="Full job file: customer details, survey notes, quote progress, paperwork, and the next step to keep things moving."
      actions={
        <>
          <QuoteActions
            customerEmail={bundle.customer.email}
            customerName={bundle.customer.full_name}
            documents={bundle.documents}
            jobId={bundle.job.id}
            jobTitle={bundle.job.job_title}
            quote={bundle.quote ?? null}
          />
          <Button variant="ghost" size="md" asChild className="hidden lg:inline-flex">
            <Link href={"/today" as Route}>Back</Link>
          </Button>
        </>
      }
    >
      <JobDetailView
        job={bundle.job}
        customer={bundle.customer}
        survey={bundle.survey ?? null}
        quote={bundle.quote ?? null}
        documents={bundle.documents}
        photos={bundle.photos}
      materials={bundle.materials}
      labourPlan={bundle.labour_plan ?? null}
      invoices={bundle.invoices}
        emailLogs={bundle.email_logs}
        paymentSchedule={paymentSchedule}
      />
    </AppShell>
  );
}
