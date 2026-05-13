import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getLineLength, getSectionArea } from "@/lib/survey/geometry";
import type { RoofSurveyRecord } from "@/lib/survey/types";
import { canPersistToSupabase } from "@/lib/workflows";

type Props = {
  params: Promise<{ surveyId: string }>;
};

export async function POST(request: Request, { params }: Props) {
  const { surveyId } = await params;
  const body = (await request.json().catch(() => null)) as { survey?: RoofSurveyRecord } | null;
  if (!body?.survey) {
    return NextResponse.json({ ok: false, error: "survey payload is required." }, { status: 400 });
  }

  if (!canPersistToSupabase()) {
    return NextResponse.json({ ok: true, survey: { ...body.survey, id: surveyId } });
  }

  const supabase = createSupabaseAdminClient();
  const survey = body.survey;

  const { error: surveyError } = await supabase.from("roof_surveys").upsert({
    id: surveyId,
    job_id: survey.job_id,
    project_name: survey.project_name,
    scale_px_per_m: survey.scale_px_per_m,
    satellite_image_path: survey.satellite_image_path,
    notes: survey.notes,
    status: survey.status
  });

  if (surveyError) {
    return NextResponse.json({ ok: false, error: surveyError.message }, { status: 500 });
  }

  const [deleteSections, deleteLines, deleteFeatures] = await Promise.all([
    supabase.from("roof_survey_sections").delete().eq("survey_id", surveyId),
    supabase.from("roof_survey_lines").delete().eq("survey_id", surveyId),
    supabase.from("roof_survey_features").delete().eq("survey_id", surveyId)
  ]);

  if (deleteSections.error || deleteLines.error || deleteFeatures.error) {
    return NextResponse.json(
      {
        ok: false,
        error: deleteSections.error?.message ?? deleteLines.error?.message ?? deleteFeatures.error?.message ?? "Unable to replace roof survey shapes."
      },
      { status: 500 }
    );
  }

  if (survey.sections.length > 0) {
    const { error } = await supabase.from("roof_survey_sections").insert(
      survey.sections.map((section, index) => ({
        survey_id: surveyId,
        label: section.label,
        type: section.type,
        condition: section.condition,
        color: section.color,
        points: section.points,
        area_m2: getSectionArea(section, survey.scale_px_per_m),
        notes: section.notes,
        sort_order: index
      }))
    );
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
  }

  if (survey.lines.length > 0) {
    const { error } = await supabase.from("roof_survey_lines").insert(
      survey.lines.map((line, index) => ({
        survey_id: surveyId,
        label: line.label,
        type: line.type,
        color: line.color,
        points: line.points,
        length_lm: getLineLength(line, survey.scale_px_per_m),
        notes: line.notes,
        sort_order: index
      }))
    );
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
  }

  if (survey.features.length > 0) {
    const { error } = await supabase.from("roof_survey_features").insert(
      survey.features.map((feature) => ({
        survey_id: surveyId,
        label: feature.label,
        type: feature.type,
        color: feature.color,
        point: feature.point,
        notes: feature.notes
      }))
    );
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, survey: { ...survey, id: surveyId } });
}
