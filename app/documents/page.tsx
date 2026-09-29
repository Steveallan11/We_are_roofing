import Link from "next/link";
import type { Route } from "next";
import { AppShell } from "@/components/layout/app-shell";
import { EmptyState } from "@/components/ui/EmptyState";
import { getJobs } from "@/lib/data";
import { getDocumentDisplayType } from "@/lib/jobs/jobDetail";
import { getJobDocumentHref } from "@/lib/documents";
import { formatDate } from "@/lib/utils";

export default async function DocumentsPage() {
  const jobs = await getJobs();
  const documents = jobs
    .flatMap((job) => (job.documents ?? []).map((document) => ({ document, job })))
    .sort((left, right) => new Date(right.document.created_at ?? 0).getTime() - new Date(left.document.created_at ?? 0).getTime());

  return (
    <AppShell title="Documents" subtitle="Quotes, invoices, reports, receipts and uploaded paperwork in one place.">
      {documents.length ? (
        <div className="grid gap-3">
          {documents.map(({ document, job }) => (
            <div className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between" key={document.id}>
              <div className="min-w-0">
                <p className="truncate font-semibold text-[var(--text)]">{document.display_name}</p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">{getDocumentDisplayType(document)} · {job.job_ref} · {formatDate(document.created_at)}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Link className="button-ghost" href={`/jobs/${job.id}?tab=files` as Route}>Job files</Link>
                <Link className="button-secondary" href={getJobDocumentHref(document) as Route}>Open</Link>
              </div>
            </div>
          ))}
        </div>
      ) : <EmptyState title="No documents yet" message="Generated quotes, invoices, survey reports and uploaded files will appear here." actionHref="/jobs" actionLabel="Open jobs" />}
    </AppShell>
  );
}
