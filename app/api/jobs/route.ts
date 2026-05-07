import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createJobSchema } from "@/lib/validators";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { canPersistToSupabase, ensureBusinessRecord } from "@/lib/workflows";

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

  const customerPayload = parsed.data.customer;
  const jobPayload = parsed.data.job;

  const { data: existingCustomer } = await supabase
    .from("customers")
    .select("*")
    .eq("business_id", business.id)
    .eq("full_name", customerPayload.full_name)
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
    customer,
    job
  });
}
