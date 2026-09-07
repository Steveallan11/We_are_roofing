import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { createActivity } from "@/lib/activity/createActivity";
import { getJobBundle } from "@/lib/data";
import { persistInvoiceArtifacts } from "@/lib/invoice-engine";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { InvoiceRecord, JobVariationRecord } from "@/lib/types";
import { canPersistToSupabase, getNextInvoiceRef } from "@/lib/workflows";

type Props = { params: Promise<{ variationId: string }> };

export async function POST(request: Request, { params }: Props) {
  const { variationId } = await params;
  const body = (await request.json().catch(() => ({}))) as { due_date?: string };
  if (!canPersistToSupabase()) return NextResponse.json({ ok: true, message: "Variation invoice preview created." });
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  const supabase = createSupabaseAdminClient();
  const lookup = await supabase.from("job_variations").select("*").eq("id", variationId).single();
  if (lookup.error || !lookup.data) return NextResponse.json({ ok: false, error: "Additional work not found." }, { status: 404 });
  const variation = lookup.data as JobVariationRecord;
  if (!["Accepted", "Invoiced"].includes(variation.status)) {
    return NextResponse.json({ ok: false, error: "Customer approval is required before invoicing this additional work." }, { status: 400 });
  }

  const existing = await supabase.from("invoices").select("*").eq("variation_id", variation.id).neq("status", "Void").limit(1).maybeSingle();
  if (existing.data) return NextResponse.json({ ok: true, invoice: existing.data, message: `Invoice ${existing.data.invoice_ref} already exists for this additional work.` });
  const bundle = await getJobBundle(variation.job_id);
  if (!bundle) return NextResponse.json({ ok: false, error: "Related job not found." }, { status: 404 });

  const issueDate = new Date().toISOString().slice(0, 10);
  const dueDate = body.due_date?.trim() || addDays(issueDate, 7);
  if (!isValidIsoDate(dueDate) || dueDate < issueDate) return NextResponse.json({ ok: false, error: "Choose a valid payment due date." }, { status: 400 });
  const invoiceRef = await getNextInvoiceRef();
  const insert = await supabase
    .from("invoices")
    .insert({
      business_id: variation.business_id,
      job_id: variation.job_id,
      quote_id: null,
      variation_id: variation.id,
      invoice_ref: invoiceRef,
      status: "Draft",
      invoice_type: "interim",
      issue_date: issueDate,
      due_date: dueDate,
      line_items: variation.line_items.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        unit_price: item.unit_price,
        vat_applicable: item.vat_applicable,
        total: item.total
      })),
      subtotal: variation.subtotal,
      vat_amount: variation.vat_amount,
      total: variation.total,
      amount_paid: 0,
      balance_due: variation.total,
      notes: `Additional work ${variation.variation_ref}: ${variation.title}`,
      payment_terms: bundle.business.payment_terms
    })
    .select("*")
    .single();
  if (insert.error || !insert.data) {
    if (insert.error?.code === "23505") {
      const concurrent = await supabase.from("invoices").select("*").eq("variation_id", variation.id).neq("status", "Void").limit(1).maybeSingle();
      if (concurrent.data) {
        return NextResponse.json({ ok: true, invoice: concurrent.data, message: `Invoice ${concurrent.data.invoice_ref} already exists for this additional work.` });
      }
    }
    return NextResponse.json({ ok: false, error: insert.error?.message ?? "Invoice could not be created." }, { status: 500 });
  }

  const invoice = insert.data as InvoiceRecord;
  const artifacts = await persistInvoiceArtifacts(supabase, { ...bundle, invoices: [invoice, ...bundle.invoices] }, invoice);
  await supabase.from("job_variations").update({ status: "Invoiced", updated_at: new Date().toISOString() }).eq("id", variation.id);
  await createActivity(supabase, {
    business_id: variation.business_id,
    job_id: variation.job_id,
    customer_id: bundle.customer.id,
    invoice_id: invoice.id,
    activity_type: "variation_invoiced",
    message: `${variation.variation_ref} invoiced as ${invoiceRef} for £${variation.total.toFixed(2)}`,
    actor_type: "user",
    actor_id: auth.session.user?.id ?? null,
    actor_name: auth.session.user?.email ?? null,
    linked_entity_type: "variation",
    linked_entity_id: variation.id,
    details: { invoice_ref: invoiceRef, total: variation.total }
  });
  return NextResponse.json({ ok: true, invoice, pdf_url: artifacts.pdfUrl, warning: artifacts.error, message: `${invoiceRef} created for this additional work.` });
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T12:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function isValidIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
