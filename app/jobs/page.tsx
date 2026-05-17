import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { JobsWorkspace } from "@/components/jobs/jobs-workspace";
import { getJobs } from "@/lib/data";
import { needsAttention } from "@/lib/jobs/nextAction";
import type { PipelineGroupKey } from "@/lib/jobs/pipelineGroups";
import { currency } from "@/lib/utils";

type Props = {
  searchParams?: Promise<{ filter?: string }>;
};

const validFilters = new Set(["all", "attention", "new", "survey", "quoting", "sent", "booked"]);

export default async function JobsPage({ searchParams }: Props) {
  const query = searchParams ? await searchParams : undefined;
  const initialFilter = validFilters.has(query?.filter ?? "") ? (query?.filter as PipelineGroupKey | "all" | "attention") : "all";
  const jobs = await getJobs();
  const activeJobs = jobs.filter((job) => !["Completed", "Lost", "Archived"].includes(job.status));
  const urgent = jobs.filter(needsAttention).length;
  const pipelineValue = activeJobs.reduce((sum, job) => sum + Number(job.estimated_value ?? 0), 0);

  return (
    <AppShell
      title="Jobs"
      subtitle={`${activeJobs.length} active | ${currency(pipelineValue)} pipeline | ${urgent} urgent. One board for surveys, quotes, follow-ups, and booked work.`}
      wide
      actions={
        <>
          <Link className="button-primary" href="/jobs/new">
            Add Job
          </Link>
          <Link className="button-ghost" href="/dashboard">
            Dashboard
          </Link>
        </>
      }
    >
      <JobsWorkspace initialFilter={initialFilter} jobs={jobs} />
    </AppShell>
  );
}
