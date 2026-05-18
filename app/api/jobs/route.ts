import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createJobSchema } from "@/lib/validators";
import { deleteJobWithCleanup } from "@/lib/jobs/deleteJob";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { canPersistToSupabase, ensureBusinessRecord, getNextJobRef } from "@/lib/workflows";

const BUSINESS_ID = process.env.NEXT_PUBLIC_BUSINESS_ID || "6f9a6dca-a747-4a20-ab87-111808577cc7";
const VALID_JOB_STATUSES = [
  "New Lead",
  "Survey Needed",
  "Survey Complete",
  "Ready For AI Quote",
  "Quote Drafted",
  "Ready To Send",
  "Quote Sent",
  "Follow-Up Needed",
  "Accepted",
  "Materials Needed",
  "Materials Ordered",
  "Scaffold In Situ",
  "Booked",
  "In Progress",
  "Completed",
  "Not Proceeding",
  "Lost",
  "Archived"
] as const;

function splitPersonName(fullName: string) {
  const trimmed = fullName.trim();
  if (!trimmed) {
    return { firstName: null, lastName: null };
  }

  const parts = trimmed.split(/\s+/);
  return {
    firstName: parts[0] ?? null,
    lastName: parts.length > 1 ? parts.slice(1).join(" ") : null
  };
}

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
  const businessId = process.env.NEXT_PUBLIC_BUSINESS_ID || BUSINESS_ID || business.id;

  const customerPayload = parsed.data.customer;
  const jobPayload = parsed.data.job;
  const isBusinessCustomer = customerPayload.customer_type === "business";
  const fullName = customerPayload.full_name.trim();
  const displayName = isBusinessCustomer ? customerPayload.business_name.trim() : fullName || "Unknown";
  const { firstName, lastName } = splitPersonName(fullName);
  const jobTitle = jobPayload.job_title.trim() || `${jobPayload.roof_type} ${jobPayload.job_type}`.trim() || "Untitled Job";
  const propertyAddress = customerPayload.property_address.trim() || "Address to confirm";

  const { data: selectedCustomer } = customerPayload.customer_id
    ? await supabase.from("customers").select("*").eq("business_id", businessId).eq("id", customerPayload.customer_id).maybeSingle()
    : { data: null };

  const { data: possibleCustomers } = selectedCustomer
    ? { data: [selectedCustomer] }
    : await supabase
        .from("customers")
        .select("*")
        .eq("business_id", businessId)
        .eq("customer_type", customerPayload.customer_type)
        .eq("full_name", displayName)
        .limit(10);

  const existingCustomer =
    (possibleCustomers ?? []).find((customer) => {
      const sameAddress = (customer.address_line_1 ?? "").trim() === propertyAddress;
      const samePhone = (customer.phone ?? "").trim() === customerPayload.phone.trim();
      const sameBusinessName = (customer.business_name ?? "").trim() === (customerPayload.business_name ?? "").trim();
      const sameContactName = (customer.contact_person_name ?? "").trim() === (customerPayload.contact_person_name ?? "").trim();

      return isBusinessCustomer
        ? sameAddress && sameBusinessName && (samePhone || sameContactName)
        : sameAddress && samePhone;
    }) ?? null;

  let customer = existingCustomer ?? null;
  if (!customer) {
    const { data: createdCustomer, error: customerError } = await supabase
      .from("customers")
      .insert({
        business_id: businessId,
        customer_type: customerPayload.customer_type,
        first_name: isBusinessCustomer ? null : firstName,
        last_name: isBusinessCustomer ? null : lastName,
        full_name: displayName,
        business_name: isBusinessCustomer ? customerPayload.business_name.trim() : null,
        phone: customerPayload.phone || null,
        email: customerPayload.email || null,
        contact_person_name: isBusinessCustomer ? customerPayload.contact_person_name || null : null,
        contact_person_phone: isBusinessCustomer ? customerPayload.contact_person_phone || null : null,
        contact_person_email: isBusinessCustomer ? customerPayload.contact_person_email || null : null,
        address_line_1: propertyAddress,
        town: customerPayload.town || null,
        county: customerPayload.county || null,
        postcode: customerPayload.postcode?.toUpperCase() || null
      })
      .select("*")
      .single();

    if (customerError) {
      return NextResponse.json({ ok: false, error: `Failed to create customer: ${customerError.message}` }, { status: 500 });
    }
    customer = createdCustomer;
  }

  if (!customer) {
    return NextResponse.json({ ok: false, error: "Unable to create or find customer." }, { status: 500 });
  }

  const jobInsertBase = {
    business_id: businessId,
    customer_id: customer.id,
    job_title: jobTitle,
    property_address: propertyAddress,
    postcode: customerPayload.postcode?.toUpperCase() || null,
    job_type: jobPayload.job_type,
    roof_type: jobPayload.roof_type,
    status: "New Lead" as const,
    urgency: jobPayload.urgency || "Medium",
    source: customerPayload.source || null,
    internal_notes: jobPayload.internal_notes || null
  };

  let job: Record<string, unknown> | null = null;
  let jobError: { message?: string; details?: string | null } | null = null;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const jobRef = await getNextJobRef();
    const result = await supabase
      .from("jobs")
      .insert({
        ...jobInsertBase,
        job_ref: jobRef
      })
      .select("*")
      .single();

    job = (result.data as Record<string, unknown> | null) ?? null;
    jobError = result.error ? { message: result.error.message, details: result.error.details } : null;

    if (job) {
      break;
    }

    const errorText = `${result.error?.message ?? ""} ${result.error?.details ?? ""}`;
    if (/jobs_business_job_ref_idx|duplicate key value violates unique constraint/i.test(errorText)) {
      continue;
    }

    break;
  }

  if (jobError || !job) {
    return NextResponse.json({ ok: false, error: jobError?.message ?? "Unable to create job." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    message: "Job created in Supabase.",
    customer_id: customer.id,
    job_id: String(job.id),
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

  if (!VALID_JOB_STATUSES.includes(body.status as (typeof VALID_JOB_STATUSES)[number])) {
    return NextResponse.json({ ok: false, error: "Invalid job status." }, { status: 400 });
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
