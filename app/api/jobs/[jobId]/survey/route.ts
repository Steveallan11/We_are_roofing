import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
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
