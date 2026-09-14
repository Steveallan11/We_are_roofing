import { EmailShell, EmailIntro, EmailSection, ProjectSummaryCard, Checklist, ContactPanel, greeting } from "@/lib/email/components";
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { requireAdminApi } from "@/lib/auth";
import { getJobBundle } from "@/lib/data";
import { sendEmail } from "@/lib/email/sendEmail";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

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
  return EmailShell("Roof survey report", "Your roofing assessment",
    greeting(customerName) + EmailIntro(report.executiveSummary || "") +
    ProjectSummaryCard([["Reference", jobRef], ["Overall condition", report.conditionOverall]]) +
    EmailSection("Findings", findings.map((item: any) => EmailSection(item.area || "Roof", EmailIntro(item.detail || ""))).join("")) +
    EmailSection("Recommendations", Checklist(recommendations)) +
    ProjectSummaryCard([["Indicative budget",report.budgetRange],["Timing",report.urgency]], "Next steps") + ContactPanel());
}
