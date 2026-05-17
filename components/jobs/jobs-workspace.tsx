"use client";

import { useMemo, useState } from "react";
import { AttentionBanner } from "@/components/jobs/AttentionBanner";
import { JobCard } from "@/components/jobs/job-card";
import { JobFilters } from "@/components/jobs/JobFilters";
import { PipelineStrip } from "@/components/jobs/PipelineStrip";
import { EmptyState } from "@/components/ui/EmptyState";
import { getPipelineGroup, type PipelineGroupKey } from "@/lib/jobs/pipelineGroups";
import { needsAttention, type JobForAction } from "@/lib/jobs/nextAction";

type Props = {
  jobs: JobForAction[];
};

export function JobsWorkspace({ jobs }: Props) {
  const [activeFilter, setActiveFilter] = useState<PipelineGroupKey | "all" | "attention">("all");
  const attentionJobs = useMemo(() => jobs.filter(needsAttention), [jobs]);
  const filteredJobs = useMemo(() => {
    if (activeFilter === "attention") return attentionJobs;
    const group = getPipelineGroup(activeFilter);
    if (!group) return jobs;
    return jobs.filter((job) => group.statuses.includes(job.status));
  }, [activeFilter, attentionJobs, jobs]);

  return (
    <div className="stack">
      <AttentionBanner jobs={attentionJobs} onViewAll={() => setActiveFilter("attention")} />
      <PipelineStrip active={activeFilter === "attention" ? "all" : activeFilter} jobs={jobs} onSelect={setActiveFilter} />
      <JobFilters active={activeFilter} attentionCount={attentionJobs.length} onSelect={setActiveFilter} />
      {filteredJobs.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {filteredJobs.map((job) => (
            <JobCard job={job} key={job.id} />
          ))}
        </div>
      ) : (
        <EmptyState title="No jobs here" message="This filter is clear. Switch back to All Jobs or add a new lead." actionHref="/jobs/new" actionLabel="+ Add Job" />
      )}
    </div>
  );
}
