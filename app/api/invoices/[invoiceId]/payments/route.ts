import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { createActivity } from "@/lib/activity/createActivity";
import { getJobBundle } from "@/lib/data";
import { persistInvoiceArtifacts } from "@/lib/invoice-engine";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { InvoiceRecord } from "@/lib/types";
import { canPersistToSupabase } from "@/lib/workflows";

type Props = {
  params: Promise<{ invoiceId: string }>;
};

export async function GET(_request: Request, { params }: Props) {
  const { invoiceId } = await params;
  if (!canPersistToSupabase()) return NextResponse.json({ ok: true, payments: [] });

  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("invoice_payments")
    .select("*")
    .eq("invoice_id", invoiceId)
    .order("paid_at", { ascending: false });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, payments: data ?? [] });
}

export async function POST(request: Request, { params }: Props) {
  const { invoiceId } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    amount?: number;
    payment_method?: string;
    payment_reference?: string;
    paid_at?: string;
    notes?: string;
  };

  const amount = Number(body.amount ?? 0);
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ ok: false, error: "Payment amount must be greater than zero." }, { status: 400 });
  }

  if (!canPersistToSupabase()) return NextResponse.json({ ok: true, message: "Payment recorded in preview mode." });

  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const supabase = createSupabaseAdminClient();
  const { data: invoice, error } = await supabase.from("invoices").select("*").eq("id", invoiceId).single();
  if (error || !invoice) {
    return NextResponse.json({ ok: false, error: error?.message ?? "Invoice not found." }, { status: 404 });
  }
  if (invoice.status === "Void") {
    return NextResponse.json({ ok: false, error: "This invoice has been voided." }, { status: 400 });
  }

  const total = Number(invoice.total ?? 0);
  const alreadyPaid = Number(invoice.amount_paid ?? 0);
  const rounded = Math.round(amount * 100) / 100;
  if (alreadyPaid + rounded > total + 0.01) {
    return NextResponse.json(
      { ok: false, error: `Payment would exceed the invoice total. Balance due is £${(total - alreadyPaid).toFixed(2)}.` },
      { status: 400 }
    );
  }

  const paidAt = body.paid_at ? new Date(body.paid_at).toISOString() : new Date().toISOString();
  const paymentInsert = await supabase
    .from("invoice_payments")
    .insert({
      invoice_id: invoiceId,
      amount: rounded,
      payment_method: body.payment_method?.trim() || "Bank Transfer",
      payment_reference: body.payment_reference?.trim() || null,
      paid_at: paidAt,
      notes: body.notes?.trim() || null
    })
    .select("*")
    .single();

  if (paymentInsert.error || !paymentInsert.data) {
    return NextResponse.json({ ok: false, error: paymentInsert.error?.message ?? "Unable to record payment." }, { status: 500 });
  }

  const newPaid = Math.round((alreadyPaid + rounded) * 100) / 100;
  const balanceDue = Math.max(0, Math.round((total - newPaid) * 100) / 100);
  const fullyPaid = balanceDue <= 0;

  const update = await supabase
    .from("invoices")
    .update({
      amount_paid: newPaid,
      balance_due: balanceDue,
      status: fullyPaid ? "Paid" : "Part Paid",
      paid_at: fullyPaid ? paidAt : invoice.paid_at,
      updated_at: new Date().toISOString()
    })
    .eq("id", invoiceId)
    .select("*")
    .single();

  if (update.error || !update.data) {
    return NextResponse.json({ ok: false, error: update.error?.message ?? "Payment saved but invoice could not be updated." }, { status: 500 });
  }

  await createActivity(supabase, {
    business_id: invoice.business_id ? String(invoice.business_id) : null,
    job_id: invoice.job_id ? String(invoice.job_id) : null,
    invoice_id: invoiceId,
    activity_type: "payment_received",
    message: `Payment received: £${rounded.toFixed(2)} for ${invoice.invoice_ref}${fullyPaid ? " (paid in full)" : ""}`,
    actor_type: "user",
    actor_id: auth.session.user?.id ?? null,
    actor_name: auth.session.user?.email ?? null,
    linked_entity_type: "invoice",
    linked_entity_id: invoiceId,
    details: {
      amount: rounded,
      payment_method: body.payment_method ?? null,
      payment_reference: body.payment_reference ?? null,
      balance_due: balanceDue
    }
  });

  const updatedInvoice = update.data as InvoiceRecord;
  const bundle = await getJobBundle(updatedInvoice.job_id);
  let pdfUrl = updatedInvoice.pdf_url ?? null;
  if (bundle) {
    const artifacts = await persistInvoiceArtifacts(supabase, { ...bundle, invoices: [updatedInvoice, ...bundle.invoices] }, updatedInvoice);
    pdfUrl = artifacts.pdfUrl ?? pdfUrl;
  }

  return NextResponse.json({
    ok: true,
    message: fullyPaid ? "Payment recorded — invoice paid in full." : `Payment recorded. £${balanceDue.toFixed(2)} still outstanding.`,
    invoice: { ...updatedInvoice, pdf_url: pdfUrl },
    payment: paymentInsert.data
  });
}
