import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { AssistantRouteContext, ToolExecutionResult } from "@/lib/assistant/types";

type TaskInput = Record<string, unknown>;

export async function executeTaskTool(toolName: string, input: TaskInput, routeContext?: AssistantRouteContext): Promise<ToolExecutionResult> {
  const businessId = routeContext?.businessId;
  if (!businessId) throw new Error("An authenticated workspace is required to access tasks.");
  const supabase = createSupabaseAdminClient();

  if (toolName === "get_tasks") {
    let query = supabase.from("diary_entries").select("id,title,body,task_due_date,task_assigned_to,task_completed,task_outcome,task_completed_at,linked_job_id,created_at,updated_at").eq("business_id", businessId).eq("entry_type", "task");
    const status = input.status;
    if (status === "open") query = query.eq("task_completed", false);
    if (status === "completed") query = query.eq("task_completed", true);
    if (typeof input.job_ref === "string" && input.job_ref.trim()) {
      const { data: job, error: jobError } = await supabase.from("jobs").select("id").eq("business_id", businessId).eq("job_ref", input.job_ref.trim()).maybeSingle();
      if (jobError || !job) throw new Error("The requested job was not found in this workspace.");
      query = query.eq("linked_job_id", job.id);
    }
    if (typeof input.due_before === "string") query = query.lte("task_due_date", input.due_before);
    const { data, error } = await query.order("task_completed", { ascending: true }).order("task_due_date", { ascending: true, nullsFirst: false }).limit(Number(input.limit ?? 50));
    if (error) throw new Error(error.message);
    return { ok: true, summary: `Found ${(data ?? []).length} task(s).`, data: data ?? [] };
  }

  if (toolName === "create_task") {
    const title = clean(input.title, 200);
    if (!title) throw new Error("A task title is required.");
    const dueDate = clean(input.due_date, 10) || null;
    if (dueDate && !isDate(dueDate)) throw new Error("Enter a valid due date.");
    const jobId = await resolveJobId(supabase, businessId, input.job_ref);
    const { data, error } = await supabase.from("diary_entries").insert({
      business_id: businessId,
      user_id: routeContext?.actorId ?? null,
      entry_type: "task",
      title,
      body: clean(input.description, 5000) || null,
      linked_job_id: jobId,
      task_due_date: dueDate,
      task_assigned_to: clean(input.assigned_to, 120) || null,
      task_completed: false
    }).select("id,title,body,task_due_date,task_assigned_to,task_completed,task_outcome,task_completed_at,linked_job_id,created_at").single();
    if (error || !data) throw new Error(error?.message ?? "Task could not be created.");
    return { ok: true, summary: `Created task: ${title}.`, data };
  }

  if (toolName === "update_task") {
    const { data: current, error: lookupError } = await supabase.from("diary_entries").select("id,task_completed,task_outcome").eq("business_id", businessId).eq("entry_type", "task").eq("id", String(input.task_id ?? "")).maybeSingle();
    if (lookupError || !current) throw new Error("Task not found in this workspace.");
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if ("title" in input) {
      const title = clean(input.title, 200);
      if (!title) throw new Error("Task title cannot be empty.");
      patch.title = title;
    }
    if ("description" in input) patch.body = clean(input.description, 5000) || null;
    if ("due_date" in input) {
      const dueDate = clean(input.due_date, 10);
      if (dueDate && !isDate(dueDate)) throw new Error("Enter a valid due date.");
      patch.task_due_date = dueDate || null;
    }
    if ("assigned_to" in input) patch.task_assigned_to = clean(input.assigned_to, 120) || null;
    if ("outcome" in input) patch.task_outcome = clean(input.outcome, 5000) || null;
    if ("job_ref" in input) patch.linked_job_id = await resolveJobId(supabase, businessId, input.job_ref);
    if (typeof input.completed === "boolean") {
      const outcome = "outcome" in input ? clean(input.outcome, 5000) : String(current.task_outcome ?? "").trim();
      if (input.completed && !outcome) throw new Error("Add an outcome before completing this task.");
      patch.task_completed = input.completed;
      patch.task_outcome = outcome || null;
      patch.task_completed_at = input.completed ? new Date().toISOString() : null;
    }
    const { data, error } = await supabase.from("diary_entries").update(patch).eq("business_id", businessId).eq("entry_type", "task").eq("id", current.id).select("id,title,body,task_due_date,task_assigned_to,task_completed,task_outcome,task_completed_at,linked_job_id,created_at,updated_at").single();
    if (error || !data) throw new Error(error?.message ?? "Task could not be updated.");
    return { ok: true, summary: `Updated task: ${data.title}.`, data };
  }

  throw new Error(`Unknown task tool: ${toolName}`);
}

async function resolveJobId(supabase: ReturnType<typeof createSupabaseAdminClient>, businessId: string, jobRef: unknown): Promise<string | null> {
  const ref = clean(jobRef, 50);
  if (!ref) return null;
  const { data, error } = await supabase.from("jobs").select("id").eq("business_id", businessId).eq("job_ref", ref).maybeSingle();
  if (error || !data) throw new Error(`Job ${ref} was not found in this workspace.`);
  return data.id;
}

function clean(value: unknown, max: number) { return typeof value === "string" ? value.trim().slice(0, max) : ""; }
function isDate(value: string) { return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)); }
