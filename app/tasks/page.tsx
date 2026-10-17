import { AppShell } from "@/components/layout/app-shell";
import { TaskWorkspace } from "@/components/tasks/TaskWorkspace";
import { getJobs, getWorkflowTasks } from "@/lib/data";

export default async function TasksPage() {
  const [tasks, jobs] = await Promise.all([getWorkflowTasks(), getJobs()]);
  return <AppShell title="Tasks" subtitle="Workflow actions, linked to jobs when useful.">
    <TaskWorkspace initialTasks={tasks} jobs={jobs.map((job) => ({ id: job.id, job_ref: job.job_ref, job_title: job.job_title }))} />
  </AppShell>;
}
