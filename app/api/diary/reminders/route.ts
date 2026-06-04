import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { canPersistToSupabase } from "@/lib/workflows";

export async function GET() {
  if (!canPersistToSupabase()) return NextResponse.json({ ok: true, reminders: [] });

  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const supabase = createSupabaseAdminClient();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("diary_entries")
    .select("id, entry_type, title, body, reminder_time, reminder_completed, linked_job_id")
    .eq("reminder_completed", false)
    .not("reminder_time", "is", null)
    .order("reminder_time", { ascending: true })
    .limit(50);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const reminders = (data ?? []).map((row: Record<string, unknown>) => ({
    id: String(row.id),
    entry_type: row.entry_type,
    title: row.title as string | null,
    body: row.body as string | null,
    reminder_time: row.reminder_time as string | null,
    is_due: row.reminder_time && new Date(row.reminder_time as string) <= new Date(now),
    linked_job_id: row.linked_job_id as string | null
  }));

  return NextResponse.json({ ok: true, reminders });
}

export async function PATCH(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    id?: string;
    action?: "done" | "snooze";
    snooze_minutes?: number;
  };

  if (!body.id || !body.action) {
    return NextResponse.json({ ok: false, error: "id and action required" }, { status: 400 });
  }

  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  if (!canPersistToSupabase()) {
    return NextResponse.json({ ok: true });
  }

  const supabase = createSupabaseAdminClient();
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (body.action === "done") {
    update.reminder_completed = true;
  } else if (body.action === "snooze") {
    const snoozeMin = body.snooze_minutes ?? 15;
    const snoozedTime = new Date();
    snoozedTime.setMinutes(snoozedTime.getMinutes() + snoozeMin);
    update.reminder_time = snoozedTime.toISOString();
  }

  const { data, error } = await supabase
    .from("diary_entries")
    .update(update)
    .eq("id", body.id)
    .select("*")
    .single();

  if (error || !data) {
    return NextResponse.json({ ok: false, error: error?.message ?? "Unable to update reminder." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, reminder: data });
}
