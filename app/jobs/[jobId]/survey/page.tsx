import { redirect } from "next/navigation";

type Props = { params: Promise<{ jobId: string }> };

export default async function SurveyPage({ params }: Props) {
  const { jobId } = await params;
  redirect(`/jobs/${jobId}`);
}
