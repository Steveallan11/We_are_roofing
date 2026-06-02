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
  const firstName = opts.toName.split(" ")[0] || "there";
  return `<!DOCTYPE html><html><body style="font-family:Helvetica Neue,Arial,sans-serif;background:#f8f7f4;margin:0;padding:0;">
<div style="max-width:560px;margin:0 auto;padding:32px 16px;">
  <div style="background:#0a0a0a;padding:24px 32px;border-radius:8px 8px 0 0;">
    <div style="color:#D4AF37;font-size:18px;font-weight:700;font-family:Georgia,serif;">We Are Roofing UK Ltd</div>
    <div style="color:#777;font-size:10px;letter-spacing:3px;text-transform:uppercase;margin-top:4px;">Roof Takeoff Survey</div>
  </div>
  <div style="background:#fff;border:1px solid #e8e4da;border-top:none;padding:28px 32px;">
    <p style="font-size:14px;color:#1a1a1a;margin:0 0 16px;">Hi ${firstName},</p>
    ${opts.message ? `<p style="font-size:13px;color:#555;line-height:1.6;margin:0 0 20px;">${opts.message}</p>` : ""}
    <div style="background:#faf9f6;border:1px solid #e8e4da;border-left:3px solid #D4AF37;border-radius:0 6px 6px 0;padding:14px 18px;margin:0 0 20px;">
      <div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:2px;margin:0 0 6px;">Survey Details</div>
      <div style="font-size:14px;font-weight:700;color:#0a0a0a;">${opts.jobRef}</div>
      <div style="font-size:12px;color:#555;margin-top:4px;">${opts.address}</div>
    </div>
    <div style="display:flex;gap:16px;margin:0 0 20px;">
      <div style="flex:1;background:#0a0a0a;padding:14px 16px;border-radius:6px;"><div style="color:#D4AF37;font-size:9px;letter-spacing:2px;text-transform:uppercase;">Total Area</div><div style="color:#fff;font-size:20px;font-weight:700;margin-top:4px;">${opts.totalArea.toFixed(1)} m2</div></div>
      <div style="flex:1;background:#0a0a0a;padding:14px 16px;border-radius:6px;"><div style="color:#D4AF37;font-size:9px;letter-spacing:2px;text-transform:uppercase;">Linear Runs</div><div style="color:#fff;font-size:20px;font-weight:700;margin-top:4px;">${opts.totalLength.toFixed(1)} lm</div></div>
    </div>
    <p style="font-size:12px;color:#555;margin:0;">Attached: ${[opts.includeKml ? "KML file" : "", opts.includeCsv ? "CSV measurements" : ""].filter(Boolean).join(" + ")}.</p>
    <p style="font-size:11px;color:#888;margin:20px 0 0;">Any questions, please call Andy on 01252 000000.</p>
  </div>
</div></body></html>`;
}
