"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { DiaryTask } from "@/lib/data";
import type { Job } from "@/lib/types";
import { formatDate } from "@/lib/utils";

type TaskJob = Pick<Job, "id" | "job_ref" | "job_title">;
type Props = { initialTasks: DiaryTask[]; jobs: TaskJob[] };
type Draft = { title: string; description: string; due_date: string; assigned_to: string; job_id: string };
const blankDraft = (): Draft => ({ title: "", description: "", due_date: "", assigned_to: "", job_id: "" });

export function TaskWorkspace({ initialTasks, jobs }: Props) {
  const router = useRouter();
  const [tasks, setTasks] = useState(initialTasks);
  const [draft, setDraft] = useState(blankDraft());
  const [filter, setFilter] = useState<"open" | "completed" | "all">("open");
  const [outcomes, setOutcomes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const visibleTasks = useMemo(() => tasks.filter((task) => filter === "all" || (filter === "completed" ? task.task_completed : !task.task_completed)), [filter, tasks]);
  const jobsById = useMemo(() => new Map(jobs.map((job) => [job.id, job])), [jobs]);

  async function createTask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null); setNotice(null); setBusyId("new");
    const response = await fetch("/api/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) });
    const result = await response.json().catch(() => null) as { ok?: boolean; task?: DiaryTask; error?: string } | null;
    setBusyId(null);
    if (!response.ok || !result?.ok || !result.task) { setError(result?.error || "Task could not be created."); return; }
    setTasks((current) => [result.task!, ...current]); setDraft(blankDraft()); setNotice("Task created."); router.refresh();
  }

  async function updateTask(taskId: string, changes: Record<string, unknown>) {
    setError(null); setNotice(null); setBusyId(taskId);
    const response = await fetch(`/api/tasks/${taskId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(changes) });
    const result = await response.json().catch(() => null) as { ok?: boolean; task?: DiaryTask; error?: string } | null;
    setBusyId(null);
    if (!response.ok || !result?.ok || !result.task) { setError(result?.error || "Task could not be updated."); return false; }
    setTasks((current) => current.map((task) => task.id === taskId ? result.task! : task));
    setNotice(changes.completed === true ? "Task completed and outcome saved." : changes.completed === false ? "Task reopened." : "Task updated.");
    router.refresh();
    return true;
  }

  return <div className="space-y-5">
    <form className="space-y-4 rounded-xl border border-[var(--gold)]/35 bg-[var(--surface)] p-4 md:p-5" onSubmit={createTask}>
      <div><h2 className="font-semibold text-[var(--text)]">Create a task</h2><p className="mt-1 text-sm text-[var(--text-muted)]">Keep a workflow action here, with an optional job link, due date and assignee.</p></div>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="block md:col-span-2"><span className="label">Task *</span><input className="field mt-1 min-h-11" maxLength={200} onChange={(e) => setDraft({ ...draft, title: e.target.value })} required value={draft.title} placeholder="e.g. Confirm tile delivery with supplier" /></label>
        <label className="block md:col-span-2"><span className="label">Details</span><textarea className="field mt-1" maxLength={5000} onChange={(e) => setDraft({ ...draft, description: e.target.value })} rows={2} value={draft.description} placeholder="Notes or steps to remember" /></label>
        <label className="block"><span className="label">Link to job (optional)</span><select className="field mt-1 min-h-11" onChange={(e) => setDraft({ ...draft, job_id: e.target.value })} value={draft.job_id}><option value="">No job — general task</option>{jobs.map((job) => <option key={job.id} value={job.id}>{job.job_ref || job.job_title} · {job.job_title}</option>)}</select></label>
        <label className="block"><span className="label">Due date</span><input className="field mt-1 min-h-11" onChange={(e) => setDraft({ ...draft, due_date: e.target.value })} type="date" value={draft.due_date} /></label>
        <label className="block"><span className="label">Assigned to</span><input className="field mt-1 min-h-11" maxLength={120} onChange={(e) => setDraft({ ...draft, assigned_to: e.target.value })} value={draft.assigned_to} placeholder="Name (optional)" /></label>
        <div className="flex items-end"><button className="button-primary min-h-11" disabled={busyId === "new" || !draft.title.trim()} type="submit">{busyId === "new" ? "Creating…" : "＋ Add task"}</button></div>
      </div>
    </form>

    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold text-[var(--text)]">Workflow tasks</h2><p className="mt-1 text-sm text-[var(--text-muted)]">{tasks.filter((task) => !task.task_completed).length} open · {tasks.filter((task) => task.task_completed).length} completed</p></div><div className="flex gap-1 rounded-lg border border-[var(--border)] p-1">{(["open", "completed", "all"] as const).map((value) => <button className={`rounded-md px-3 py-2 text-sm ${filter === value ? "bg-[var(--gold)] text-black" : "text-[var(--text-muted)]"}`} key={value} onClick={() => setFilter(value)} type="button">{value === "open" ? "Open" : value === "completed" ? "Completed" : "All"}</button>)}</div></div>
      {notice ? <p aria-live="polite" className="rounded-lg border border-green-600/30 bg-green-600/10 p-3 text-sm text-green-700">{notice}</p> : null}
      {error ? <p role="alert" className="rounded-lg border border-red-600/30 bg-red-600/10 p-3 text-sm text-red-700">{error}</p> : null}
      {visibleTasks.length ? visibleTasks.map((task) => {
        const job = task.linked_job_id ? jobsById.get(task.linked_job_id) : null;
        const dateLabel = task.task_due_date ? `${new Date(`${task.task_due_date}T00:00:00`).getTime() < new Date(new Date().toDateString()).getTime() && !task.task_completed ? "Overdue · " : "Due "}${formatDate(task.task_due_date)}` : "No due date";
        return <article className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4" key={task.id}>
          <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className={`font-semibold ${task.task_completed ? "text-[var(--text-muted)] line-through" : "text-[var(--text)]"}`}>{task.title || "Untitled task"}</p><p className="mt-1 text-xs text-[var(--text-muted)]">{dateLabel}{task.task_assigned_to ? ` · ${task.task_assigned_to}` : ""}</p>{job ? <Link className="mt-1 inline-block text-xs font-semibold text-[var(--gold)] hover:underline" href={`/jobs/${job.id}`}>{job.job_ref || job.job_title} · {job.job_title}</Link> : <span className="mt-1 inline-block text-xs text-[var(--text-muted)]">General task</span>}{task.body ? <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--text-muted)]">{task.body}</p> : null}</div>
            {task.task_completed ? <button className="button-ghost min-h-11" disabled={busyId === task.id} onClick={() => void updateTask(task.id, { completed: false })} type="button">Reopen task</button> : <button className="button-primary min-h-11" disabled={busyId === task.id || !outcomes[task.id]?.trim()} onClick={() => void updateTask(task.id, { completed: true, outcome: outcomes[task.id] })} type="button">{busyId === task.id ? "Saving…" : "✓ Complete task"}</button>}</div>
          {task.task_completed ? <p className="rounded-lg bg-[var(--surface-raised)] p-3 text-sm"><span className="font-semibold">Outcome:</span> {task.task_outcome || "Completed"}{task.task_completed_at ? <span className="ml-2 text-xs text-[var(--text-muted)]">· {formatDate(task.task_completed_at)}</span> : null}</p> : <label className="block"><span className="label">Outcome when done *</span><input className="field mt-1 min-h-11" maxLength={5000} onChange={(e) => setOutcomes({ ...outcomes, [task.id]: e.target.value })} placeholder="What happened or what was agreed?" value={outcomes[task.id] ?? ""} /></label>}
        </article>;
      }) : <div className="rounded-xl border border-dashed border-[var(--border)] p-8 text-center text-sm text-[var(--text-muted)]">{filter === "open" ? "No open tasks. Add one above when something needs following up." : "No tasks in this view yet."}</div>}
    </section>
  </div>;
}
