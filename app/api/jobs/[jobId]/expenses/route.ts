import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { JobExpense, JobExpenseCategory } from "@/lib/types";
import { canPersistToSupabase } from "@/lib/workflows";

type Props = {
  params: Promise<{ jobId: string }>;
};

const CATEGORIES: JobExpenseCategory[] = [
  "materials",
  "labour",
  "subcontractor",
  "plant_hire",
  "skip_hire",
  "scaffolding",
  "fuel",
  "waste",
  "other"
];

const BUSINESS_ID = process.env.NEXT_PUBLIC_BUSINESS_ID || "6f9a6dca-a747-4a20-ab87-111808577cc7";

export async function GET(_request: Request, { params }: Props) {
  const { jobId } = await params;
  if (!canPersistToSupabase()) return NextResponse.json({ ok: true, expenses: [] });

  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const supabase = createSupabaseAdminClient();
  const [expensesResult, diaryResult] = await Promise.all([
    supabase.from("job_expenses").select("*").eq("job_id", jobId).order("expense_date", { ascending: false }),
    supabase
      .from("diary_entries")
      .select("id, linked_job_id, entry_type, title, body, expense_amount, expense_category, expense_receipt_url, created_at")
      .eq("linked_job_id", jobId)
      .eq("entry_type", "expense")
      .order("created_at", { ascending: false })
  ]);

  if (expensesResult.error) {
    return NextResponse.json({ ok: false, error: expensesResult.error.message }, { status: 500 });
  }

  const expenses: JobExpense[] = (expensesResult.data ?? []).map((row) => ({ ...(row as JobExpense), source: "job" as const }));

  const diaryExpenses: JobExpense[] = (diaryResult.data ?? [])
    .filter((entry) => Number(entry.expense_amount ?? 0) > 0)
    .map((entry) => ({
      id: entry.id as string,
      job_id: jobId,
      category: mapDiaryCategory(entry.expense_category as string | null),
      description: (entry.title as string | null) || (entry.body as string | null) || "Diary expense",
      amount: Number(entry.expense_amount ?? 0),
      vat_amount: 0,
      expense_date: String(entry.created_at ?? "").slice(0, 10),
      receipt_url: entry.expense_receipt_url as string | null,
      created_at: entry.created_at as string,
      source: "diary" as const
    }));

  return NextResponse.json({ ok: true, expenses: [...expenses, ...diaryExpenses] });
}

export async function POST(request: Request, { params }: Props) {
  const { jobId } = await params;
  const body = (await request.json().catch(() => ({}))) as Partial<JobExpense>;

  const amount = Number(body.amount ?? 0);
  const description = (body.description ?? "").trim();
  if (!description || !Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ ok: false, error: "A description and an amount greater than zero are required." }, { status: 400 });
  }
  const category = CATEGORIES.includes(body.category as JobExpenseCategory) ? (body.category as JobExpenseCategory) : "other";

  if (!canPersistToSupabase()) return NextResponse.json({ ok: true, expense: null });

  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("job_expenses")
    .insert({
      business_id: BUSINESS_ID,
      job_id: jobId,
      category,
      description,
      supplier_name: body.supplier_name?.trim() || null,
      amount: round2(amount),
      vat_amount: round2(Math.max(0, Number(body.vat_amount ?? 0))),
      expense_date: body.expense_date || new Date().toISOString().slice(0, 10),
      receipt_url: body.receipt_url || null,
      notes: body.notes?.trim() || null
    })
    .select("*")
    .single();

  if (error || !data) {
    return NextResponse.json({ ok: false, error: error?.message ?? "Unable to save expense." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, expense: { ...(data as JobExpense), source: "job" } });
}

export async function PATCH(request: Request, { params }: Props) {
  const { jobId } = await params;
  const body = (await request.json().catch(() => ({}))) as Partial<JobExpense> & { expense_id?: string };

  if (!body.expense_id) {
    return NextResponse.json({ ok: false, error: "expense_id is required." }, { status: 400 });
  }
  if (!canPersistToSupabase()) return NextResponse.json({ ok: true });

  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.description !== undefined) {
    const description = (body.description ?? "").trim();
    if (!description) return NextResponse.json({ ok: false, error: "Description cannot be empty." }, { status: 400 });
    patch.description = description;
  }
  if (body.amount !== undefined) {
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ ok: false, error: "Amount must be greater than zero." }, { status: 400 });
    }
    patch.amount = round2(amount);
  }
  if (body.vat_amount !== undefined) patch.vat_amount = round2(Math.max(0, Number(body.vat_amount ?? 0)));
  if (body.category !== undefined) {
    patch.category = CATEGORIES.includes(body.category as JobExpenseCategory) ? body.category : "other";
  }
  if (body.supplier_name !== undefined) patch.supplier_name = body.supplier_name?.trim() || null;
  if (body.expense_date !== undefined && body.expense_date) patch.expense_date = body.expense_date;
  if (body.notes !== undefined) patch.notes = body.notes?.trim() || null;
  if (body.receipt_url !== undefined) patch.receipt_url = body.receipt_url || null;

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("job_expenses")
    .update(patch)
    .eq("id", body.expense_id)
    .eq("job_id", jobId)
    .select("*")
    .single();

  if (error || !data) {
    return NextResponse.json({ ok: false, error: error?.message ?? "Unable to update expense." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, expense: { ...(data as JobExpense), source: "job" } });
}

export async function DELETE(request: Request, { params }: Props) {
  const { jobId } = await params;
  const body = (await request.json().catch(() => ({}))) as { expense_id?: string };

  if (!body.expense_id) {
    return NextResponse.json({ ok: false, error: "expense_id is required." }, { status: 400 });
  }
  if (!canPersistToSupabase()) return NextResponse.json({ ok: true });

  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("job_expenses").delete().eq("id", body.expense_id).eq("job_id", jobId);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

function mapDiaryCategory(category: string | null): JobExpenseCategory {
  if (!category) return "other";
  if (CATEGORIES.includes(category as JobExpenseCategory)) return category as JobExpenseCategory;
  if (category === "travel") return "fuel";
  return "other";
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}
