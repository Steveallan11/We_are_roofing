import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { getJobLabourPlan } from "@/lib/data";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { canPersistToSupabase } from "@/lib/workflows";

type Props = {
  params: Promise<{ jobId: string }>;
};

type EntryBody = {
  entry_id?: string;
  quote_id?: string | null;
  labour_rate_id?: string | null;
  person_id?: string | null;
  role_name?: string;
  people?: number | string;
  duration?: number | string;
  unit?: "hour" | "day";
  cost_rate?: number | string;
  charge_rate?: number | string;
  actual_duration?: number | string | null;
  actual_cost?: number | string | null;
  notes?: string | null;
  sort_order?: number | string | null;
};

export async function GET(_request: Request, { params }: Props) {
  const { jobId } = await params;
  const plan = await getJobLabourPlan(jobId);
  return NextResponse.json({ ok: true, plan });
}

export async function POST(request: Request, { params }: Props) {
  const { jobId } = await params;
  const body = (await request.json().catch(() => ({}))) as EntryBody;

  if (!canPersistToSupabase()) return NextResponse.json({ ok: true });

  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const supabase = createSupabaseAdminClient();
  const plan = await ensureLabourPlan(jobId, body.quote_id || null);
  const payload = buildEntryPayload({
    ...body,
    job_id: jobId,
    plan_id: plan.id,
    sort_order: body.sort_order ?? (plan.entries?.length ?? 0)
  });

  const { data, error } = await supabase.from("labour_entries").insert(payload).select("*, labour_people(*)").single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, entry: mapEntry(data) });
}

export async function PATCH(request: Request, { params }: Props) {
  const { jobId } = await params;
  const body = (await request.json().catch(() => ({}))) as EntryBody & { plan?: { status?: string; crew_confirmed?: boolean; notes?: string | null; title?: string | null } };

  if (!canPersistToSupabase()) return NextResponse.json({ ok: true });

  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const supabase = createSupabaseAdminClient();

  if (body.plan) {
    const plan = await ensureLabourPlan(jobId, body.quote_id || null);
    const { data, error } = await supabase
      .from("labour_plans")
      .update({ ...body.plan, updated_at: new Date().toISOString() })
      .eq("id", plan.id)
      .select("*")
      .single();

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, plan: data });
  }

  if (!body.entry_id) return NextResponse.json({ ok: false, error: "Missing labour entry id." }, { status: 400 });

  const payload = buildEntryPayload({ ...body, job_id: jobId }, false);
  const { data, error } = await supabase
    .from("labour_entries")
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq("id", body.entry_id)
    .eq("job_id", jobId)
    .select("*, labour_people(*)")
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, entry: mapEntry(data) });
}

export async function DELETE(request: Request, { params }: Props) {
  const { jobId } = await params;
  const { searchParams } = new URL(request.url);
  const entryId = searchParams.get("entryId");
  if (!entryId) return NextResponse.json({ ok: false, error: "Missing labour entry id." }, { status: 400 });

  if (!canPersistToSupabase()) return NextResponse.json({ ok: true });

  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("labour_entries").delete().eq("id", entryId).eq("job_id", jobId);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

async function ensureLabourPlan(jobId: string, quoteId: string | null) {
  const existing = await getJobLabourPlan(jobId);
  if (existing) return existing;

  const supabase = createSupabaseAdminClient();
  const { data: job, error: jobError } = await supabase.from("jobs").select("business_id").eq("id", jobId).single();
  if (jobError || !job) throw new Error(jobError?.message ?? "Job not found.");

  const { data, error } = await supabase
    .from("labour_plans")
    .insert({
      job_id: jobId,
      quote_id: quoteId,
      business_id: job.business_id,
      title: "Labour Plan",
      status: "estimated"
    })
    .select("*")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Unable to create labour plan.");
  return { ...data, entries: [] };
}

function buildEntryPayload(body: EntryBody & { job_id?: string; plan_id?: string }, includeRequired = true) {
  const people = Number(body.people ?? 1);
  const duration = Number(body.duration ?? 1);
  const costRate = Number(body.cost_rate ?? 0);
  const chargeRate = Number(body.charge_rate ?? 0);
  const payload: Record<string, unknown> = {
    labour_rate_id: body.labour_rate_id || null,
    person_id: body.person_id || null,
    role_name: body.role_name || "Roofer",
    people,
    duration,
    unit: body.unit === "hour" ? "hour" : "day",
    cost_rate: costRate,
    charge_rate: chargeRate,
    estimated_cost: roundMoney(people * duration * costRate),
    charge_total: roundMoney(people * duration * chargeRate),
    actual_duration: toNullableNumber(body.actual_duration),
    actual_cost: toNullableNumber(body.actual_cost),
    notes: body.notes || null,
    sort_order: body.sort_order == null ? 0 : Number(body.sort_order || 0)
  };

  if (includeRequired) {
    payload.job_id = body.job_id;
    payload.plan_id = body.plan_id;
  }

  return payload;
}

function mapEntry(entry: Record<string, unknown>) {
  return {
    ...entry,
    person: entry.labour_people ?? null
  };
}

function toNullableNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return null;
  return Number(value || 0);
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}
