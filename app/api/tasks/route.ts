import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { canPersistToSupabase } from "@/lib/workflows";

export async function POST(request: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const title = cleanText(body?.title, 200);
  const description = cleanText(body?.description, 5000);
  const dueDate = cleanText(body?.due_date, 10) || null;
  const assignedTo = cleanText(body?.assigned_to, 120) || null;
  const jobId = cleanText(body?.job_id, 64) || null;
  if (!title) return NextResponse.json({ ok: false, error: "Enter a task title." }, { status: 400 });
  if (dueDate && !isDate(dueDate)) return NextResponse.json({ ok: false, error: "Enter a valid due date." }, { status: 400 });
  if (!canPersistToSupabase()) return NextResponse.json({ ok: true, task: { id: `task-${Date.now()}` } });

  const supabase = createSupabaseAdminClient();
  const { data: business, error: businessError } = await supabase.from("businesses").select("id").limit(1).single();
  if (businessError || !business) return NextResponse.json({ ok: false, error: "Workspace could not be identified." }, { status: 500 });
  if (jobId) {
    const { data: job } = await supabase.from("jobs").select("id").eq("id", jobId).eq("business_id", business.id).maybeSingle();
    if (!job) return NextResponse.json({ ok: false, error: "The linked job was not found in this workspace." }, { status: 404 });
  }
  const { data, error } = await supabase.from("diary_entries").insert({
    business_id: business.id,
    user_id: auth.session.user?.id ?? null,
    entry_type: "task",
    title,
    body: description || null,
    linked_job_id: jobId,
    task_due_date: dueDate,
    task_assigned_to: assignedTo,
    task_completed: false
  }).select("id, title, body, linked_job_id, task_due_date, task_assigned_to, task_completed, task_outcome, task_completed_at, created_at").single();
  if (error || !data) return NextResponse.json({ ok: false, error: error?.message ?? "Task could not be created." }, { status: 500 });
  return NextResponse.json({ ok: true, task: data });
}

function cleanText(value: unknown, max: number) { return typeof value === "string" ? value.trim().slice(0, max) : ""; }
function isDate(value: string) { return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)); }
