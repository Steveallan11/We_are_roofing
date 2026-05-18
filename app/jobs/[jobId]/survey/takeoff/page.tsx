import { redirect } from "next/navigation";

type Props = {
  params: Promise<{ jobId: string }>;
};

export default async function SurveyTakeoffRedirect({ params }: Props) {
  const { jobId } = await params;
  redirect(`/jobs/${jobId}/roof-survey`);
}
