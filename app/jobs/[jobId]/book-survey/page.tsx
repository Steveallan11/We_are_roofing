import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
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
        <Link className="button-ghost" href={`/jobs/${bundle.job.id}`}>
          Back to Job
        </Link>
      }
    >
      <BookSurveyForm bundle={bundle} />
    </AppShell>
  );
}
