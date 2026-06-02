import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/primitives";
import { BookSurveyForm } from "@/components/jobs/book-survey-form";
import { getJobBundle } from "@/lib/data";

type Props = {
  params: Promise<{ jobId: string }>;
};

export default async function BookSurveyPage({ params }: Props) {
  const { jobId } = await params;
  const bundle = await getJobBundle(jobId);
  if (!bundle) notFound();

  return (
    <AppShell
      title="Book Survey"
      subtitle="Pick the survey date, check the weather, add access notes, and send confirmation to the customer."
      actions={
        <Button variant="ghost" size="md" asChild>
          <Link href={(`/jobs/${bundle.job.id}` as Route)}>Back to Job</Link>
        </Button>
      }
    >
      <BookSurveyForm bundle={bundle} />
    </AppShell>
  );
}
