import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { createActivity } from "@/lib/activity/createActivity";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { ActivityType } from "@/lib/activity/types";
import type { InvoiceStatus } from "@/lib/types";
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
  };

  if (!body.status || !allowedStatuses.includes(body.status)) {
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

  const paidAmount = body.status === "Paid" ? Number(body.amount_paid ?? invoice.total ?? 0) : Number(invoice.amount_paid ?? 0);
  const balanceDue = Math.max(0, Number(invoice.total ?? 0) - paidAmount);
  const payload = {
    status: body.status,
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

  return NextResponse.json({
    ok: true,
    message: `Invoice marked ${body.status}.`,
    invoice: update.data
  });
}
