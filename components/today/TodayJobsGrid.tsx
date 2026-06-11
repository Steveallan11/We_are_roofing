"use client";

import { useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { Button } from "@/components/ui/primitives";
import { QuickCaptureModal } from "@/components/diary/QuickCaptureModal";
import type { Job, Customer } from "@/lib/types";

type Props = {
  jobs: Array<Job & { customer?: Customer | null }>;
};

export function TodayJobsGrid({ jobs }: Props) {
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleCaptureDone = () => {
    setRefreshKey((prev) => prev + 1);
  };

  if (jobs.length === 0) {
    return (
      <p className="text-sm text-[var(--text-muted)]">
        No jobs booked for today. Check your calendar for upcoming visits.
      </p>
    );
  }

  return (
    <>
      <div className="grid gap-2">
        {jobs.map((job) => (
          <div
            key={job.id}
            className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3"
          >
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-[var(--text)]">
                {job.customer?.full_name ?? job.job_title}
              </p>
              <p className="text-xs text-[var(--text-muted)]">{job.property_address}</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button
                variant="primary"
                size="sm"
                onClick={() => setSelectedJobId(job.id)}
              >
                Quick Log
              </Button>
              <Button
                variant="ghost"
                size="sm"
                asChild
              >
                <Link href={`/jobs/${job.id}` as Route}>View</Link>
              </Button>
            </div>
          </div>
        ))}
      </div>

      <QuickCaptureModal
        key={refreshKey}
        isOpen={!!selectedJobId}
        jobId={selectedJobId}
        onClose={() => setSelectedJobId(null)}
        onSuccess={handleCaptureDone}
      />
    </>
  );
}
