import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { canPersistToSupabase } from "@/lib/workflows";

type Props = { params: Promise<{ taskId: string }> };

export async function PATCH(request: Request, { params }: Props) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  const { taskId } = await params;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ ok: false, error: "Task update is required." }, { status: 400 });
  if (!canPersistToSupabase()) return NextResponse.json({ ok: true });
  const supabase = createSupabaseAdminClient();
  const { data: business, error: businessError } = await supabase.from("businesses").select("id").limit(1).single();
  if (businessError || !business) return NextResponse.json({ ok: false, error: "Workspace could not be identified." }, { status: 500 });
  const { data: existing, error: lookupError } = await supabase.from("diary_entries").select("id, task_completed, task_outcome").eq("id", taskId).eq("business_id", business.id).eq("entry_type", "task").maybeSingle();
  if (lookupError || !existing) return NextResponse.json({ ok: false, error: "Task not found." }, { status: 404 });

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if ("title" in body) {
    const title = cleanText(body.title, 200);
    if (!title) return NextResponse.json({ ok: false, error: "Task title cannot be empty." }, { status: 400 });
    update.title = title;
  }
  if ("description" in body) update.body = cleanText(body.description, 5000) || null;
  if ("due_date" in body) {
    const dueDate = cleanText(body.due_date, 10);
    if (dueDate && !isDate(dueDate)) return NextResponse.json({ ok: false, error: "Enter a valid due date." }, { status: 400 });
    update.task_due_date = dueDate || null;
  }
  if ("assigned_to" in body) update.task_assigned_to = cleanText(body.assigned_to, 120) || null;
  if ("outcome" in body) update.task_outcome = cleanText(body.outcome, 5000) || null;
  if ("job_id" in body) {
    const jobId = cleanText(body.job_id, 64) || null;
    if (jobId) {
      const { data: job } = await supabase.from("jobs").select("id").eq("id", jobId).eq("business_id", business.id).maybeSingle();
      if (!job) return NextResponse.json({ ok: false, error: "The linked job was not found in this workspace." }, { status: 404 });
    }
    update.linked_job_id = jobId;
  }
  if (typeof body.completed === "boolean") {
    const outcome = "outcome" in body ? cleanText(body.outcome, 5000) : String(existing.task_outcome ?? "").trim();
    if (body.completed && !outcome) return NextResponse.json({ ok: false, error: "Add an outcome before completing this task." }, { status: 400 });
    update.task_completed = body.completed;
    update.task_outcome = outcome || null;
    update.task_completed_at = body.completed ? new Date().toISOString() : null;
  }
  const { data, error } = await supabase.from("diary_entries").update(update).eq("id", taskId).eq("business_id", business.id).eq("entry_type", "task").select("id, title, body, linked_job_id, task_due_date, task_assigned_to, task_completed, task_outcome, task_completed_at, created_at").single();
  if (error || !data) return NextResponse.json({ ok: false, error: error?.message ?? "Task could not be updated." }, { status: 500 });
  return NextResponse.json({ ok: true, task: data });
}

function cleanText(value: unknown, max: number) { return typeof value === "string" ? value.trim().slice(0, max) : ""; }
function isDate(value: string) { return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)); }
