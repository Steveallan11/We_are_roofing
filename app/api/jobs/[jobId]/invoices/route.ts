import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { createActivity } from "@/lib/activity/createActivity";
import { getJobBundle } from "@/lib/data";
import { buildInvoiceLineItemsFromQuote, persistInvoiceArtifacts } from "@/lib/invoice-engine";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { InvoiceLineItem, InvoiceRecord } from "@/lib/types";
import { canPersistToSupabase, getNextInvoiceRef } from "@/lib/workflows";

type Props = {
  params: Promise<{ jobId: string }>;
};

export async function POST(_request: Request, { params }: Props) {
  const { jobId } = await params;

  if (!canPersistToSupabase()) {
    return NextResponse.json({
      ok: true,
      message: "Invoice creation preview completed.",
      invoice: null
    });
  }

  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const bundle = await getJobBundle(jobId);
  if (!bundle) {
    return NextResponse.json({ ok: false, error: "Job not found." }, { status: 404 });
  }

  if (!bundle.quote) {
    return NextResponse.json({ ok: false, error: "Create a quote before raising an invoice." }, { status: 400 });
  }

  const existingForQuote = bundle.invoices.find((invoice) => invoice.quote_id === bundle.quote?.id && invoice.status !== "Void");
  if (existingForQuote) {
    return NextResponse.json({
      ok: true,
      message: "Invoice already exists for this quote.",
      invoice: existingForQuote,
      pdf_url: existingForQuote.pdf_url
    });
  }

  const invoiceRef = await getNextInvoiceRef();
  const lineItems = buildInvoiceLineItemsFromQuote(bundle.quote);
  const subtotal = sumLineItems(lineItems);
  const vatAmount = bundle.quote.vat_amount ?? calculateVat(lineItems, bundle.business.vat_rate);
  const total = subtotal + vatAmount;
  const today = new Date();
  const issueDate = today.toISOString().slice(0, 10);
  const dueDate = issueDate;
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("invoices")
    .insert({
      business_id: bundle.business.id,
      job_id: bundle.job.id,
      quote_id: bundle.quote.id,
      invoice_ref: invoiceRef,
      status: "Draft",
      issue_date: issueDate,
      due_date: dueDate,
      line_items: lineItems,
      subtotal,
      vat_amount: vatAmount,
      total,
      amount_paid: 0,
      balance_due: total,
      notes: `Raised from quote ${bundle.quote.quote_ref}.`,
      payment_terms: bundle.business.payment_terms
    })
    .select("*")
    .single();

  if (error || !data) {
    return NextResponse.json({ ok: false, error: error?.message ?? "Unable to create invoice." }, { status: 500 });
  }

  const invoice = data as InvoiceRecord;
  const artifacts = await persistInvoiceArtifacts(supabase, { ...bundle, invoices: [invoice, ...bundle.invoices] }, invoice);

  await createActivity(supabase, {
    business_id: bundle.business.id,
    job_id: bundle.job.id,
    customer_id: bundle.customer.id,
    quote_id: bundle.quote.id,
    invoice_id: invoice.id,
    activity_type: "invoice_created",
    message: `Invoice ${invoiceRef} created for £${total.toFixed(2)}`,
    actor_type: "user",
    actor_id: auth.session.user?.id ?? null,
    actor_name: auth.session.user?.email ?? null,
    linked_entity_type: "invoice",
    linked_entity_id: invoice.id,
    details: { invoice_ref: invoiceRef, total, quote_ref: bundle.quote.quote_ref }
  });

  return NextResponse.json({
    ok: true,
    message: artifacts.pdfUrl ? "Invoice created and filed in documents." : "Invoice created, but PDF filing needs attention.",
    invoice,
    pdf_url: artifacts.pdfUrl,
    warning: artifacts.error
  });
}

function sumLineItems(items: InvoiceLineItem[]) {
  return Math.round(items.reduce((sum, item) => sum + item.total, 0) * 100) / 100;
}

function calculateVat(items: InvoiceLineItem[], vatRate: number) {
  const taxable = items.filter((item) => item.vat_applicable).reduce((sum, item) => sum + item.total, 0);
  return Math.round(taxable * (vatRate / 100) * 100) / 100;
}
