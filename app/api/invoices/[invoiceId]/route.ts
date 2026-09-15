import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { createActivity } from "@/lib/activity/createActivity";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { calculateCisDeduction, persistInvoiceArtifacts, round2 } from "@/lib/invoice-engine";
import { getJobBundle } from "@/lib/data";
import { getQuoteLineItemCategory } from "@/lib/quotes/value";
import type { ActivityType } from "@/lib/activity/types";
import type { InvoiceLineItem, InvoiceRecord, InvoiceStatus, InvoiceVatTreatment } from "@/lib/types";
import { updateVariationInvoiceStatus } from "@/lib/variations/invoicing";
import { canPersistToSupabase } from "@/lib/workflows";

type Props = {
  params: Promise<{ invoiceId: string }>;
};

const allowedStatuses: InvoiceStatus[] = ["Draft", "Sent", "Part Paid", "Paid", "Overdue", "Void"];

export async function PATCH(request: Request, { params }: Props) {
  const { invoiceId } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    status?: InvoiceStatus;
    amount_paid?: number;
    payment_method?: string;
    payment_reference?: string;
    vat_treatment?: InvoiceVatTreatment;
    customer_vat_number?: string;
    reverse_charge_confirmed?: boolean;
    cis_deduction_rate?: number;
  };

  const isTaxTreatmentUpdate = body.vat_treatment != null || body.cis_deduction_rate != null;
  if (!isTaxTreatmentUpdate && (!body.status || !allowedStatuses.includes(body.status))) {
    return NextResponse.json({ ok: false, error: "Valid invoice status is required." }, { status: 400 });
  }

  if (!canPersistToSupabase()) {
    return NextResponse.json({ ok: true, message: "Invoice update preview completed." });
  }

  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const supabase = createSupabaseAdminClient();
  const { data: invoice, error } = await supabase.from("invoices").select("*").eq("id", invoiceId).single();
  if (error || !invoice) {
    return NextResponse.json({ ok: false, error: error?.message ?? "Invoice not found." }, { status: 404 });
  }

  if (isTaxTreatmentUpdate) {
    if (invoice.status !== "Draft") {
      return NextResponse.json({ ok: false, error: "Tax treatment can only be edited while the invoice is still a draft." }, { status: 400 });
    }
    if (Number(invoice.amount_paid ?? 0) > 0) {
      return NextResponse.json({ ok: false, error: "Remove recorded payments before editing the invoice tax treatment." }, { status: 400 });
    }
    const vatTreatment: InvoiceVatTreatment = body.vat_treatment === "domestic_reverse_charge" ? "domestic_reverse_charge" : "standard";
    const cisRate = Number(body.cis_deduction_rate ?? 0);
    if (![0, 20, 30].includes(cisRate)) {
      return NextResponse.json({ ok: false, error: "CIS deduction rate must be 0%, 20% or 30%." }, { status: 400 });
    }
    const customerVatNumber = body.customer_vat_number?.trim().toUpperCase() || null;
    if (vatTreatment === "domestic_reverse_charge" && (!body.reverse_charge_confirmed || !customerVatNumber)) {
      return NextResponse.json({ ok: false, error: "Enter the customer's VAT number and confirm the reverse-charge conditions." }, { status: 400 });
    }

    const bundle = await getJobBundle(String(invoice.job_id));
    if (!bundle) return NextResponse.json({ ok: false, error: "Related job could not be loaded." }, { status: 404 });
    const sourceLines = Array.isArray(invoice.line_items) ? (invoice.line_items as InvoiceLineItem[]) : [];
    const lineItems = sourceLines.map((line) => {
      if (line.category || !bundle.quote) return line;
      const description = line.description.toLowerCase();
      const quoteLine = bundle.quote.cost_breakdown.find((candidate) => description.includes(candidate.item.toLowerCase()));
      return quoteLine ? { ...line, category: getQuoteLineItemCategory(quoteLine) } : line;
    });
    const cis = calculateCisDeduction(lineItems, cisRate);
    if (cisRate > 0 && cis.labourAmount <= 0) {
      return NextResponse.json({ ok: false, error: "No labour amount was found on this invoice. Split the quote into materials and labour first." }, { status: 400 });
    }
    const subtotal = round2(lineItems.reduce((sum, line) => sum + Number(line.total ?? 0), 0));
    const calculatedVat = round2(lineItems.filter((line) => line.vat_applicable).reduce((sum, line) => sum + Number(line.total ?? 0) * (Number(bundle.business.vat_rate ?? 0) / 100), 0));
    const vatAmount = vatTreatment === "standard" ? calculatedVat : 0;
    const reverseChargeVatAmount = vatTreatment === "domestic_reverse_charge" ? calculatedVat : 0;
    const total = round2(subtotal + vatAmount);
    const balanceDue = round2(Math.max(0, total - cis.deductionAmount));
    const taxUpdate = await supabase.from("invoices").update({
      line_items: lineItems,
      subtotal,
      vat_amount: vatAmount,
      vat_treatment: vatTreatment,
      reverse_charge_vat_amount: reverseChargeVatAmount,
      customer_vat_number: vatTreatment === "domestic_reverse_charge" ? customerVatNumber : null,
      reverse_charge_confirmed_at: vatTreatment === "domestic_reverse_charge" ? new Date().toISOString() : null,
      cis_deduction_rate: cis.rate,
      cis_labour_amount: cis.labourAmount,
      cis_deduction_amount: cis.deductionAmount,
      total,
      balance_due: balanceDue,
      updated_at: new Date().toISOString()
    }).eq("id", invoiceId).select("*").single();
    if (taxUpdate.error || !taxUpdate.data) {
      return NextResponse.json({ ok: false, error: taxUpdate.error?.message ?? "Unable to update invoice tax treatment." }, { status: 500 });
    }
    const updatedInvoice = taxUpdate.data as InvoiceRecord;
    const artifacts = await persistInvoiceArtifacts(supabase, { ...bundle, invoices: [updatedInvoice, ...bundle.invoices.filter((item) => item.id !== invoiceId)] }, updatedInvoice);
    return NextResponse.json({ ok: true, message: artifacts.pdfUrl ? "Invoice updated and PDF regenerated." : "Invoice updated. PDF filing needs attention.", invoice: updatedInvoice, warning: artifacts.error || null });
  }

  const invoiceTotal = Number(invoice.total ?? 0);
  const payableTotal = Math.max(0, invoiceTotal - Number(invoice.cis_deduction_amount ?? 0));
  const paidAmount =
    body.status === "Paid" ? Math.min(payableTotal, Number(body.amount_paid ?? payableTotal)) : Number(invoice.amount_paid ?? 0);
  const balanceDue = Math.max(0, payableTotal - paidAmount);
  const payload = {
    status: body.status!,
    amount_paid: paidAmount,
    balance_due: balanceDue,
    sent_at: body.status === "Sent" ? new Date().toISOString() : invoice.sent_at,
    paid_at: body.status === "Paid" ? new Date().toISOString() : invoice.paid_at,
    updated_at: new Date().toISOString()
  };

  const update = await supabase.from("invoices").update(payload).eq("id", invoiceId).select("*").single();
  if (update.error || !update.data) {
    return NextResponse.json({ ok: false, error: update.error?.message ?? "Unable to update invoice." }, { status: 500 });
  }

  const paymentDelta = body.status === "Paid" ? paidAmount - Number(invoice.amount_paid ?? 0) : 0;
  if (paymentDelta > 0) {
    await supabase.from("invoice_payments").insert({
      invoice_id: invoiceId,
      amount: paymentDelta,
      payment_method: body.payment_method ?? "Manual",
      payment_reference: body.payment_reference ?? null
    });
  }

  if (body.status !== invoice.status) {
    const activityType: ActivityType = body.status === "Paid" ? "payment_received" : body.status === "Sent" ? "invoice_sent" : "status_changed";
    const message =
      body.status === "Paid"
        ? `Payment received: £${paymentDelta.toFixed(2)} for ${invoice.invoice_ref}`
        : body.status === "Sent"
          ? `Invoice ${invoice.invoice_ref} sent`
          : `Invoice ${invoice.invoice_ref} marked ${body.status}`;
    await createActivity(supabase, {
      business_id: invoice.business_id ? String(invoice.business_id) : null,
      job_id: invoice.job_id ? String(invoice.job_id) : null,
      invoice_id: invoiceId,
      activity_type: activityType,
      message,
      actor_type: "user",
      actor_id: auth.session.user?.id ?? null,
      actor_name: auth.session.user?.email ?? null,
      linked_entity_type: "invoice",
      linked_entity_id: invoiceId,
      details: {
        from_status: invoice.status,
        to_status: body.status,
        amount: paymentDelta || undefined,
        payment_method: body.payment_method ?? null,
        payment_reference: body.payment_reference ?? null
      }
    });
  }

  if (invoice.variation_id) await updateVariationInvoiceStatus(supabase, invoice.variation_id);

  return NextResponse.json({
    ok: true,
    message: `Invoice marked ${body.status}.`,
    invoice: update.data
  });
}

export async function DELETE(_request: Request, { params }: Props) {
  const { invoiceId } = await params;

  if (!canPersistToSupabase()) {
    return NextResponse.json({ ok: true, message: "Invoice delete preview completed." });
  }

  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const supabase = createSupabaseAdminClient();
  const { data: invoice, error } = await supabase.from("invoices").select("*").eq("id", invoiceId).single();
  if (error || !invoice) {
    return NextResponse.json({ ok: false, error: error?.message ?? "Invoice not found." }, { status: 404 });
  }

  if (invoice.status !== "Void") {
    return NextResponse.json({ ok: false, error: "Only void invoices can be deleted." }, { status: 400 });
  }

  const paymentCheck = await supabase.from("invoice_payments").select("id").eq("invoice_id", invoiceId).limit(1);
  if (paymentCheck.error) {
    return NextResponse.json({ ok: false, error: paymentCheck.error.message }, { status: 500 });
  }
  if (Number(invoice.amount_paid ?? 0) > 0 || (paymentCheck.data?.length ?? 0) > 0) {
    return NextResponse.json({ ok: false, error: "Invoices with recorded payments cannot be deleted." }, { status: 400 });
  }

  const { data: documents } = await supabase
    .from("job_documents")
    .select("id, storage_bucket, storage_path")
    .eq("invoice_id", invoiceId);

  for (const document of documents ?? []) {
    const bucket = typeof document.storage_bucket === "string" ? document.storage_bucket : null;
    const path = typeof document.storage_path === "string" ? document.storage_path : null;
    if (bucket && path) {
      await supabase.storage.from(bucket).remove([path]);
    }
  }

  await createActivity(supabase, {
    business_id: invoice.business_id ? String(invoice.business_id) : null,
    job_id: invoice.job_id ? String(invoice.job_id) : null,
    invoice_id: invoiceId,
    activity_type: "status_changed",
    message: `Void invoice ${invoice.invoice_ref} deleted`,
    actor_type: "user",
    actor_id: auth.session.user?.id ?? null,
    actor_name: auth.session.user?.email ?? null,
    linked_entity_type: "invoice",
    linked_entity_id: invoiceId,
    details: { invoice_ref: invoice.invoice_ref, deleted: true }
  });

  await supabase.from("job_documents").delete().eq("invoice_id", invoiceId);
  await supabase.from("invoice_payments").delete().eq("invoice_id", invoiceId);
  const deleted = await supabase.from("invoices").delete().eq("id", invoiceId);
  if (deleted.error) {
    return NextResponse.json({ ok: false, error: deleted.error.message }, { status: 500 });
  }

  if (invoice.variation_id) await updateVariationInvoiceStatus(supabase, invoice.variation_id);

  return NextResponse.json({ ok: true, message: `${invoice.invoice_ref} deleted.` });
}
