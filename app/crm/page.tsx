import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { JobsWorkspace } from "@/components/jobs/jobs-workspace";
import { getJobs } from "@/lib/data";

export default async function CrmPage() {
  const jobs = await getJobs();

  return (
    <AppShell
      title="Jobs"
      subtitle="A simple roofing workflow board: see what needs a survey, what is ready to quote, what needs sending, and what has been won."
      wide
      actions={
        <>
          <Link className="button-primary" href="/jobs/new">
            Add Lead
          </Link>
          <Link className="button-ghost" href="/dashboard">
            Dashboard
          </Link>
        </>
      }
    >
      <JobsWorkspace jobs={jobs} />
    </AppShell>
  );
}
