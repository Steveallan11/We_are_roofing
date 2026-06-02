import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { JobsWorkspace } from "@/components/jobs/jobs-workspace";
import { WeatherStrip } from "@/components/weather/WeatherStrip";
import { Button, Card } from "@/components/ui/primitives";
import { getBusiness, getJobs } from "@/lib/data";
import { needsAttention } from "@/lib/jobs/nextAction";
import type { PipelineGroupKey } from "@/lib/jobs/pipelineGroups";
import { getJobPipelineValue } from "@/lib/quotes/value";
import { currency } from "@/lib/utils";

type Props = {
  searchParams?: Promise<{ filter?: string }>;
};

const validFilters = new Set(["all", "attention", "new", "survey", "quoting", "sent", "booked", "materials", "in_progress", "completed"]);

export default async function JobsPage({ searchParams }: Props) {
  const query = searchParams ? await searchParams : undefined;
  const initialFilter = validFilters.has(query?.filter ?? "") ? (query?.filter as PipelineGroupKey | "all" | "attention") : "all";
  const [business, jobs] = await Promise.all([getBusiness(), getJobs()]);
  const activeJobs = jobs.filter((job) => !["Completed", "Not Proceeding", "Lost", "Archived"].includes(job.status));
  const urgent = jobs.filter(needsAttention).length;
  const pipelineValue = activeJobs.reduce((sum, job) => sum + Number(getJobPipelineValue(job) ?? 0), 0);

  return (
    <AppShell
      title="Jobs"
      subtitle={`${activeJobs.length} active | ${currency(pipelineValue)} pipeline | ${urgent} urgent. One board for surveys, quotes, follow-ups, and booked work.`}
      wide
      actions={
        <Button variant="primary" size="md" asChild>
          <Link href="/jobs/new">Add Job</Link>
        </Button>
      }
    >
      <Card padding="md" className="mb-4 hidden lg:block">
        <WeatherStrip location={business.weather_location ?? "Yateley"} />
      </Card>
      <JobsWorkspace initialFilter={initialFilter} jobs={jobs} />
    </AppShell>
  );
}
