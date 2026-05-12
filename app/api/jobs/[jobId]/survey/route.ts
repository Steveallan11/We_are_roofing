import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  formatSurveySnapshotValue,
  getSurveyFieldLabel,
  getSurveySectionLabel
} from "@/lib/survey-utils";
import { getStoragePublicUrl, JOB_DOCUMENTS_BUCKET, ensurePublicStorageBucket } from "@/lib/storage";
import { canPersistToSupabase } from "@/lib/workflows";

type Props = {
  params: Promise<{ jobId: string }>;
};

const CORE_KEYS = new Set([
  "surveyor_name",
  "access_notes",
  "scaffold_required",
  "scaffold_notes",
  "roof_condition",
  "problem_observed",
  "suspected_cause",
  "recommended_works",
  "measurements",
  "weather_notes",
  "safety_notes",
  "customer_concerns",
  "voice_note_transcript",
  "raw_notes",
  "survey_type",
  "roof_type",
  "no_photo_confirmation"
]);

export async function POST(request: Request, context: Props) {
  return saveSurvey(request, context);
}

export async function PUT(request: Request, context: Props) {
  return saveSurvey(request, context);
}

async function saveSurvey(request: Request, { params }: Props) {
  const { jobId } = await params;
  const body = (await request.json()) as Record<string, unknown>;

  const surveyorName = String(body.surveyor_name ?? "").trim();
  const problemObserved = String(body.problem_observed ?? "").trim();
  const recommendedWorks = String(body.recommended_works ?? "").trim();
  const surveyType = String(body.survey_type ?? "").trim();
  const roofType = String(body.roof_type ?? "").trim();

  if (!surveyorName || !problemObserved || !recommendedWorks || !surveyType || !roofType) {
    return NextResponse.json(
      { ok: false, error: "surveyor_name, problem_observed, recommended_works, survey_type and roof_type are required." },
      { status: 400 }
    );
  }

  const adaptiveSections: Record<string, Record<string, unknown>> =
    typeof body.adaptive_sections === "object" && body.adaptive_sections && !Array.isArray(body.adaptive_sections)
      ? ({ ...(body.adaptive_sections as Record<string, Record<string, unknown>>) } as Record<string, Record<string, unknown>>)
      : {};

  for (const [key, value] of Object.entries(body)) {
    if (CORE_KEYS.has(key)) continue;

    if (key.startsWith("flat_")) {
      adaptiveSections.flat_roof ??= {};
      adaptiveSections.flat_roof[key.replace(/^flat_/, "")] = value;
      continue;
    }
    if (key.startsWith("p_") || key.startsWith("pitched_")) {
      adaptiveSections.pitched_roof ??= {};
      adaptiveSections.pitched_roof[key.replace(/^p_|^pitched_/, "")] = value;
      continue;
    }
    if (key.startsWith("f_") || key.startsWith("fascia_") || key.startsWith("soffit_") || key.startsWith("guttering_") || key.startsWith("downpipe_")) {
      adaptiveSections.fascias ??= {};
      adaptiveSections.fascias[key.replace(/^f_|^fascia_|^soffit_|^guttering_|^downpipe_/, "")] = value;
      continue;
    }
    if (key.startsWith("c_") || key.startsWith("chimney_") || key.startsWith("lead_") || key.startsWith("flaunching_")) {
      adaptiveSections.chimney ??= {};
      adaptiveSections.chimney[key.replace(/^c_|^chimney_|^lead_|^flaunching_/, "")] = value;
    }
  }

  const payload = {
    job_id: jobId,
    surveyor_name: surveyorName,
    access_notes: String(body.access_notes ?? ""),
    scaffold_required: Boolean(body.scaffold_required),
    scaffold_notes: String(body.scaffold_notes ?? ""),
    roof_condition: String(body.roof_condition ?? ""),
    problem_observed: problemObserved,
    suspected_cause: String(body.suspected_cause ?? ""),
    recommended_works: recommendedWorks,
    measurements: String(body.measurements ?? ""),
    weather_notes: String(body.weather_notes ?? ""),
    safety_notes: String(body.safety_notes ?? ""),
    customer_concerns: String(body.customer_concerns ?? ""),
    voice_note_transcript: String(body.voice_note_transcript ?? ""),
    raw_notes: String(body.raw_notes ?? ""),
    survey_type: surveyType,
    roof_type: roofType,
    no_photo_confirmation: Boolean(body.no_photo_confirmation),
    adaptive_sections: adaptiveSections,
    updated_at: new Date().toISOString()
  };

  if (!canPersistToSupabase()) {
    return NextResponse.json({
      ok: true,
      jobId,
      message: "Survey payload accepted.",
      next_status: payload.no_photo_confirmation ? "Ready For AI Quote" : "Survey Complete",
      received: payload
    });
  }

  const supabase = createSupabaseAdminClient();
  const [{ data: existingSurvey }, { count: photoCount }] = await Promise.all([
    supabase.from("surveys").select("id").eq("job_id", jobId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("job_photos").select("*", { count: "exact", head: true }).eq("job_id", jobId)
  ]);

  const surveyResult = existingSurvey
    ? await supabase.from("surveys").update(payload).eq("id", existingSurvey.id).select("*").single()
    : await supabase.from("surveys").insert(payload).select("*").single();

  if (surveyResult.error || !surveyResult.data) {
    return NextResponse.json(
      { ok: false, error: surveyResult.error?.message ?? "Unable to save survey." },
      { status: 500 }
    );
  }

  await persistSurveySnapshot({
    supabase,
    jobId,
    surveyId: surveyResult.data.id,
    survey: surveyResult.data as Record<string, unknown>,
    adaptiveSections
  });

  const nextStatus = payload.no_photo_confirmation || (photoCount ?? 0) > 0 ? "Ready For AI Quote" : "Survey Complete";

  await supabase
    .from("jobs")
    .update({
      status: nextStatus,
      survey_date: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq("id", jobId);

  return NextResponse.json({
    ok: true,
    jobId,
    message: "Survey saved to Supabase.",
    next_status: nextStatus,
    survey: surveyResult.data
  });
}

async function persistSurveySnapshot({
  supabase,
  jobId,
  surveyId,
  survey,
  adaptiveSections
}: {
  supabase: ReturnType<typeof createSupabaseAdminClient>;
  jobId: string;
  surveyId: string;
  survey: Record<string, unknown>;
  adaptiveSections: Record<string, Record<string, unknown>>;
}) {
  const [{ data: job }, { data: customer }, { data: existingDocument }] = await Promise.all([
    supabase.from("jobs").select("job_title, property_address").eq("id", jobId).single(),
    supabase.from("jobs").select("customer_id").eq("id", jobId).single().then(async (jobResult) => {
      if (!jobResult.data?.customer_id) return { data: null };
      return supabase.from("customers").select("full_name").eq("id", jobResult.data.customer_id).maybeSingle();
    }),
    supabase
      .from("job_documents")
      .select("id")
      .eq("job_id", jobId)
      .eq("document_type", "survey_snapshot")
      .limit(1)
      .maybeSingle()
  ]);

  const html = buildSurveySnapshotHtml({
    customerName: String(customer?.full_name ?? "Customer"),
    propertyAddress: String(job?.property_address ?? ""),
    jobTitle: String(job?.job_title ?? "Roofing Survey"),
    survey,
    adaptiveSections
  });

  const storagePath = `${jobId}/surveys/${surveyId}/site-survey-latest.html`;
  const bucketResult = await ensurePublicStorageBucket(supabase, JOB_DOCUMENTS_BUCKET);
  const upload = bucketResult.ok
    ? await supabase.storage.from(JOB_DOCUMENTS_BUCKET).upload(storagePath, Buffer.from(html, "utf8"), {
        contentType: "text/html; charset=utf-8",
        upsert: true
      })
    : { error: { message: bucketResult.error } };

  const publicUrl = upload.error ? null : getStoragePublicUrl(supabase, JOB_DOCUMENTS_BUCKET, storagePath);
  const payload = {
    job_id: jobId,
    quote_id: null,
    document_type: "survey_snapshot",
    display_name: "Site Survey Snapshot",
    storage_bucket: publicUrl ? JOB_DOCUMENTS_BUCKET : null,
    storage_path: publicUrl ? storagePath : null,
    public_url: publicUrl,
    source_type: "generated",
    mime_type: "text/html",
    file_size: Buffer.byteLength(html, "utf8"),
    content_html: html
  };

  if (existingDocument?.id) {
    await supabase.from("job_documents").update(payload).eq("id", existingDocument.id);
  } else {
    await supabase.from("job_documents").insert(payload);
  }
}

function buildSurveySnapshotHtml({
  customerName,
  propertyAddress,
  jobTitle,
  survey,
  adaptiveSections
}: {
  customerName: string;
  propertyAddress: string;
  jobTitle: string;
  survey: Record<string, unknown>;
  adaptiveSections: Record<string, Record<string, unknown>>;
}) {
  const coreRows = [
    ["Surveyor", survey.surveyor_name],
    ["Survey Type", survey.survey_type],
    ["Roof Type", survey.roof_type],
    ["Roof Condition", survey.roof_condition],
    ["Problem Observed", survey.problem_observed],
    ["Suspected Cause", survey.suspected_cause],
    ["Recommended Works", survey.recommended_works],
    ["Measurements", survey.measurements],
    ["Access Notes", survey.access_notes],
    ["Scaffold Required", survey.scaffold_required ? "Yes" : "No"],
    ["Scaffold Notes", survey.scaffold_notes],
    ["Customer Concerns", survey.customer_concerns],
    ["Weather Notes", survey.weather_notes],
    ["Safety Notes", survey.safety_notes],
    ["Voice Notes", survey.voice_note_transcript],
    ["Other Notes", survey.raw_notes]
  ]
    .filter(([, value]) => String(value ?? "").trim().length > 0)
    .map(([label, value]) => `<div class="row"><div class="label">${escapeHtml(String(label))}</div><div class="value">${escapeHtml(String(value))}</div></div>`)
    .join("");

  const extraSections = Object.entries(adaptiveSections)
    .filter(([, fields]) => Object.keys(fields ?? {}).length > 0)
    .map(([sectionName, fields]) => {
      const rows = Object.entries(fields)
        .filter(([, value]) => formatSurveySnapshotValue(value).length > 0)
        .map(
          ([key, value]) =>
            `<div class="row"><div class="label">${escapeHtml(getSurveyFieldLabel(key))}</div><div class="value">${escapeHtml(formatSurveySnapshotValue(value))}</div></div>`
        )
        .join("");

      return `<section><h2>${escapeHtml(getSurveySectionLabel(sectionName))}</h2>${rows}</section>`;
    })
    .join("");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Site Survey Snapshot</title>
    <style>
      body { font-family: Arial, Helvetica, sans-serif; background: #f5f2e7; color: #111; padding: 32px; }
      .sheet { max-width: 900px; margin: 0 auto; background: #fff; border: 1px solid #d8c58a; border-radius: 18px; overflow: hidden; }
      .hero { background: #101417; color: #f5d060; padding: 28px 32px; }
      .hero h1 { margin: 0; font-size: 30px; }
      .hero p { margin: 8px 0 0; color: #d7c483; }
      .body { padding: 28px 32px; }
      h2 { margin: 22px 0 10px; font-size: 18px; text-transform: uppercase; color: #8b6914; }
      .row { display: grid; grid-template-columns: 220px 1fr; gap: 12px; padding: 10px 0; border-bottom: 1px solid #eee2b8; }
      .label { font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #6e5a1c; }
      .value { white-space: pre-line; line-height: 1.6; }
    </style>
  </head>
  <body>
    <div class="sheet">
      <div class="hero">
        <h1>${escapeHtml(jobTitle)}</h1>
        <p>${escapeHtml(customerName)} | ${escapeHtml(propertyAddress)}</p>
      </div>
      <div class="body">
        <section>
          <h2>Core Survey</h2>
          ${coreRows || '<p>No saved survey details yet.</p>'}
        </section>
        ${extraSections}
      </div>
    </div>
  </body>
</html>`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export async function GET(_request: Request, { params }: Props) {
  const { jobId } = await params;
  if (!canPersistToSupabase()) {
    return NextResponse.json({ ok: true, data: null });
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("surveys")
    .select("*")
    .eq("job_id", jobId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, data });
}
