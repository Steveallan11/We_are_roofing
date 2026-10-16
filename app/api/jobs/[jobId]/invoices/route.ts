import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { createActivity } from "@/lib/activity/createActivity";
import { getJobBundle } from "@/lib/data";
import {
  buildInvoiceLineItemsFromQuote,
  buildProportionalInvoiceLineItemsFromQuote,
  calculateCisDeduction,
  calculateQuoteInvoiceableTotals,
  persistInvoiceArtifacts,
  round2,
  sumLiveInvoiceTotal
} from "@/lib/invoice-engine";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { InvoiceLineItem, InvoiceRecord, InvoiceType, InvoiceVatTreatment } from "@/lib/types";
import { getVariationInvoiceProgress, updateVariationInvoiceStatus } from "@/lib/variations/invoicing";
import { canPersistToSupabase, getNextInvoiceRef } from "@/lib/workflows";

type Props = {
  params: Promise<{ jobId: string }>;
};

export async function POST(request: Request, { params }: Props) {
  const { jobId } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    type?: InvoiceType;
    deposit_percentage?: number;
    amount?: number;
    percentage?: number;
    description?: string;
    vat_treatment?: InvoiceVatTreatment;
    customer_vat_number?: string;
    reverse_charge_confirmed?: boolean;
    cis_deduction_rate?: number;
    variation_ids?: string[];
  };
  const invoiceType: InvoiceType =
    body.type === "deposit" || body.type === "final" || body.type === "interim" ? body.type : "standard";

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
  const requestedVatTreatment: InvoiceVatTreatment = body.vat_treatment === "domestic_reverse_charge" ? "domestic_reverse_charge" : "standard";
  const existingVatTreatment = liveInvoicesForQuote[0]?.vat_treatment ?? "standard";
  if (liveInvoicesForQuote.length > 0 && requestedVatTreatment !== existingVatTreatment) {
    return NextResponse.json(
      { ok: false, error: `This quote already has ${existingVatTreatment === "domestic_reverse_charge" ? "reverse-charge" : "standard-VAT"} invoices. Void them before changing VAT treatment.` },
      { status: 400 }
    );
  }
  const reverseCharge = requestedVatTreatment === "domestic_reverse_charge";
  const customerVatNumber = body.customer_vat_number?.trim().toUpperCase() || null;
  if (reverseCharge && (!body.reverse_charge_confirmed || !customerVatNumber)) {
    return NextResponse.json(
      { ok: false, error: "Confirm the reverse-charge conditions and enter the customer's VAT number before raising this invoice." },
      { status: 400 }
    );
  }
  const requestedCisRate = Number(body.cis_deduction_rate ?? 0);
  if (![0, 20, 30].includes(requestedCisRate)) {
    return NextResponse.json({ ok: false, error: "CIS deduction rate must be 0%, 20% or 30%." }, { status: 400 });
  }
  const existingCisRate = Number(liveInvoicesForQuote[0]?.cis_deduction_rate ?? 0);
  if (liveInvoicesForQuote.length > 0 && requestedCisRate !== existingCisRate) {
    return NextResponse.json(
      { ok: false, error: `This quote already has invoices using a ${existingCisRate}% CIS deduction. Void them before changing the CIS rate.` },
      { status: 400 }
    );
  }
  const invoiceable = calculateQuoteInvoiceableTotals(quote, bundle.business.vat_rate);
  const invoiceLimit = reverseCharge ? invoiceable.subtotal : invoiceable.total;
  const provisionalWarning =
    invoiceable.excludedCount > 0
      ? `${invoiceable.excludedCount} price-to-be-confirmed line${invoiceable.excludedCount === 1 ? " was" : "s were"} excluded from this invoice.`
      : null;

  if (invoiceable.total <= 0) {
    return NextResponse.json(
      { ok: false, error: "All quote lines are marked price to be confirmed. Confirm the prices before raising an invoice." },
      { status: 400 }
    );
  }

  let lineItems: InvoiceLineItem[];
  let subtotal: number;
  let vatAmount: number;
  let reverseChargeVatAmount = 0;
  let total: number;
  let notes: string;
  let dueInDays: number;
  let additionalWorkAllocations: Array<{ variation_id: string; amount: number; subtotal: number; vat_amount: number; line_items: InvoiceLineItem[] }> = [];

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

    total = round2((invoiceLimit * percentage) / 100);
    if (total <= 0) {
      return NextResponse.json({ ok: false, error: "The quote total is zero — nothing to invoice." }, { status: 400 });
    }
    const alreadyInvoicedForDeposit = sumLiveInvoiceTotal(liveInvoicesForQuote);
    if (alreadyInvoicedForDeposit + total > invoiceLimit + 0.01) {
      return NextResponse.json(
        {
          ok: false,
          error: `That deposit would take invoicing past the firm quote total. £${alreadyInvoicedForDeposit.toFixed(2)} already invoiced of £${invoiceLimit.toFixed(2)}.`
        },
        { status: 400 }
      );
    }
    ({ lineItems, subtotal, vatAmount, reverseChargeVatAmount, total } = buildProportionalInvoiceLineItemsFromQuote(
      quote,
      total,
      bundle.business.vat_rate,
      `Booking deposit (${percentage}%)`,
      reverseCharge
    ));
    notes = `Deposit invoice (${percentage}% of quote ${quote.quote_ref}) to secure the booking and begin pre-start preparation.`;
    dueInDays = 7;
  } else if (invoiceType === "final") {
    const existingFinal = liveInvoicesForQuote.find((invoice) => invoice.invoice_type === "final");
    if (existingFinal) {
      return NextResponse.json(
        { ok: false, error: `A final balance invoice already exists (${existingFinal.invoice_ref}). Void it first if you need to re-raise it.` },
        { status: 400 }
      );
    }

    const requestedVariationIds = Array.isArray(body.variation_ids) ? [...new Set(body.variation_ids.filter((id) => typeof id === "string"))] : [];
    const allocations = [] as typeof additionalWorkAllocations;
    for (const variationId of requestedVariationIds) {
      const variation = bundle.variations.find((item) => item.id === variationId);
      if (!variation || !["Accepted", "Invoiced"].includes(variation.status)) {
        return NextResponse.json({ ok: false, error: "Only approved additional-work items on this job can be included in the final invoice." }, { status: 400 });
      }
      const progress = getVariationInvoiceProgress(bundle.invoices, variation.id, Number(variation.total ?? 0), bundle.variation_allocations ?? []);
      if (progress.remaining <= 0.01) continue;
      const previousInvoices = bundle.invoices.filter((invoice) => invoice.variation_id === variation.id && invoice.status !== "Void");
      const previousAllocations = (bundle.variation_allocations ?? []).filter((allocation) => allocation.variation_id === variation.id && bundle.invoices.some((invoice) => invoice.id === allocation.invoice_id && invoice.status !== "Void"));
      const previousSubtotal = previousInvoices.reduce((sum, invoice) => sum + Number(invoice.subtotal ?? 0), 0) + previousAllocations.reduce((sum, allocation) => sum + Number(allocation.subtotal ?? 0), 0);
      const previousVat = previousInvoices.reduce((sum, invoice) => sum + Number(invoice.vat_amount ?? 0), 0) + previousAllocations.reduce((sum, allocation) => sum + Number(allocation.vat_amount ?? 0), 0);
      const remainingSubtotal = round2(Math.max(0, Number(variation.subtotal ?? 0) - previousSubtotal));
      const remainingVat = round2(Math.max(0, Number(variation.vat_amount ?? 0) - previousVat));
      const amount = round2(remainingSubtotal + remainingVat);
      if (Math.abs(amount - progress.remaining) > 0.02) {
        return NextResponse.json({ ok: false, error: `The remaining balance for ${variation.variation_ref} could not be reconciled. Refresh the job and retry.` }, { status: 409 });
      }
      const lineItems: InvoiceLineItem[] = previousInvoices.length || previousAllocations.length
        ? [{ description: `Remaining approved additional work — ${variation.title} (${variation.variation_ref})`, quantity: 1, unit: "item", unit_price: remainingSubtotal, vat_applicable: remainingVat > 0, total: remainingSubtotal }]
        : variation.line_items.map((line) => ({ description: `${line.description} (${variation.variation_ref})`, quantity: line.quantity, unit: line.unit, unit_price: line.unit_price, vat_applicable: line.vat_applicable, total: line.total }));
      allocations.push({ variation_id: variation.id, amount, subtotal: remainingSubtotal, vat_amount: remainingVat, line_items: lineItems });
    }

    const alreadyInvoicedForMain = round2(liveInvoicesForQuote.reduce((sum, invoice) => {
      const extras = (bundle.variation_allocations ?? []).filter((allocation) => allocation.invoice_id === invoice.id).reduce((total, allocation) => total + Number(allocation.amount ?? 0), 0);
      return sum + Math.max(0, Number(invoice.total ?? 0) - (reverseCharge ? extras - (bundle.variation_allocations ?? []).filter((allocation) => allocation.invoice_id === invoice.id).reduce((total, allocation) => total + Number(allocation.vat_amount ?? 0), 0) : extras));
    }, 0));
    const mainRemaining = round2(Math.max(0, invoiceLimit - alreadyInvoicedForMain));
    if (mainRemaining <= 0.01 && allocations.length === 0) {
      return NextResponse.json(
        { ok: false, error: `The main quote value (£${invoiceLimit.toFixed(2)}) and all selected additional work have already been invoiced.` },
        { status: 400 }
      );
    }
    const main = mainRemaining > 0.01
      ? buildProportionalInvoiceLineItemsFromQuote(quote, mainRemaining, bundle.business.vat_rate, "Final balance", reverseCharge)
      : { lineItems: [] as InvoiceLineItem[], subtotal: 0, vatAmount: 0, reverseChargeVatAmount: 0, total: 0 };
    additionalWorkAllocations = allocations;
    lineItems = [...main.lineItems, ...allocations.flatMap((allocation) => allocation.line_items)];
    subtotal = round2(main.subtotal + allocations.reduce((sum, allocation) => sum + allocation.subtotal, 0));
    vatAmount = reverseCharge ? 0 : round2(main.vatAmount + allocations.reduce((sum, allocation) => sum + allocation.vat_amount, 0));
    reverseChargeVatAmount = reverseCharge ? round2(main.reverseChargeVatAmount + allocations.reduce((sum, allocation) => sum + allocation.vat_amount, 0)) : 0;
    total = round2(subtotal + vatAmount);
    notes =
      `Final balance for quote ${quote.quote_ref}.` + (allocations.length ? ` Includes approved additional work: ${allocations.map((allocation) => bundle.variations.find((variation) => variation.id === allocation.variation_id)?.variation_ref).filter(Boolean).join(", ")}.` : "") + (alreadyInvoicedForMain > 0 ? ` £${alreadyInvoicedForMain.toFixed(2)} of the main contract was previously invoiced.` : "");
    dueInDays = 14;
  } else if (invoiceType === "interim") {
    // A custom invoice can combine a main-contract stage payment with multiple
    // approved additional-work items, or contain only additional work.
    const fixedAmount = Number(body.amount ?? 0);
    const percentage = Number(body.percentage ?? 0);
    if (!Number.isFinite(fixedAmount) || fixedAmount < 0 || !Number.isFinite(percentage) || percentage < 0 || percentage >= 100 || (fixedAmount > 0 && percentage > 0)) {
      return NextResponse.json({ ok: false, error: "Enter either a valid stage amount or a percentage below 100%." }, { status: 400 });
    }
    const requestedVariationIds = Array.isArray(body.variation_ids) ? [...new Set(body.variation_ids.filter((id) => typeof id === "string"))] : [];
    const allocations: typeof additionalWorkAllocations = [];
    for (const variationId of requestedVariationIds) {
      const variation = bundle.variations.find((item) => item.id === variationId);
      if (!variation || !["Accepted", "Invoiced"].includes(variation.status)) {
        return NextResponse.json({ ok: false, error: "Only approved additional-work items on this job can be included on an invoice." }, { status: 400 });
      }
      const progress = getVariationInvoiceProgress(bundle.invoices, variation.id, Number(variation.total ?? 0), bundle.variation_allocations ?? []);
      if (progress.remaining <= 0.01) continue;
      const previousInvoices = bundle.invoices.filter((invoice) => invoice.variation_id === variation.id && invoice.status !== "Void");
      const previousAllocations = (bundle.variation_allocations ?? []).filter((allocation) => allocation.variation_id === variation.id && bundle.invoices.some((invoice) => invoice.id === allocation.invoice_id && invoice.status !== "Void"));
      const previousSubtotal = previousInvoices.reduce((sum, invoice) => sum + Number(invoice.subtotal ?? 0), 0) + previousAllocations.reduce((sum, allocation) => sum + Number(allocation.subtotal ?? 0), 0);
      const previousVat = previousInvoices.reduce((sum, invoice) => sum + Number(invoice.vat_amount ?? 0), 0) + previousAllocations.reduce((sum, allocation) => sum + Number(allocation.vat_amount ?? 0), 0);
      const remainingSubtotal = round2(Math.max(0, Number(variation.subtotal ?? 0) - previousSubtotal));
      const remainingVat = round2(Math.max(0, Number(variation.vat_amount ?? 0) - previousVat));
      const amount = round2(remainingSubtotal + remainingVat);
      if (Math.abs(amount - progress.remaining) > 0.02) {
        return NextResponse.json({ ok: false, error: `The remaining balance for ${variation.variation_ref} could not be reconciled. Refresh the job and retry.` }, { status: 409 });
      }
      const variationLineItems: InvoiceLineItem[] = previousInvoices.length || previousAllocations.length
        ? [{ description: `Remaining approved additional work — ${variation.title} (${variation.variation_ref})`, quantity: 1, unit: "item", unit_price: remainingSubtotal, vat_applicable: remainingVat > 0, total: remainingSubtotal }]
        : variation.line_items.map((line) => ({ description: `${line.description} (${variation.variation_ref})`, quantity: line.quantity, unit: line.unit, unit_price: line.unit_price, vat_applicable: line.vat_applicable, total: line.total }));
      allocations.push({ variation_id: variation.id, amount, subtotal: remainingSubtotal, vat_amount: remainingVat, line_items: variationLineItems });
    }

    const mainAmount = fixedAmount > 0
      ? round2(fixedAmount)
      : percentage > 0 && percentage < 100
        ? round2((invoiceLimit * percentage) / 100)
        : 0;
    if (mainAmount <= 0 && allocations.length === 0) {
      return NextResponse.json({ ok: false, error: "Enter a stage amount or select approved additional work to invoice." }, { status: 400 });
    }

    const alreadyInvoicedForMain = round2(liveInvoicesForQuote.reduce((sum, invoice) => {
      const extras = (bundle.variation_allocations ?? []).filter((allocation) => allocation.invoice_id === invoice.id);
      const extraTotal = extras.reduce((amount, allocation) => amount + Number(allocation.amount ?? 0), 0);
      const extraVat = extras.reduce((amount, allocation) => amount + Number(allocation.vat_amount ?? 0), 0);
      return sum + Math.max(0, Number(invoice.total ?? 0) - (reverseCharge ? extraTotal - extraVat : extraTotal));
    }, 0));
    const mainRemaining = round2(Math.max(0, invoiceLimit - alreadyInvoicedForMain));
    if (mainAmount > mainRemaining + 0.01) {
      return NextResponse.json({ ok: false, error: `That stage payment exceeds the main contract balance. £${mainRemaining.toFixed(2)} remains to invoice.` }, { status: 400 });
    }

    const main = mainAmount > 0
      ? buildProportionalInvoiceLineItemsFromQuote(quote, mainAmount, bundle.business.vat_rate, body.description?.trim() || `Progress payment — ${bundle.job.job_title}`, reverseCharge)
      : { lineItems: [] as InvoiceLineItem[], subtotal: 0, vatAmount: 0, reverseChargeVatAmount: 0, total: 0 };
    additionalWorkAllocations = allocations;
    lineItems = [...main.lineItems, ...allocations.flatMap((allocation) => allocation.line_items)];
    subtotal = round2(main.subtotal + allocations.reduce((sum, allocation) => sum + allocation.subtotal, 0));
    vatAmount = reverseCharge ? 0 : round2(main.vatAmount + allocations.reduce((sum, allocation) => sum + allocation.vat_amount, 0));
    reverseChargeVatAmount = reverseCharge ? round2(main.reverseChargeVatAmount + allocations.reduce((sum, allocation) => sum + allocation.vat_amount, 0)) : 0;
    total = round2(subtotal + vatAmount);
    notes = [
      body.description?.trim() ? `Interim invoice: ${body.description.trim()}.` : `Interim invoice for quote ${quote.quote_ref}.`,
      allocations.length ? `Includes approved additional work: ${allocations.map((allocation) => bundle.variations.find((variation) => variation.id === allocation.variation_id)?.variation_ref).filter(Boolean).join(", ")}.` : null
    ].filter(Boolean).join(" ");
    dueInDays = 7;
  } else {
    const existingStandard = liveInvoicesForQuote.find((invoice) => (invoice.invoice_type ?? "standard") === "standard");
    if (existingStandard) {
      return NextResponse.json({
        ok: true,
        message: "Invoice already exists for this quote.",
        invoice: existingStandard,
        pdf_url: existingStandard.pdf_url
      });
    }
    if (liveInvoicesForQuote.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "Invoices already exist for this quote (deposit/interim/final). Raise the final balance instead, or void the existing invoices first."
        },
        { status: 400 }
      );
    }

    lineItems = buildInvoiceLineItemsFromQuote(quote);
    subtotal = sumLineItems(lineItems);
    vatAmount = reverseCharge ? 0 : invoiceable.vatAmount;
    reverseChargeVatAmount = reverseCharge ? invoiceable.vatAmount : 0;
    total = round2(subtotal + vatAmount);
    notes = `Raised from quote ${quote.quote_ref}.`;
    dueInDays = 14;
  }

  const cis = calculateCisDeduction(lineItems, requestedCisRate);
  if (requestedCisRate > 0 && cis.labourAmount <= 0) {
    return NextResponse.json(
      { ok: false, error: "No labour amount was found. Split the quote into materials and labour before applying CIS." },
      { status: 400 }
    );
  }
  const amountDue = round2(Math.max(0, total - cis.deductionAmount));

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
      vat_treatment: requestedVatTreatment,
      reverse_charge_vat_amount: reverseChargeVatAmount,
      customer_vat_number: reverseCharge ? customerVatNumber : null,
      reverse_charge_confirmed_at: reverseCharge ? new Date().toISOString() : null,
      cis_deduction_rate: cis.rate,
      cis_labour_amount: cis.labourAmount,
      cis_deduction_amount: cis.deductionAmount,
      total,
      amount_paid: 0,
      balance_due: amountDue,
      notes,
      payment_terms: bundle.business.payment_terms
    })
    .select("*")
    .single();

  if (error || !data) {
    console.error("Invoice creation failed", {
      jobId,
      invoiceRef,
      error: error?.message ?? "No invoice returned after insert"
    });
    return NextResponse.json(
      {
        ok: false,
        error: "We couldn't create this invoice. Nothing has been saved. Please try again or contact support."
      },
      { status: 500 }
    );
  }

  const invoice = data as InvoiceRecord;
  if (additionalWorkAllocations.length > 0) {
    for (const allocation of additionalWorkAllocations) {
      const insertedAllocation = await supabase.from("invoice_variation_allocations").insert({
        business_id: bundle.business.id,
        invoice_id: invoice.id,
        variation_id: allocation.variation_id,
        amount: allocation.amount,
        subtotal: allocation.subtotal,
        vat_amount: allocation.vat_amount
      });
      if (insertedAllocation.error) {
        await supabase.from("invoices").update({ status: "Void" }).eq("id", invoice.id).eq("business_id", bundle.business.id);
        await Promise.all(additionalWorkAllocations.map((item) => updateVariationInvoiceStatus(supabase, item.variation_id)));
        return NextResponse.json({ ok: false, error: insertedAllocation.error.message.includes("exceeds the approved additional-work balance") ? "An additional-work balance changed while this invoice was being created. Refresh and retry." : "The combined final invoice could not be safely linked to all additional-work items. No active invoice was left behind." }, { status: 409 });
      }
      await updateVariationInvoiceStatus(supabase, allocation.variation_id);
    }
  }
  const artifacts = await persistInvoiceArtifacts(supabase, { ...bundle, invoices: [invoice, ...bundle.invoices] }, invoice);

  const typeLabel =
    invoiceType === "deposit"
      ? "Deposit invoice"
      : invoiceType === "final"
        ? "Final balance invoice"
        : invoiceType === "interim"
          ? "Progress invoice"
          : "Invoice";
  await createActivity(supabase, {
    business_id: bundle.business.id,
    job_id: bundle.job.id,
    customer_id: bundle.customer.id,
    quote_id: quote.id,
    invoice_id: invoice.id,
    activity_type: "invoice_created",
    message: `${typeLabel} ${invoiceRef} created for £${amountDue.toFixed(2)}${cis.deductionAmount > 0 ? ` after £${cis.deductionAmount.toFixed(2)} CIS deduction` : ""}`,
    actor_type: "user",
    actor_id: auth.session.user?.id ?? null,
    actor_name: auth.session.user?.email ?? null,
    linked_entity_type: "invoice",
    linked_entity_id: invoice.id,
    details: { invoice_ref: invoiceRef, total, amount_due: amountDue, cis_deduction_amount: cis.deductionAmount, quote_ref: quote.quote_ref, invoice_type: invoiceType }
  });

  return NextResponse.json({
    ok: true,
    message: artifacts.pdfUrl ? `${typeLabel} created and filed in documents.` : `${typeLabel} created, but PDF filing needs attention.`,
    invoice,
    pdf_url: artifacts.pdfUrl,
    warning: [provisionalWarning, artifacts.error].filter(Boolean).join(" ") || null
  });
}

function sumLineItems(items: InvoiceLineItem[]) {
  return Math.round(items.reduce((sum, item) => sum + item.total, 0) * 100) / 100;
}

