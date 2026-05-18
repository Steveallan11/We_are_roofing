import { NextResponse } from "next/server";
import OpenAI from "openai";
import { getJobBundle } from "@/lib/data";
import { sendEmail } from "@/lib/email/sendEmail";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { job_id?: string };
  if (!body.job_id) return NextResponse.json({ ok: false, error: "job_id is required." }, { status: 400 });

  const bundle = await getJobBundle(body.job_id);
  if (!bundle?.customer.email) return NextResponse.json({ ok: false, error: "Customer email is missing." }, { status: 400 });

  const content = await generateSurveyReport(bundle).catch(() => ({
    executiveSummary: bundle.survey?.problem_observed || "We have completed the roof survey and reviewed the visible areas.",
    conditionOverall: bundle.survey?.roof_condition || "Fair",
    findings: [{ area: bundle.job.roof_type || "Roof", condition: bundle.survey?.roof_condition || "Fair", detail: bundle.survey?.problem_observed || "Further details are in the survey notes." }],
    recommendations: [bundle.survey?.recommended_works || "We will follow up with the recommended works and quote."],
    budgetRange: "To be confirmed in the written quotation",
    urgency: "We will advise timing in the quote."
  }));

  const html = buildSurveyReportHtml(bundle.customer.full_name, bundle.job.job_ref ?? "WR-J-TBC", content);
  await sendEmail({
    to: bundle.customer.email,
    subject: `Your roof survey report - ${bundle.job.job_ref ?? bundle.job.job_title}`,
    html,
    jobId: body.job_id,
    templateType: "survey_report"
  });

  await createSupabaseAdminClient().from("jobs").update({ status: "Survey Complete", updated_at: new Date().toISOString() }).eq("id", body.job_id);

  return NextResponse.json({ ok: true, report: content });
}

async function generateSurveyReport(bundle: Awaited<ReturnType<typeof getJobBundle>>) {
  if (!bundle || !process.env.OPENAI_API_KEY) throw new Error("Missing OpenAI context.");
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You are Andy from We Are Roofing UK Ltd. Write a warm, professional, specific roof survey report email. Be honest, useful, and never pushy. Respond as JSON with executiveSummary, conditionOverall, findings, recommendations, budgetRange, urgency."
      },
      {
        role: "user",
        content: JSON.stringify({
          customer: bundle.customer.full_name,
          property: bundle.job.property_address,
          roofType: bundle.job.roof_type,
          survey: bundle.survey,
          photos: bundle.photos.length
        })
      }
    ]
  });
  return JSON.parse(response.choices[0]?.message?.content || "{}");
}

function buildSurveyReportHtml(customerName: string, jobRef: string, report: any) {
  const findings = Array.isArray(report.findings) ? report.findings : [];
  const recommendations = Array.isArray(report.recommendations) ? report.recommendations : [];
  return `
    <div style="background:#f8f7f4;padding:40px 20px;font-family:Helvetica,Arial,sans-serif">
      <div style="max-width:620px;margin:0 auto;background:white;border:1px solid #e8e4da">
        <div style="background:#0a0a0a;padding:28px 32px;color:white">
          <div style="color:#D4AF37;font-size:22px;font-weight:700;font-family:Georgia,serif">We Are Roofing UK Ltd</div>
          <div style="color:#777;font-size:11px;letter-spacing:2px;text-transform:uppercase;margin-top:4px">Survey Report ${jobRef}</div>
        </div>
        <div style="padding:32px">
          <p>Hi ${customerName.split(" ")[0] || customerName},</p>
          <div style="border-left:3px solid #D4AF37;background:#faf9f6;padding:16px;margin:18px 0;color:#333">${report.executiveSummary || ""}</div>
          <p><strong>Overall condition:</strong> ${report.conditionOverall || "Fair"}</p>
          <h3>Findings</h3>
          ${findings.map((item: any) => `<p><strong>${item.area || "Roof"} - ${item.condition || ""}</strong><br/>${item.detail || ""}</p>`).join("")}
          <h3>Recommendations</h3>
          <ul>${recommendations.map((item: string) => `<li>${item}</li>`).join("")}</ul>
          <p><strong>Indicative budget:</strong> ${report.budgetRange || "To be confirmed"}</p>
          <p><strong>Urgency:</strong> ${report.urgency || "We will advise timing in the quote."}</p>
        </div>
      </div>
    </div>
  `;
}
