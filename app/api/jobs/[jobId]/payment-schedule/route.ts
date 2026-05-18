import { NextResponse } from "next/server";
import { getJobBundle } from "@/lib/data";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { canPersistToSupabase, getNextInvoiceRef } from "@/lib/workflows";

type Props = {
  params: Promise<{ jobId: string }>;
};

const TEMPLATES: Record<string, Array<{ stage_name: string; stage_number: number; percentage: number; due_trigger: string }>> = {
  "50/50 Standard": [
    { stage_name: "Deposit", stage_number: 1, percentage: 50, due_trigger: "on_acceptance" },
    { stage_name: "Final Balance", stage_number: 2, percentage: 50, due_trigger: "on_completion" }
  ],
  "30/70 Split": [
    { stage_name: "Deposit", stage_number: 1, percentage: 30, due_trigger: "on_acceptance" },
    { stage_name: "Final Balance", stage_number: 2, percentage: 70, due_trigger: "on_completion" }
  ],
  "3-Stage": [
    { stage_name: "Deposit", stage_number: 1, percentage: 30, due_trigger: "on_acceptance" },
    { stage_name: "Midpoint", stage_number: 2, percentage: 40, due_trigger: "on_start" },
    { stage_name: "Final Balance", stage_number: 3, percentage: 30, due_trigger: "on_completion" }
  ]
};

export async function POST(request: Request, { params }: Props) {
  const { jobId } = await params;
  const body = (await request.json().catch(() => ({}))) as { template?: string };
  if (!canPersistToSupabase()) return NextResponse.json({ ok: true });

  const bundle = await getJobBundle(jobId);
  if (!bundle?.quote) return NextResponse.json({ ok: false, error: "A quote is required before creating a payment schedule." }, { status: 400 });
  const template = TEMPLATES[body.template || "50/50 Standard"] ?? TEMPLATES["50/50 Standard"];

  const supabase = createSupabaseAdminClient();
  await supabase.from("payment_schedules").delete().eq("job_id", jobId);
  const { data: schedule, error } = await supabase
    .from("payment_schedules")
    .insert({ job_id: jobId, quote_id: bundle.quote.id, business_id: bundle.business.id })
    .select("*")
    .single();
  if (error || !schedule) return NextResponse.json({ ok: false, error: error?.message ?? "Schedule could not be created." }, { status: 500 });

  const rows = template.map((stage) => ({
    ...stage,
    schedule_id: schedule.id,
    job_id: jobId,
    amount: Math.round((Number(bundle.quote?.total ?? 0) * stage.percentage) / 100),
    status: "pending"
  }));
  const insert = await supabase.from("payment_stages").insert(rows).select("*");
  if (insert.error) return NextResponse.json({ ok: false, error: insert.error.message }, { status: 500 });
  return NextResponse.json({ ok: true, schedule: { ...schedule, stages: insert.data ?? [] } });
}

export async function PATCH(request: Request, { params }: Props) {
  const { jobId } = await params;
  const body = (await request.json().catch(() => ({}))) as { stage_id?: string; action?: "invoice" | "paid"; payment_ref?: string };
  if (!body.stage_id || !body.action) return NextResponse.json({ ok: false, error: "Stage id and action are required." }, { status: 400 });
  if (!canPersistToSupabase()) return NextResponse.json({ ok: true });

  const bundle = await getJobBundle(jobId);
  if (!bundle?.quote) return NextResponse.json({ ok: false, error: "Quote not found." }, { status: 404 });

  const supabase = createSupabaseAdminClient();
  const { data: stage } = await supabase.from("payment_stages").select("*").eq("id", body.stage_id).single();
  if (!stage) return NextResponse.json({ ok: false, error: "Payment stage not found." }, { status: 404 });

  if (body.action === "paid") {
    await supabase.from("payment_stages").update({ status: "paid", paid_at: new Date().toISOString(), payment_ref: body.payment_ref || null }).eq("id", body.stage_id);
    return NextResponse.json({ ok: true });
  }

  const invoiceRef = await getNextInvoiceRef();
  const total = Number(stage.amount ?? 0);
  const vatAmount = Math.round((total / 1.2) * 0.2 * 100) / 100;
  const subtotal = total - vatAmount;
  const today = new Date().toISOString().slice(0, 10);
  const invoice = await supabase
    .from("invoices")
    .insert({
      business_id: bundle.business.id,
      job_id: jobId,
      quote_id: bundle.quote.id,
      invoice_ref: invoiceRef,
      status: "Draft",
      issue_date: today,
      due_date: today,
      line_items: [{ description: `${stage.stage_name} for quote ${bundle.quote.quote_ref}`, quantity: 1, unit: "item", unit_price: subtotal, vat_applicable: true, total: subtotal }],
      subtotal,
      vat_amount: vatAmount,
      total,
      amount_paid: 0,
      balance_due: total,
      notes: `${stage.stage_name} payment stage.`,
      payment_terms: bundle.business.payment_terms
    })
    .select("*")
    .single();

  if (invoice.error || !invoice.data) return NextResponse.json({ ok: false, error: invoice.error?.message ?? "Invoice could not be raised." }, { status: 500 });
  await supabase.from("payment_stages").update({ status: "invoiced", invoice_id: invoice.data.id }).eq("id", body.stage_id);
  return NextResponse.json({ ok: true, invoice: invoice.data });
}
