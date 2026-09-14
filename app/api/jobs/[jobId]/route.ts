import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { createActivity } from "@/lib/activity/createActivity";
import { getJobBundle } from "@/lib/data";
import { calculateQuoteInvoiceableTotals, round2, sumLiveInvoiceTotal } from "@/lib/invoice-engine";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { canPersistToSupabase } from "@/lib/workflows";

type Props = {
  params: Promise<{ jobId: string }>;
};

export async function PATCH(request: Request, { params }: Props) {
  const { jobId } = await params;
  const body = (await request.json().catch(() => ({}))) as { job_title?: unknown; status?: unknown };

  if (body.status === "Completed") {
    return completeJob(jobId);
  }

  const jobTitle = String(body.job_title || "").trim();

  if (!jobTitle) {
    return NextResponse.json({ ok: false, error: "Job title is required." }, { status: 400 });
  }

  if (jobTitle.length > 160) {
    return NextResponse.json({ ok: false, error: "Job title must be 160 characters or fewer." }, { status: 400 });
  }

  if (!canPersistToSupabase()) {
    return NextResponse.json({ ok: true, message: "Job title updated in preview mode." });
  }

  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("jobs")
    .update({
      job_title: jobTitle,
      updated_at: new Date().toISOString()
    })
    .eq("id", jobId)
    .select("*")
    .single();

  if (error || !data) {
    return NextResponse.json({ ok: false, error: error?.message ?? "Unable to update job title." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    message: "Job title updated.",
    job: data
  });
}

async function completeJob(jobId: string) {
  if (!canPersistToSupabase()) {
    return NextResponse.json({ ok: true, message: "Job completion checked in preview mode." });
  }

  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const bundle = await getJobBundle(jobId);
  if (!bundle) return NextResponse.json({ ok: false, error: "Job not found." }, { status: 404 });
  if (bundle.job.status === "Completed") {
    return NextResponse.json({ ok: true, message: "This job is already complete.", job: bundle.job });
  }
  if (!bundle.quote) return NextResponse.json({ ok: false, error: "An accepted quote is required before completing the job." }, { status: 400 });
  const acceptedStatuses = ["Accepted", "Materials Needed", "Materials Ordered", "Scaffold In Situ", "Booked", "In Progress", "Completed"];
  if (bundle.quote.status !== "Accepted" && !acceptedStatuses.includes(bundle.job.status)) {
    return NextResponse.json({ ok: false, error: "The customer must accept the quote before this job can be completed." }, { status: 400 });
  }

  const quoteTotals = calculateQuoteInvoiceableTotals(bundle.quote, bundle.business.vat_rate);
  const approvedVariationTotal = bundle.variations
    .filter((variation) => ["Accepted", "Invoiced", "Paid"].includes(variation.status))
    .reduce((sum, variation) => sum + Number(variation.total ?? 0), 0);
  const contractTotal = round2(quoteTotals.total + approvedVariationTotal);
  const liveInvoices = bundle.invoices.filter((invoice) => invoice.status !== "Void");
  const reverseCharge = liveInvoices.length > 0 && liveInvoices.every((invoice) => invoice.vat_treatment === "domestic_reverse_charge");
  const approvedVariationNet = bundle.variations
    .filter((variation) => ["Accepted", "Invoiced", "Paid"].includes(variation.status))
    .reduce((sum, variation) => sum + Number(variation.subtotal ?? 0), 0);
  const payableContractTotal = reverseCharge ? round2(quoteTotals.subtotal + approvedVariationNet) : contractTotal;
  const invoiced = sumLiveInvoiceTotal(liveInvoices);
  const outstanding = round2(liveInvoices.reduce((sum, invoice) => sum + Number(invoice.balance_due ?? 0), 0));

  if (invoiced < payableContractTotal - 0.01) {
    return NextResponse.json(
      { ok: false, error: `Raise the remaining invoices before completing this job. £${(payableContractTotal - invoiced).toFixed(2)} has not been invoiced.` },
      { status: 400 }
    );
  }
  if (outstanding > 0.01) {
    return NextResponse.json(
      { ok: false, error: `Record the remaining payments before completing this job. £${outstanding.toFixed(2)} is still outstanding.` },
      { status: 400 }
    );
  }

  const completedAt = new Date().toISOString();
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("jobs")
    .update({
      status: "Completed",
      completed_at: completedAt,
      actual_end_date: completedAt.slice(0, 10),
      final_value: payableContractTotal,
      updated_at: completedAt
    })
    .eq("id", jobId)
    .select("*")
    .single();

  if (error || !data) {
    return NextResponse.json({ ok: false, error: error?.message ?? "Unable to complete this job." }, { status: 500 });
  }

  await createActivity(supabase, {
    business_id: bundle.business.id,
    job_id: bundle.job.id,
    customer_id: bundle.customer.id,
    quote_id: bundle.quote.id,
    activity_type: "job_completed",
    message: `Job completed with a final paid value of £${payableContractTotal.toFixed(2)}`,
    actor_type: "user",
    actor_id: auth.session.user?.id ?? null,
    actor_name: auth.session.user?.email ?? null,
    linked_entity_type: "job",
    linked_entity_id: bundle.job.id,
    details: { contract_total: contractTotal, payable_total: payableContractTotal, vat_treatment: reverseCharge ? "domestic_reverse_charge" : "standard", invoiced, outstanding: 0 }
  });

  return NextResponse.json({ ok: true, message: "Job completed. The guarantee certificate and handover email are ready.", job: data });
}
