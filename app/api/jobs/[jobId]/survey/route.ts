import { NextResponse } from "next/server";
import { surveySchema } from "@/lib/validators";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { canPersistToSupabase } from "@/lib/workflows";

type Props = {
  params: Promise<{ jobId: string }>;
};

export async function POST(request: Request, { params }: Props) {
  const { jobId } = await params;
  const body = await request.json();
  const parsed = surveySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });
  }

  const nextStatus = parsed.data.no_photo_confirmation ? "Ready For AI Quote" : "Survey Complete";

  if (!canPersistToSupabase()) {
    return NextResponse.json({
      ok: true,
      jobId,
      message: "Survey payload accepted.",
      next_status: nextStatus,
      received: parsed.data
    });
  }

  const supabase = createSupabaseAdminClient();
  const { data: existingSurvey } = await supabase
    .from("surveys")
    .select("*")
    .eq("job_id", jobId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const surveyPayload = {
    job_id: jobId,
    surveyor_name: parsed.data.surveyor_name,
    access_notes: parsed.data.access_notes,
    scaffold_required: parsed.data.scaffold_required,
    scaffold_notes: parsed.data.scaffold_notes,
    roof_condition: parsed.data.roof_condition,
    problem_observed: parsed.data.problem_observed,
    suspected_cause: parsed.data.suspected_cause,
    recommended_works: parsed.data.recommended_works,
    measurements: parsed.data.measurements,
    weather_notes: parsed.data.weather_notes,
    safety_notes: parsed.data.safety_notes,
    customer_concerns: parsed.data.customer_concerns,
    voice_note_transcript: parsed.data.voice_note_transcript,
    raw_notes: parsed.data.raw_notes,
    survey_type: parsed.data.survey_type,
    roof_type: parsed.data.roof_type,
    no_photo_confirmation: parsed.data.no_photo_confirmation,
    adaptive_sections: parsed.data.adaptive_sections,
    updated_at: new Date().toISOString()
  };

  const surveyResult = existingSurvey
    ? await supabase.from("surveys").update(surveyPayload).eq("id", existingSurvey.id).select("*").single()
    : await supabase.from("surveys").insert(surveyPayload).select("*").single();

  if (surveyResult.error || !surveyResult.data) {
    return NextResponse.json(
      { ok: false, error: surveyResult.error?.message ?? "Unable to save survey." },
      { status: 500 }
    );
  }

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
