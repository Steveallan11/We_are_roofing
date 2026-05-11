import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { NewJobForm } from "@/components/jobs/new-job-form";

export default function NewJobPage() {
  return (
    <AppShell
      title="Add New Job"
      subtitle="Every lead becomes a job file straight away. Save the customer and property details here, create the permanent job number, then go straight into survey capture."
      actions={<Link className="button-ghost" href="/dashboard">Back to Dashboard</Link>}
    >
      <div className="mx-auto max-w-4xl">
        <NewJobForm />
      </div>
    </AppShell>
  );
}
