import { NextResponse } from "next/server";
import { getJobBundle } from "@/lib/data";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { canPersistToSupabase } from "@/lib/workflows";

type Props = {
  params: Promise<{ jobId: string }>;
};

export async function PATCH(request: Request, { params }: Props) {
  const { jobId } = await params;
  const body = (await request.json().catch(() => ({}))) as { start_date?: string | null; expected_end_date?: string | null };

  if (!body.start_date) return NextResponse.json({ ok: false, error: "Start date is required." }, { status: 400 });
  if (!canPersistToSupabase()) return NextResponse.json({ ok: true });

  const bundle = await getJobBundle(jobId);
  if (!bundle) return NextResponse.json({ ok: false, error: "Job not found." }, { status: 404 });

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("jobs")
    .update({
      start_date: body.start_date,
      expected_end_date: body.expected_end_date || null,
      status: ["Accepted", "Materials Needed"].includes(bundle.job.status) ? "Booked" : bundle.job.status,
      updated_at: new Date().toISOString()
    })
    .eq("id", jobId);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  await supabase.from("bookings").insert({
    business_id: bundle.business.id,
    job_id: jobId,
    booking_type: "start",
    title: `Start works - ${bundle.job.job_title}`,
    date: body.start_date,
    address: bundle.job.property_address,
    postcode: bundle.job.postcode,
    status: "confirmed",
    confirmed_at: new Date().toISOString()
  });

  return NextResponse.json({ ok: true });
}
