"use client";

import { useState } from "react";
import { QuickDiaryEntry } from "./QuickDiaryEntry";
import { JobDiaryTimeline } from "./JobDiaryTimeline";

type Props = {
  jobId: string;
};

export function JobDiaryTab({ jobId }: Props) {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleEntrySuccess = () => {
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <div className="space-y-4">
      <QuickDiaryEntry jobId={jobId} onSuccess={handleEntrySuccess} />
      <JobDiaryTimeline key={refreshKey} jobId={jobId} />
    </div>
  );
}
