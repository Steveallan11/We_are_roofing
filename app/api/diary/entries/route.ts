import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { canPersistToSupabase } from "@/lib/workflows";
import type { DiaryEntryType } from "@/lib/types";

export async function GET(request: Request) {
  if (!canPersistToSupabase()) return NextResponse.json({ ok: true, entries: [] });

  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get("job_id");
  const customerId = searchParams.get("customer_id");
  const entryType = searchParams.get("entry_type");
  const limit = Math.min(Number(searchParams.get("limit") || 50), 500);
  const offset = Number(searchParams.get("offset") || 0);

  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const supabase = createSupabaseAdminClient();
  let query = supabase.from("diary_entries").select("*", { count: "exact" }).order("created_at", { ascending: false });

  if (jobId) query = query.eq("linked_job_id", jobId);
  if (customerId) query = query.eq("linked_customer_id", customerId);
  if (entryType) query = query.eq("entry_type", entryType);

  const { data, count, error } = await query.range(offset, offset + limit - 1);
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, entries: data ?? [], total: count ?? 0, limit, offset });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    entry_type?: DiaryEntryType;
    title?: string;
    body?: string;
    voice_url?: string;
    voice_transcript?: string;
    photos?: Array<{ url: string; caption?: string; type?: string }>;
    linked_job_id?: string;
    linked_customer_id?: string;
    task_due_date?: string;
    task_assigned_to?: string;
    expense_amount?: number;
    expense_category?: string;
    expense_receipt_url?: string;
    payment_amount?: number;
    payment_to_name?: string;
    payment_method?: string;
  };

  const entryType = String(body.entry_type ?? "").trim() as DiaryEntryType;
  if (!["voice_note", "text_note", "photo", "reminder", "task", "expense", "payment"].includes(entryType)) {
    return NextResponse.json({ ok: false, error: "Valid entry_type is required." }, { status: 400 });
  }

  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  if (!canPersistToSupabase()) {
    return NextResponse.json({
      ok: true,
      message: "Diary entry preview accepted.",
      entry_id: `entry-${Date.now()}`
    });
  }

  const supabase = createSupabaseAdminClient();
  const { data: business } = await supabase.from("businesses").select("id").limit(1).maybeSingle();
  const businessId = business?.id ?? (process.env.NEXT_PUBLIC_BUSINESS_ID || "");

  const { data, error } = await supabase
    .from("diary_entries")
    .insert({
      business_id: businessId,
      user_id: auth.session.user?.id ?? null,
      entry_type: entryType,
      title: String(body.title ?? "").trim().slice(0, 200) || null,
      body: String(body.body ?? "").trim() || null,
      voice_url: String(body.voice_url ?? "").trim() || null,
      voice_transcript: String(body.voice_transcript ?? "").trim() || null,
      photos: Array.isArray(body.photos) ? body.photos : [],
      linked_job_id: body.linked_job_id || null,
      linked_customer_id: body.linked_customer_id || null,
      task_due_date: body.task_due_date || null,
      task_assigned_to: body.task_assigned_to || "Andy",
      expense_amount: body.expense_amount ? Number(body.expense_amount) : null,
      expense_category: body.expense_category || null,
      expense_receipt_url: String(body.expense_receipt_url ?? "").trim() || null,
      payment_amount: body.payment_amount ? Number(body.payment_amount) : null,
      payment_to_name: String(body.payment_to_name ?? "").trim() || null,
      payment_method: body.payment_method || null
    })
    .select("*")
    .single();

  if (error || !data) {
    return NextResponse.json({ ok: false, error: error?.message ?? "Unable to create diary entry." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, message: "Diary entry created.", entry: data });
}
