import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { googleCalendarLink, type CalendarBooking } from "@/lib/calendar/generateICS";
import { surveyConfirmationEmail } from "@/lib/email/templates";
import { sendEmail } from "@/lib/email/sendEmail";
import { getJobBundle } from "@/lib/data";
import { sendSMS, SMS_TEMPLATES } from "@/lib/sms/sendSMS";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { canPersistToSupabase } from "@/lib/workflows";

type Props = {
  params: Promise<{ jobId: string }>;
};

function addMinutes(time: string, duration: number) {
  const [hour, minute] = time.split(":").map(Number);
  const date = new Date(2000, 0, 1, hour, minute + duration);
  return date.toTimeString().slice(0, 5);
}

export async function POST(request: Request, { params }: Props) {
  const { jobId } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    date?: string;
    time_start?: string;
    duration_mins?: number;
    address?: string;
    notes?: string;
    send_email?: boolean;
    send_sms?: boolean;
  };

  if (!body.date || !body.time_start) {
    return NextResponse.json({ ok: false, error: "Date and time are required." }, { status: 400 });
  }

  const duration = Number(body.duration_mins || 60);

  if (!canPersistToSupabase()) return NextResponse.json({ ok: true });

  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const bundle = await getJobBundle(jobId);
  if (!bundle) return NextResponse.json({ ok: false, error: "Job not found." }, { status: 404 });

  const address = body.address || bundle.job.property_address;
  const supabase = createSupabaseAdminClient();
  const timeEnd = addMinutes(body.time_start, duration);

  const { data: booking, error } = await supabase
    .from("bookings")
    .insert({
      business_id: bundle.business.id,
      job_id: jobId,
      booking_type: "survey",
      title: bundle.job.job_title,
      date: body.date,
      time_start: body.time_start,
      time_end: timeEnd,
      duration_mins: duration,
      address,
      postcode: bundle.job.postcode,
      notes: body.notes || null,
      status: "confirmed",
      confirmed_at: new Date().toISOString()
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  await supabase
    .from("jobs")
    .update({
      survey_date: body.date,
      survey_time: body.time_start,
      survey_duration: duration,
      survey_confirmed: true,
      survey_notes: body.notes || null,
      survey_address: address,
      status: bundle.job.status === "New Lead" ? "Survey Needed" : bundle.job.status,
      updated_at: new Date().toISOString()
    })
    .eq("id", jobId);

  const calendarBooking: CalendarBooking = {
    title: bundle.job.job_title,
    date: body.date,
    timeStart: body.time_start,
    duration,
    address,
    notes: body.notes,
    jobRef: bundle.job.job_ref ?? "WR-J-TBC"
  };

  const dateText = new Intl.DateTimeFormat("en-GB", { dateStyle: "full" }).format(new Date(body.date));
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://we-are-roofing-one.vercel.app";

  if (body.send_email && bundle.customer.email) {
    await sendEmail({
      to: bundle.customer.email,
      subject: `Roof survey confirmed - ${bundle.job.job_ref ?? bundle.job.job_title}`,
      html: surveyConfirmationEmail({
        customerName: bundle.customer.full_name,
        surveyDate: dateText,
        surveyTime: body.time_start,
        propertyAddress: address,
        jobRef: bundle.job.job_ref ?? "WR-J-TBC",
        surveyorName: "Andy",
        accessNotes: body.notes,
        googleCalLink: googleCalendarLink(calendarBooking),
        businessPhone: bundle.business.phone,
        businessEmail: bundle.business.email
      }),
      jobId,
      templateType: "survey_confirmation"
    });
  }

  if (body.send_sms && bundle.customer.phone) {
    await sendSMS({
      to: bundle.customer.phone,
      message: SMS_TEMPLATES.survey_confirmation(bundle.customer.full_name, dateText, body.time_start),
      jobId,
      templateType: "survey_confirmation"
    });
  }

  return NextResponse.json({ ok: true, booking, calendar_url: `${appUrl}/calendar` });
}
