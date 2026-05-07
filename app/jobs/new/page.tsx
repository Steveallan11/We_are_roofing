import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { NewJobForm } from "@/components/jobs/new-job-form";

export default function NewJobPage() {
  return (
    <AppShell
      title="Add New Job"
      subtitle="This is the first step in the field workflow. We capture the lead, property, and survey type up front so the next screen can stay focused and simple."
      actions={<Link className="button-ghost" href="/dashboard">Back to Dashboard</Link>}
    >
      <div className="mx-auto max-w-4xl">
        <NewJobForm />
      </div>
    </AppShell>
  );
}
