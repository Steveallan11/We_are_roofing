import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { createActivity } from "@/lib/activity/createActivity";
import { getJobBundle } from "@/lib/data";
import { persistInvoiceArtifacts, splitVatFromGross, sumLiveInvoiceTotal } from "@/lib/invoice-engine";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { InvoiceRecord, InvoiceType } from "@/lib/types";
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

  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

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

  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const bundle = await getJobBundle(jobId);
  if (!bundle?.quote) return NextResponse.json({ ok: false, error: "Quote not found." }, { status: 404 });

  const supabase = createSupabaseAdminClient();
  const { data: stage } = await supabase.from("payment_stages").select("*").eq("id", body.stage_id).single();
  if (!stage) return NextResponse.json({ ok: false, error: "Payment stage not found." }, { status: 404 });

  if (body.action === "paid") {
    await supabase.from("payment_stages").update({ status: "paid", paid_at: new Date().toISOString(), payment_ref: body.payment_ref || null }).eq("id", body.stage_id);
    return NextResponse.json({ ok: true });
  }

  if (stage.invoice_id) {
    return NextResponse.json({ ok: false, error: "This stage has already been invoiced." }, { status: 400 });
  }

  const quote = bundle.quote;
  const liveInvoicesForQuote = bundle.invoices.filter((invoice) => invoice.quote_id === quote.id && invoice.status !== "Void");
  const alreadyInvoiced = sumLiveInvoiceTotal(liveInvoicesForQuote);
  const total = Number(stage.amount ?? 0);
  if (alreadyInvoiced + total > Number(quote.total ?? 0) + 0.01) {
    return NextResponse.json(
      {
        ok: false,
        error: `Raising this stage would take invoicing past the quote total. £${alreadyInvoiced.toFixed(2)} already invoiced of £${Number(quote.total ?? 0).toFixed(2)}.`
      },
      { status: 400 }
    );
  }

  const { data: siblingStages } = await supabase.from("payment_stages").select("stage_number").eq("schedule_id", stage.schedule_id);
  const stageNumbers = (siblingStages ?? []).map((row) => Number(row.stage_number ?? 0));
  const maxStageNumber = stageNumbers.length > 0 ? Math.max(...stageNumbers) : Number(stage.stage_number ?? 0);
  const invoiceType: InvoiceType = Number(stage.stage_number) <= 1 ? "deposit" : Number(stage.stage_number) >= maxStageNumber ? "final" : "interim";

  const { subtotal, vatAmount } = splitVatFromGross(total, quote.subtotal, quote.vat_amount);
  const invoiceRef = await getNextInvoiceRef();
  const today = new Date().toISOString().slice(0, 10);
  const insert = await supabase
    .from("invoices")
    .insert({
      business_id: bundle.business.id,
      job_id: jobId,
      quote_id: quote.id,
      invoice_ref: invoiceRef,
      status: "Draft",
      invoice_type: invoiceType,
      issue_date: today,
      due_date: today,
      line_items: [{ description: `${stage.stage_name} — ${bundle.job.job_title} (quote ${quote.quote_ref})`, quantity: 1, unit: "item", unit_price: subtotal, vat_applicable: vatAmount > 0, total: subtotal }],
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

  if (insert.error || !insert.data) return NextResponse.json({ ok: false, error: insert.error?.message ?? "Invoice could not be raised." }, { status: 500 });

  const invoice = insert.data as InvoiceRecord;
  await supabase.from("payment_stages").update({ status: "invoiced", invoice_id: invoice.id }).eq("id", body.stage_id);

  const artifacts = await persistInvoiceArtifacts(supabase, { ...bundle, invoices: [invoice, ...bundle.invoices] }, invoice);

  await createActivity(supabase, {
    business_id: bundle.business.id,
    job_id: jobId,
    customer_id: bundle.customer.id,
    quote_id: quote.id,
    invoice_id: invoice.id,
    activity_type: "invoice_created",
    message: `${stage.stage_name} invoice ${invoiceRef} created for £${total.toFixed(2)}`,
    actor_type: "user",
    actor_id: auth.session.user?.id ?? null,
    actor_name: auth.session.user?.email ?? null,
    linked_entity_type: "invoice",
    linked_entity_id: invoice.id,
    details: { invoice_ref: invoiceRef, total, quote_ref: quote.quote_ref, invoice_type: invoiceType, stage_name: stage.stage_name }
  });

  return NextResponse.json({ ok: true, invoice, pdf_url: artifacts.pdfUrl, warning: artifacts.error });
}
