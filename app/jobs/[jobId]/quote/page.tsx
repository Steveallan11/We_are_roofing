import Link from "next/link";

type Props = { params: Promise<{ jobId: string }> };

export default async function QuotePage({ params }: Props) {
  const { jobId } = await params;
  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-condensed text-3xl text-white">Quote</h1>
        <Link className="button-ghost text-sm" href={`/jobs/${jobId}`}>Back to Job</Link>
      </div>
      <div className="card p-8 text-center">
        <p className="text-4xl mb-3">🤖</p>
        <h2 className="font-condensed text-2xl text-white">AI Quote Generation</h2>
        <p className="text-sm text-[var(--muted)] mt-2 max-w-md mx-auto">Complete the survey first, then AI will generate a professional quote and report in Andrew&apos;s style. Coming in Phase 2.</p>
      </div>
    </div>
  );
}
