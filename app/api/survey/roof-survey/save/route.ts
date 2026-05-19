import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { canPersistToSupabase } from "@/lib/workflows";

type SaveShape = {
  id: string;
  label: string;
  type: string;
  color: string;
  condition?: string;
  area_m2?: number | null;
  length_lm?: number | null;
  notes?: string | null;
  points: Array<{ lat: number; lng: number }>;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { surveyId?: string; jobId?: string; sections?: SaveShape[]; lines?: SaveShape[] } | null;
  if (!body?.surveyId) {
    return NextResponse.json({ saved: false, error: "surveyId is required." }, { status: 400 });
  }

  const sections = body.sections ?? [];
  const lines = body.lines ?? [];
  const totalArea = sections.reduce((sum, section) => sum + (section.area_m2 || 0), 0);
  const totalLength = lines.reduce((sum, line) => sum + (line.length_lm || 0), 0);

  if (!canPersistToSupabase()) {
    return NextResponse.json({ saved: true, totalArea, totalLength });
  }

  const supabase = createSupabaseAdminClient();
  const [deleteSections, deleteLines] = await Promise.all([
    supabase.from("roof_survey_sections").delete().eq("survey_id", body.surveyId),
    supabase.from("roof_survey_lines").delete().eq("survey_id", body.surveyId)
  ]);

  if (deleteSections.error || deleteLines.error) {
    return NextResponse.json({ saved: false, error: deleteSections.error?.message ?? deleteLines.error?.message }, { status: 500 });
  }

  if (sections.length > 0) {
    const { error } = await supabase.from("roof_survey_sections").insert(
      sections.map((section, index) => ({
        id: section.id,
        survey_id: body.surveyId,
        label: section.label,
        type: section.type,
        condition: section.condition || "Fair",
        color: section.color,
        points: section.points,
        area_m2: section.area_m2 ?? null,
        notes: section.notes || "",
        sort_order: index
      }))
    );
    if (error) return NextResponse.json({ saved: false, error: error.message }, { status: 500 });
  }

  if (lines.length > 0) {
    const { error } = await supabase.from("roof_survey_lines").insert(
      lines.map((line, index) => ({
        id: line.id,
        survey_id: body.surveyId,
        label: line.label,
        type: line.type,
        color: line.color,
        points: line.points,
        length_lm: line.length_lm ?? null,
        notes: line.notes || "",
        sort_order: index
      }))
    );
    if (error) return NextResponse.json({ saved: false, error: error.message }, { status: 500 });
  }

  const firstPoint = sections[0]?.points?.[0] ?? lines[0]?.points?.[0] ?? null;
  const { error: surveyError } = await supabase
    .from("roof_surveys")
    .update({
      status: "complete",
      scale_px_per_m: null,
      bounds: firstPoint ? { center: firstPoint, source: "google_maps" } : null
    })
    .eq("id", body.surveyId);

  if (surveyError && !/bounds|schema cache/i.test(surveyError.message)) {
    return NextResponse.json({ saved: false, error: surveyError.message }, { status: 500 });
  }

  return NextResponse.json({ saved: true, totalArea, totalLength });
}
