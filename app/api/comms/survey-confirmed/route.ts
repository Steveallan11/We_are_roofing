import { NextResponse } from "next/server";
import { googleCalendarLink } from "@/lib/calendar/generateICS";
import { getJobBundle } from "@/lib/data";
import { surveyConfirmationEmail } from "@/lib/email/templates";
import { sendEmail } from "@/lib/email/sendEmail";
import { sendSMS, SMS_TEMPLATES } from "@/lib/sms/sendSMS";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { job_id?: string; send_email?: boolean; send_sms?: boolean };
  if (!body.job_id) return NextResponse.json({ ok: false, error: "job_id is required." }, { status: 400 });

  const bundle = await getJobBundle(body.job_id);
  if (!bundle) return NextResponse.json({ ok: false, error: "Job not found." }, { status: 404 });
  if (!bundle.job.survey_date || !bundle.job.survey_time) {
    return NextResponse.json({ ok: false, error: "Survey date and time are not set." }, { status: 400 });
  }

  const dateText = new Intl.DateTimeFormat("en-GB", { dateStyle: "full" }).format(new Date(bundle.job.survey_date));
  const booking = {
    title: bundle.job.job_title,
    date: bundle.job.survey_date,
    timeStart: bundle.job.survey_time.slice(0, 5),
    duration: Number(bundle.job.survey_duration ?? 60),
    address: bundle.job.survey_address || bundle.job.property_address,
    notes: bundle.job.survey_notes || "",
    jobRef: bundle.job.job_ref ?? "WR-J-TBC"
  };

  if (body.send_email !== false && bundle.customer.email) {
    await sendEmail({
      to: bundle.customer.email,
      subject: `Roof survey confirmed - ${booking.jobRef}`,
      html: surveyConfirmationEmail({
        customerName: bundle.customer.full_name,
        surveyDate: dateText,
        surveyTime: booking.timeStart,
        propertyAddress: booking.address,
        jobRef: booking.jobRef,
        surveyorName: "Andy",
        accessNotes: booking.notes,
        googleCalLink: googleCalendarLink(booking)
      }),
      jobId: body.job_id,
      templateType: "survey_confirmation"
    });
  }

  if (body.send_sms !== false && bundle.customer.phone) {
    await sendSMS({
      to: bundle.customer.phone,
      message: SMS_TEMPLATES.survey_confirmation(bundle.customer.full_name, dateText, booking.timeStart),
      jobId: body.job_id,
      templateType: "survey_confirmation"
    });
  }

  return NextResponse.json({ ok: true });
}
