import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { canPersistToSupabase } from "@/lib/workflows";

export async function PATCH(request: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => ({}))) as { id?: string; outcome?: string };
  if (!body.id) return NextResponse.json({ ok: false, error: "Task id is required." }, { status: 400 });
  if (!canPersistToSupabase()) return NextResponse.json({ ok: true });

  const supabase = createSupabaseAdminClient();
  const { data: business, error: businessError } = await supabase.from("businesses").select("id").limit(1).maybeSingle();
  if (businessError || !business?.id) {
    return NextResponse.json({ ok: false, error: "Workspace could not be identified." }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("diary_entries")
    .update({ task_completed: true, task_outcome: String(body.outcome ?? "Completed from Today").trim().slice(0, 5000), task_completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", body.id)
    .eq("business_id", business.id)
    .in("entry_type", ["task", "reminder"])
    .eq("task_completed", false)
    .select("id")
    .maybeSingle();

  if (error) return NextResponse.json({ ok: false, error: "Unable to complete this task." }, { status: 500 });
  if (!data) return NextResponse.json({ ok: false, error: "Task not found or already completed." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
