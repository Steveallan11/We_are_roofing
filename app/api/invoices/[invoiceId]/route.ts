import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
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

  if (body.status === "Paid" && paidAmount > Number(invoice.amount_paid ?? 0)) {
    await supabase.from("invoice_payments").insert({
      invoice_id: invoiceId,
      amount: paidAmount - Number(invoice.amount_paid ?? 0),
      payment_method: body.payment_method ?? "Manual",
      payment_reference: body.payment_reference ?? null
    });
  }

  return NextResponse.json({
    ok: true,
    message: `Invoice marked ${body.status}.`,
    invoice: update.data
  });
}
