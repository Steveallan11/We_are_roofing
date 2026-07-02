import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { createActivity } from "@/lib/activity/createActivity";
import { getJobBundle } from "@/lib/data";
import { buildInvoiceLineItemsFromQuote, persistInvoiceArtifacts } from "@/lib/invoice-engine";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { InvoiceLineItem, InvoiceRecord, InvoiceType } from "@/lib/types";
import { canPersistToSupabase, getNextInvoiceRef } from "@/lib/workflows";

type Props = {
  params: Promise<{ jobId: string }>;
};

export async function POST(request: Request, { params }: Props) {
  const { jobId } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    type?: InvoiceType;
    deposit_percentage?: number;
  };
  const invoiceType: InvoiceType = body.type === "deposit" || body.type === "final" ? body.type : "standard";

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

  const quote = bundle.quote;
  const liveInvoicesForQuote = bundle.invoices.filter((invoice) => invoice.quote_id === quote.id && invoice.status !== "Void");

  let lineItems: InvoiceLineItem[];
  let subtotal: number;
  let vatAmount: number;
  let total: number;
  let notes: string;
  let dueInDays: number;

  if (invoiceType === "deposit") {
    const existingDeposit = liveInvoicesForQuote.find((invoice) => invoice.invoice_type === "deposit");
    if (existingDeposit) {
      return NextResponse.json(
        { ok: false, error: `A deposit invoice already exists (${existingDeposit.invoice_ref}). Void it first if you need to re-raise it.` },
        { status: 400 }
      );
    }

    const percentage = Number(body.deposit_percentage ?? 0);
    if (!Number.isFinite(percentage) || percentage <= 0 || percentage >= 100) {
      return NextResponse.json({ ok: false, error: "Deposit percentage must be between 1 and 99." }, { status: 400 });
    }

    total = round2((Number(quote.total ?? 0) * percentage) / 100);
    if (total <= 0) {
      return NextResponse.json({ ok: false, error: "The quote total is zero — nothing to invoice." }, { status: 400 });
    }
    ({ subtotal, vatAmount } = splitVatFromGross(total, quote.subtotal, quote.vat_amount));
    lineItems = [
      {
        description: `Deposit (${percentage}%) — ${bundle.job.job_title} (quote ${quote.quote_ref})`,
        quantity: 1,
        unit: "item",
        unit_price: subtotal,
        vat_applicable: vatAmount > 0,
        total: subtotal
      }
    ];
    notes = `Deposit invoice (${percentage}% of quote ${quote.quote_ref}).`;
    dueInDays = 7;
  } else if (invoiceType === "final") {
    const existingFinal = liveInvoicesForQuote.find((invoice) => invoice.invoice_type === "final");
    if (existingFinal) {
      return NextResponse.json(
        { ok: false, error: `A final balance invoice already exists (${existingFinal.invoice_ref}). Void it first if you need to re-raise it.` },
        { status: 400 }
      );
    }

    const alreadyInvoiced = liveInvoicesForQuote.reduce((sum, invoice) => sum + Number(invoice.total ?? 0), 0);
    total = round2(Number(quote.total ?? 0) - alreadyInvoiced);
    if (total <= 0) {
      return NextResponse.json(
        { ok: false, error: `The full quote value (£${Number(quote.total ?? 0).toFixed(2)}) has already been invoiced.` },
        { status: 400 }
      );
    }
    ({ subtotal, vatAmount } = splitVatFromGross(total, quote.subtotal, quote.vat_amount));
    lineItems = [
      {
        description: `Final balance — ${bundle.job.job_title} (quote ${quote.quote_ref})`,
        quantity: 1,
        unit: "item",
        unit_price: subtotal,
        vat_applicable: vatAmount > 0,
        total: subtotal
      }
    ];
    notes =
      alreadyInvoiced > 0
        ? `Final balance for quote ${quote.quote_ref} (£${alreadyInvoiced.toFixed(2)} previously invoiced).`
        : `Final balance for quote ${quote.quote_ref}.`;
    dueInDays = 14;
  } else {
    const existingForQuote = liveInvoicesForQuote.find((invoice) => (invoice.invoice_type ?? "standard") === "standard");
    if (existingForQuote) {
      return NextResponse.json({
        ok: true,
        message: "Invoice already exists for this quote.",
        invoice: existingForQuote,
        pdf_url: existingForQuote.pdf_url
      });
    }

    lineItems = buildInvoiceLineItemsFromQuote(quote);
    subtotal = sumLineItems(lineItems);
    vatAmount = quote.vat_amount ?? calculateVat(lineItems, bundle.business.vat_rate);
    total = round2(subtotal + vatAmount);
    notes = `Raised from quote ${quote.quote_ref}.`;
    dueInDays = 14;
  }

  const invoiceRef = await getNextInvoiceRef();
  const today = new Date();
  const issueDate = today.toISOString().slice(0, 10);
  const dueDate = new Date(today.getTime() + dueInDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("invoices")
    .insert({
      business_id: bundle.business.id,
      job_id: bundle.job.id,
      quote_id: quote.id,
      invoice_ref: invoiceRef,
      status: "Draft",
      invoice_type: invoiceType,
      issue_date: issueDate,
      due_date: dueDate,
      line_items: lineItems,
      subtotal,
      vat_amount: vatAmount,
      total,
      amount_paid: 0,
      balance_due: total,
      notes,
      payment_terms: bundle.business.payment_terms
    })
    .select("*")
    .single();

  if (error || !data) {
    return NextResponse.json({ ok: false, error: error?.message ?? "Unable to create invoice." }, { status: 500 });
  }

  const invoice = data as InvoiceRecord;
  const artifacts = await persistInvoiceArtifacts(supabase, { ...bundle, invoices: [invoice, ...bundle.invoices] }, invoice);

  const typeLabel = invoiceType === "deposit" ? "Deposit invoice" : invoiceType === "final" ? "Final balance invoice" : "Invoice";
  await createActivity(supabase, {
    business_id: bundle.business.id,
    job_id: bundle.job.id,
    customer_id: bundle.customer.id,
    quote_id: quote.id,
    invoice_id: invoice.id,
    activity_type: "invoice_created",
    message: `${typeLabel} ${invoiceRef} created for £${total.toFixed(2)}`,
    actor_type: "user",
    actor_id: auth.session.user?.id ?? null,
    actor_name: auth.session.user?.email ?? null,
    linked_entity_type: "invoice",
    linked_entity_id: invoice.id,
    details: { invoice_ref: invoiceRef, total, quote_ref: quote.quote_ref, invoice_type: invoiceType }
  });

  return NextResponse.json({
    ok: true,
    message: artifacts.pdfUrl ? `${typeLabel} created and filed in documents.` : `${typeLabel} created, but PDF filing needs attention.`,
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

/**
 * Split a VAT-inclusive amount into net + VAT using the quote's own effective
 * VAT ratio, so partial invoices stay consistent with the quote whatever the
 * business VAT setup is.
 */
function splitVatFromGross(gross: number, quoteSubtotal?: number | null, quoteVat?: number | null) {
  const net = Number(quoteSubtotal ?? 0);
  const vat = Number(quoteVat ?? 0);
  const ratio = net > 0 && vat > 0 ? vat / net : 0;
  const subtotal = ratio > 0 ? round2(gross / (1 + ratio)) : gross;
  return { subtotal, vatAmount: round2(gross - subtotal) };
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}
