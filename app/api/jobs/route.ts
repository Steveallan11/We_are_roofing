import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createJobSchema } from "@/lib/validators";
import { deleteJobWithCleanup } from "@/lib/jobs/deleteJob";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { canPersistToSupabase, ensureBusinessRecord, getNextJobRef } from "@/lib/workflows";

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = createJobSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });
  }

  if (!canPersistToSupabase()) {
    return NextResponse.json({
      ok: true,
      message: "Job payload accepted.",
      customer_id: `cust-${randomUUID()}`,
      job_id: `job-${randomUUID()}`,
      next_status: "New Lead",
      received: parsed.data
    });
  }

  const supabase = createSupabaseAdminClient();
  const business = await ensureBusinessRecord();
  const jobRef = await getNextJobRef();

  const customerPayload = parsed.data.customer;
  const jobPayload = parsed.data.job;

  const { data: selectedCustomer } = customerPayload.customer_id
    ? await supabase.from("customers").select("*").eq("business_id", business.id).eq("id", customerPayload.customer_id).maybeSingle()
    : { data: null };

  const { data: existingCustomer } = selectedCustomer
    ? { data: selectedCustomer }
    : await supabase
        .from("customers")
        .select("*")
        .eq("business_id", business.id)
        .eq("phone", customerPayload.phone)
        .limit(1)
        .maybeSingle();

  const customer =
    existingCustomer ??
    (
      await supabase
        .from("customers")
        .insert({
          business_id: business.id,
          full_name: customerPayload.full_name,
          phone: customerPayload.phone,
          email: customerPayload.email || null,
          address_line_1: customerPayload.property_address,
          town: customerPayload.town || null,
          county: customerPayload.county || null,
          postcode: customerPayload.postcode || null
        })
        .select("*")
        .single()
    ).data;

  if (!customer) {
    return NextResponse.json({ ok: false, error: "Unable to create or find customer." }, { status: 500 });
  }

  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .insert({
      business_id: business.id,
      customer_id: customer.id,
      job_ref: jobRef,
      job_title: jobPayload.job_title,
      property_address: customerPayload.property_address,
      postcode: customerPayload.postcode || null,
      job_type: jobPayload.job_type,
      roof_type: jobPayload.roof_type,
      status: "New Lead",
      urgency: jobPayload.urgency || null,
      source: customerPayload.source || null,
      internal_notes: jobPayload.internal_notes || null
    })
    .select("*")
    .single();

  if (jobError || !job) {
    return NextResponse.json({ ok: false, error: jobError?.message ?? "Unable to create job." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    message: "Job created in Supabase.",
    customer_id: customer.id,
    job_id: job.id,
    next_status: "New Lead",
    received: parsed.data,
    duplicate_customer_reused: Boolean(existingCustomer),
    customer,
    job
  });
}

export async function PATCH(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    job_id?: string;
    status?: string;
  };

  if (!body.job_id || !body.status) {
    return NextResponse.json({ ok: false, error: "job_id and status are required." }, { status: 400 });
  }

  if (!canPersistToSupabase()) {
    return NextResponse.json({ ok: true, message: "Job status updated in preview mode." });
  }

  const supabase = createSupabaseAdminClient();
  const patch: Record<string, string> = {
    status: body.status,
    updated_at: new Date().toISOString()
  };

  if (body.status === "Accepted") {
    patch.accepted_at = new Date().toISOString();
  }
  if (body.status === "Completed") {
    patch.completed_at = new Date().toISOString();
  }

  const { data, error } = await supabase.from("jobs").update(patch).eq("id", body.job_id).select("*").single();
  if (error || !data) {
    return NextResponse.json({ ok: false, error: error?.message ?? "Unable to update job status." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    message: "Job status updated.",
    job: data
  });
}

export async function DELETE(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    job_id?: string;
    confirmation?: string;
  };

  if (!body.job_id || !body.confirmation) {
    return NextResponse.json({ ok: false, error: "job_id and confirmation are required." }, { status: 400 });
  }

  if (!canPersistToSupabase()) {
    return NextResponse.json({ ok: true, message: "Job deleted in preview mode." });
  }

  const result = await deleteJobWithCleanup(createSupabaseAdminClient(), body.job_id, body.confirmation);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true, message: result.message });
}
