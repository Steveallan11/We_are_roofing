import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const BUSINESS_ID = "6f9a6dca-a747-4a20-ab87-111808577cc7";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { customer_name, customer_phone, customer_email, property_address, postcode, job_title, job_type, roof_type, source, survey_date, survey_time, notes } = body;

    if (!customer_name || !property_address || !job_title) {
      return NextResponse.json({ ok: false, error: "Name, address, and job title are required" }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();

    // Create customer
    const nameParts = customer_name.trim().split(" ");
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(" ") || null;

    const { data: customer, error: custErr } = await supabase
      .from("customers")
      .insert({
        business_id: BUSINESS_ID,
        first_name: firstName,
        last_name: lastName,
        full_name: customer_name.trim(),
        phone: customer_phone || null,
        email: customer_email || null,
        address_line_1: property_address,
        postcode: postcode || null,
      })
      .select()
      .single();

    if (custErr) {
      console.error("Customer creation error:", custErr);
      return NextResponse.json({ ok: false, error: custErr.message }, { status: 500 });
    }

    // Build survey date if provided
    let surveyDateStr = null;
    if (survey_date) {
      surveyDateStr = survey_time ? `${survey_date}T${survey_time}:00` : `${survey_date}T09:00:00`;
    }

    // Create job
    const { data: job, error: jobErr } = await supabase
      .from("jobs")
      .insert({
        business_id: BUSINESS_ID,
        customer_id: customer.id,
        job_title: job_title.trim(),
        property_address: property_address.trim(),
        postcode: postcode || null,
        job_type: job_type || "Replacement",
        roof_type: roof_type || "Flat",
        status: surveyDateStr ? "Survey Needed" : "New Lead",
        source: source || null,
        survey_date: surveyDateStr,
        internal_notes: notes || null,
      })
      .select()
      .single();

    if (jobErr) {
      console.error("Job creation error:", jobErr);
      return NextResponse.json({ ok: false, error: jobErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, customer, job }, { status: 201 });
  } catch (err) {
    console.error("Lead creation error:", err);
    return NextResponse.json({ ok: false, error: "Failed to create lead" }, { status: 500 });
  }
}
