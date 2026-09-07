import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { createActivity } from "@/lib/activity/createActivity";
import { getJobBundle } from "@/lib/data";
import { persistInvoiceArtifacts } from "@/lib/invoice-engine";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { InvoiceRecord, JobVariationRecord } from "@/lib/types";
import { getVariationInvoiceProgress, updateVariationInvoiceStatus } from "@/lib/variations/invoicing";
import { canPersistToSupabase, getNextInvoiceRef } from "@/lib/workflows";

type Props = { params: Promise<{ variationId: string }> };

export async function POST(request: Request, { params }: Props) {
  const { variationId } = await params;
  const body = (await request.json().catch(() => ({}))) as { due_date?: string; amount?: number };
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

  const bundle = await getJobBundle(variation.job_id);
  if (!bundle) return NextResponse.json({ ok: false, error: "Related job not found." }, { status: 404 });

  const variationInvoices = bundle.invoices.filter((invoice) => invoice.variation_id === variation.id);
  const progress = getVariationInvoiceProgress(variationInvoices, variation.id, Number(variation.total ?? 0));
  if (progress.remaining <= 0.01) {
    return NextResponse.json({ ok: false, error: "This additional work has already been invoiced in full." }, { status: 400 });
  }

  const requestedAmount = body.amount === undefined ? progress.remaining : roundMoney(Number(body.amount));
  if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
    return NextResponse.json({ ok: false, error: "Invoice amount must be greater than zero." }, { status: 400 });
  }
  if (requestedAmount > progress.remaining + 0.01) {
    return NextResponse.json(
      { ok: false, error: `Invoice amount cannot exceed the remaining approved balance of £${progress.remaining.toFixed(2)}.` },
      { status: 400 }
    );
  }

  const issueDate = new Date().toISOString().slice(0, 10);
  const dueDate = body.due_date?.trim() || addDays(issueDate, 7);
  if (!isValidIsoDate(dueDate) || dueDate < issueDate) return NextResponse.json({ ok: false, error: "Choose a valid payment due date." }, { status: 400 });
  const previousLiveInvoices = variationInvoices.filter((invoice) => invoice.status !== "Void");
  const previousSubtotal = roundMoney(previousLiveInvoices.reduce((sum, invoice) => sum + Number(invoice.subtotal ?? 0), 0));
  const previousVat = roundMoney(previousLiveInvoices.reduce((sum, invoice) => sum + Number(invoice.vat_amount ?? 0), 0));
  const isFinalStage = requestedAmount >= progress.remaining - 0.01;
  const amounts = isFinalStage
    ? {
        subtotal: roundMoney(Math.max(0, Number(variation.subtotal ?? 0) - previousSubtotal)),
        vatAmount: roundMoney(Math.max(0, Number(variation.vat_amount ?? 0) - previousVat))
      }
    : splitVariationGross(requestedAmount, Number(variation.subtotal ?? 0), Number(variation.vat_amount ?? 0));
  const invoiceTotal = roundMoney(amounts.subtotal + amounts.vatAmount);
  const invoiceNumber = progress.invoiceCount + 1;
  const invoiceDescription = `${isFinalStage && progress.invoiceCount > 0 ? "Final balance" : progress.invoiceCount > 0 || !isFinalStage ? `Stage ${invoiceNumber}` : "Full amount"} - ${variation.title}`;
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
      line_items: progress.invoiceCount === 0 && isFinalStage
        ? variation.line_items.map((item) => ({
            description: item.description,
            quantity: item.quantity,
            unit: item.unit,
            unit_price: item.unit_price,
            vat_applicable: item.vat_applicable,
            total: item.total
          }))
        : [{
            description: `${invoiceDescription} (${variation.variation_ref})`,
            quantity: 1,
            unit: "stage",
            unit_price: amounts.subtotal,
            vat_applicable: amounts.vatAmount > 0,
            total: amounts.subtotal
          }],
      subtotal: amounts.subtotal,
      vat_amount: amounts.vatAmount,
      total: invoiceTotal,
      amount_paid: 0,
      balance_due: invoiceTotal,
      notes: `Additional work ${variation.variation_ref}: ${variation.title}. ${invoiceDescription}. Approved total £${Number(variation.total).toFixed(2)}.`,
      payment_terms: bundle.business.payment_terms
    })
    .select("*")
    .single();
  if (insert.error || !insert.data) {
    const overInvoiced = insert.error?.message?.includes("exceeds the approved additional-work balance");
    return NextResponse.json(
      { ok: false, error: overInvoiced ? "Another invoice has used some of this balance. Refresh and try the remaining amount again." : insert.error?.message ?? "Invoice could not be created." },
      { status: overInvoiced ? 409 : 500 }
    );
  }

  const invoice = insert.data as InvoiceRecord;
  const artifacts = await persistInvoiceArtifacts(supabase, { ...bundle, invoices: [invoice, ...bundle.invoices] }, invoice);
  await updateVariationInvoiceStatus(supabase, variation.id);
  await createActivity(supabase, {
    business_id: variation.business_id,
    job_id: variation.job_id,
    customer_id: bundle.customer.id,
    invoice_id: invoice.id,
    activity_type: "variation_invoiced",
    message: `${variation.variation_ref} invoiced as ${invoiceRef} for £${invoiceTotal.toFixed(2)}`,
    actor_type: "user",
    actor_id: auth.session.user?.id ?? null,
    actor_name: auth.session.user?.email ?? null,
    linked_entity_type: "variation",
    linked_entity_id: variation.id,
    details: { invoice_ref: invoiceRef, total: invoiceTotal, approved_total: variation.total, remaining: roundMoney(progress.remaining - invoiceTotal) }
  });
  return NextResponse.json({ ok: true, invoice, pdf_url: artifacts.pdfUrl, warning: artifacts.error, message: `${invoiceRef} created for £${invoiceTotal.toFixed(2)}. £${roundMoney(progress.remaining - invoiceTotal).toFixed(2)} remains available to invoice.` });
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

function splitVariationGross(gross: number, approvedSubtotal: number, approvedVat: number) {
  const ratio = approvedSubtotal > 0 ? approvedVat / approvedSubtotal : 0;
  const subtotal = ratio > 0 ? roundMoney(gross / (1 + ratio)) : gross;
  return { subtotal, vatAmount: roundMoney(gross - subtotal) };
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
