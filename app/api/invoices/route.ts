import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { getInvoiceDocumentBundle } from "@/lib/data";
import { persistInvoiceArtifacts } from "@/lib/invoice-engine";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getNextInvoiceRef } from "@/lib/workflows";
import { canPersistToSupabase } from "@/lib/workflows";
import type { InvoiceLineItem, InvoiceRecord } from "@/lib/types";

type BespokeLineInput = { description?: unknown; quantity?: unknown; unit?: unknown; unit_price?: unknown; vat_applicable?: unknown };

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    customer_id?: string;
    job_id?: string | null;
    issue_date?: string;
    due_date?: string;
    payment_terms?: string;
    notes?: string;
    line_items?: BespokeLineInput[];
  } | null;

  if (!body?.customer_id || !Array.isArray(body.line_items) || body.line_items.length === 0 || body.line_items.length > 30) {
    return NextResponse.json({ ok: false, error: "Choose a customer and add between 1 and 30 invoice items." }, { status: 400 });
  }
  const issueDate = body.issue_date || new Date().toISOString().slice(0, 10);
  const dueDate = body.due_date || issueDate;
  if (!isDate(issueDate) || !isDate(dueDate) || dueDate < issueDate) {
    return NextResponse.json({ ok: false, error: "Enter valid invoice and due dates. The due date cannot be before the invoice date." }, { status: 400 });
  }

  const lineItems: InvoiceLineItem[] = [];
  for (const item of body.line_items) {
    const description = String(item.description ?? "").trim();
    const quantity = Number(item.quantity);
    const unitPrice = Number(item.unit_price);
    if (!description || description.length > 500 || !Number.isFinite(quantity) || quantity <= 0 || quantity > 1_000_000 || !Number.isFinite(unitPrice) || unitPrice < 0 || unitPrice > 10_000_000) {
      return NextResponse.json({ ok: false, error: "Each item needs a description, a positive quantity and a valid non-negative price." }, { status: 400 });
    }
    const total = round2(quantity * unitPrice);
    lineItems.push({ description, quantity, unit: String(item.unit ?? "item").trim().slice(0, 32) || "item", unit_price: round2(unitPrice), total, vat_applicable: item.vat_applicable !== false });
  }

  if (!canPersistToSupabase()) return NextResponse.json({ ok: true, message: "Bespoke invoice draft preview completed." });
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const supabase = createSupabaseAdminClient();
  const [{ data: business, error: businessError }, { data: customer, error: customerError }] = await Promise.all([
    supabase.from("businesses").select("*").limit(1).single(),
    supabase.from("customers").select("*").eq("id", body.customer_id).single()
  ]);
  if (businessError || !business) return NextResponse.json({ ok: false, error: "Business workspace could not be loaded." }, { status: 500 });
  if (customerError || !customer || customer.business_id !== business.id) return NextResponse.json({ ok: false, error: "Customer not found in this workspace." }, { status: 404 });

  let job: { id: string; customer_id: string; business_id: string } | null = null;
  if (body.job_id) {
    const { data, error } = await supabase.from("jobs").select("id,customer_id,business_id").eq("id", body.job_id).eq("business_id", business.id).maybeSingle();
    if (error || !data) return NextResponse.json({ ok: false, error: "Linked job not found in this workspace." }, { status: 404 });
    if (data.customer_id !== customer.id) return NextResponse.json({ ok: false, error: "The optional job must belong to the selected customer." }, { status: 400 });
    job = data;
  }

  const subtotal = round2(lineItems.reduce((sum, item) => sum + item.total, 0));
  const vatRate = Math.max(0, Number(business.vat_rate ?? 0));
  const vatAmount = round2(lineItems.filter((item) => item.vat_applicable).reduce((sum, item) => sum + item.total * vatRate / 100, 0));
  const total = round2(subtotal + vatAmount);
  if (total <= 0) return NextResponse.json({ ok: false, error: "Invoice total must be greater than £0." }, { status: 400 });

  const { data: invoiceData, error } = await supabase.from("invoices").insert({
    business_id: business.id,
    job_id: job?.id ?? null,
    customer_id: customer.id,
    invoice_ref: await getNextInvoiceRef(),
    status: "Draft",
    invoice_type: "standard",
    issue_date: issueDate,
    invoice_date: issueDate,
    tax_point_date: issueDate,
    due_date: dueDate,
    line_items: lineItems,
    subtotal,
    vat_amount: vatAmount,
    total,
    amount_paid: 0,
    balance_due: total,
    currency: "GBP",
    payment_terms: cleanText(body.payment_terms, 1000) || business.payment_terms || "Payment due on receipt.",
    notes: cleanText(body.notes, 5000) || null
  }).select("*").single();
  if (error || !invoiceData) return NextResponse.json({ ok: false, error: error?.message ?? "Invoice draft could not be created." }, { status: 500 });

  const invoice = invoiceData as InvoiceRecord;
  const bundle = await getInvoiceDocumentBundle(invoice);
  if (!bundle) {
    await supabase.from("invoices").delete().eq("id", invoice.id).eq("status", "Draft");
    return NextResponse.json({ ok: false, error: "Invoice customer details could not be loaded. No draft was kept." }, { status: 500 });
  }
  const artifacts = await persistInvoiceArtifacts(supabase, bundle, invoice);
  return NextResponse.json({ ok: true, message: "Bespoke invoice saved as a draft.", invoice, pdf_url: artifacts.pdfUrl, warning: artifacts.error });
}

function round2(value: number) { return Math.round((value + Number.EPSILON) * 100) / 100; }
function isDate(value: string) { return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)); }
function cleanText(value: unknown, maxLength: number) { return typeof value === "string" ? value.trim().slice(0, maxLength) : ""; }
