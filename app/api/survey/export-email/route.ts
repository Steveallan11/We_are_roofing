import { EmailShell, EmailIntro, ProjectSummaryCard, ContactPanel, greeting } from "@/lib/email/components";
import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { sendEmail } from "@/lib/email/sendEmail";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { buildCsv } from "@/lib/survey/csvExporter";
import { buildKml } from "@/lib/survey/kmlExporter";
import { getLineLength, getSectionArea } from "@/lib/survey/geometry";
import { hydrateRoofSurvey } from "@/lib/roof-surveys";

type ExportEmailBody = {
  surveyId?: string;
  toEmail?: string;
  toName?: string;
  includeKml?: boolean;
  includeCsv?: boolean;
  kmlString?: string;
  csvString?: string;
  message?: string;
};

export async function POST(request: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => null)) as ExportEmailBody | null;
  if (!body?.surveyId || !body.toEmail) {
    return NextResponse.json({ ok: false, error: "surveyId and toEmail are required." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const survey = await hydrateRoofSurvey(body.surveyId);
  const { data: job } = await supabase.from("jobs").select("id, job_ref, property_address, customers(full_name, email)").eq("id", survey.job_id).single();

  if (!job) {
    return NextResponse.json({ ok: false, error: "Survey job not found." }, { status: 404 });
  }

  const customer = Array.isArray(job.customers) ? job.customers[0] : job.customers;
  const jobRef = job.job_ref || "WR-J-TBC";
  const address = job.property_address || "";
  const customerName = body.toName || customer?.full_name || "there";
  const surveyDate = new Date(survey.created_at || Date.now()).toLocaleDateString("en-GB");
  const sections = survey.sections.map((section) => ({ ...section, area_m2: section.area_m2 ?? getSectionArea(section, survey.scale_px_per_m) }));
  const lines = survey.lines.map((line) => ({ ...line, length_lm: line.length_lm ?? getLineLength(line, survey.scale_px_per_m) }));

  const kmlString =
    body.includeKml === false
      ? null
      : body.kmlString ||
        buildKml({
          projectName: survey.project_name,
          jobRef,
          address,
          sections,
          lines,
          bounds: survey.bounds,
          canvasWidth: getMaxDimension(sections, lines, "x"),
          canvasHeight: getMaxDimension(sections, lines, "y"),
          scalePxPerM: survey.scale_px_per_m,
          surveyDate
        });

  const csvString =
    body.includeCsv === false
      ? null
      : body.csvString ||
        buildCsv({
          projectName: survey.project_name,
          jobRef,
          address,
          sections,
          lines,
          surveyDate
        });

  const attachments = [
    kmlString
      ? {
          filename: `${jobRef}-roof-survey.kml`,
          content: Buffer.from(kmlString).toString("base64"),
          contentType: "application/vnd.google-earth.kml+xml"
        }
      : null,
    csvString
      ? {
          filename: `${jobRef}-measurements.csv`,
          content: Buffer.from(`\uFEFF${csvString}`).toString("base64"),
          contentType: "text/csv"
        }
      : null
  ].filter(Boolean);

  const totalArea = sections.reduce((sum, section) => sum + (section.area_m2 || 0), 0);
  const totalLength = lines.reduce((sum, line) => sum + (line.length_lm || 0), 0);

  const emailResult = await sendEmail({
    to: body.toEmail,
    subject: `Roof takeoff survey - ${jobRef} - ${address}`,
    html: buildEmailHtml({
      toName: customerName,
      message: body.message,
      jobRef,
      address,
      totalArea,
      totalLength,
      includeKml: Boolean(kmlString),
      includeCsv: Boolean(csvString)
    }),
    text: `${body.message || "Please find the roof takeoff survey attached."}\n\nJob: ${jobRef}\nAddress: ${address}`,
    attachments: attachments as never,
    jobId: job.id,
    templateType: "takeoff_export"
  });

  return NextResponse.json({ ok: true, messageId: emailResult.id });
}

function getMaxDimension(sections: Array<{ points: Array<{ x?: number; y?: number; lat?: number; lng?: number }> }>, lines: Array<{ points: Array<{ x?: number; y?: number; lat?: number; lng?: number }> }>, key: "x" | "y") {
  const values = [...sections.flatMap((section) => section.points), ...lines.flatMap((line) => line.points)].map((point) => point[key] ?? 0);
  return Math.max(1000, ...values);
}

function buildEmailHtml(opts: { toName: string; message?: string; jobRef: string; address: string; totalArea: number; totalLength: number; includeKml: boolean; includeCsv: boolean }) {
  return EmailShell("Roof takeoff survey", "Your roof measurements",
    greeting(opts.toName) + EmailIntro(opts.message || "Please find your roof measurement files attached.") +
    ProjectSummaryCard([["Reference",opts.jobRef],["Property",opts.address],["Measured area",opts.totalArea > 0 ? opts.totalArea.toFixed(1) + " m2" : null],["Linear measurements",opts.totalLength > 0 ? opts.totalLength.toFixed(1) + " lm" : null]]) +
    EmailIntro("Attached: " + [opts.includeKml ? "KML file" : "", opts.includeCsv ? "CSV measurements" : ""].filter(Boolean).join(" and ")) + ContactPanel());
}
