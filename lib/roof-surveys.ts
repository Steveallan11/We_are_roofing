import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { SURVEY_IMAGES_BUCKET } from "@/lib/storage";
import type { RoofSurveyRecord } from "@/lib/survey/types";

function canUseSupabase() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
      process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

function createEmptySurvey(jobId: string, projectName?: string): RoofSurveyRecord {
  return {
    job_id: jobId,
    project_name: projectName ?? "New Roof Survey",
    scale_px_per_m: null,
    satellite_image_path: null,
    satellite_image_url: null,
    notes: "",
    status: "draft",
    sections: [],
    lines: [],
    features: []
  };
}

export async function getLatestRoofSurvey(jobId: string, projectName?: string): Promise<RoofSurveyRecord | null> {
  if (!canUseSupabase()) {
    return createEmptySurvey(jobId, projectName);
  }

  const supabase = createSupabaseAdminClient();
  const { data } = await supabase.from("roof_surveys").select("*").eq("job_id", jobId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!data) {
    return null;
  }
  return hydrateRoofSurvey(data.id);
}

export async function createRoofSurvey(jobId: string, projectName?: string): Promise<RoofSurveyRecord> {
  if (!canUseSupabase()) {
    return {
      ...createEmptySurvey(jobId, projectName),
      id: "draft-roof-survey"
    };
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("roof_surveys")
    .insert({
      job_id: jobId,
      project_name: projectName ?? "New Roof Survey",
      status: "draft"
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Unable to create a roof survey.");
  }

  return hydrateRoofSurvey(data.id);
}

export async function getOrCreateRoofSurvey(jobId: string, projectName?: string) {
  const existing = await getLatestRoofSurvey(jobId, projectName);
  if (existing) return existing;
  return createRoofSurvey(jobId, projectName);
}

export async function hydrateRoofSurvey(surveyId: string): Promise<RoofSurveyRecord> {
  if (!canUseSupabase()) {
    return {
      ...createEmptySurvey("preview-job", "Preview Roof Survey"),
      id: surveyId
    };
  }

  const supabase = createSupabaseAdminClient();
  const [surveyResult, sectionsResult, linesResult, featuresResult] = await Promise.all([
    supabase.from("roof_surveys").select("*").eq("id", surveyId).single(),
    supabase.from("roof_survey_sections").select("*").eq("survey_id", surveyId).order("sort_order", { ascending: true }),
    supabase.from("roof_survey_lines").select("*").eq("survey_id", surveyId).order("sort_order", { ascending: true }),
    supabase.from("roof_survey_features").select("*").eq("survey_id", surveyId).order("created_at", { ascending: true })
  ]);

  if (surveyResult.error || !surveyResult.data) {
    throw new Error(surveyResult.error?.message ?? "Unable to load the roof survey.");
  }

  let satelliteImageUrl: string | null = null;
  if (surveyResult.data.satellite_image_path) {
    const signed = await supabase.storage.from(SURVEY_IMAGES_BUCKET).createSignedUrl(surveyResult.data.satellite_image_path, 60 * 60 * 12);
    satelliteImageUrl = signed.data?.signedUrl ?? null;
  }

  return {
    id: surveyResult.data.id,
    job_id: surveyResult.data.job_id,
    project_name: surveyResult.data.project_name ?? "Roof Survey",
    scale_px_per_m: surveyResult.data.scale_px_per_m ?? null,
    satellite_image_path: surveyResult.data.satellite_image_path ?? null,
    satellite_image_url: satelliteImageUrl,
    notes: surveyResult.data.notes ?? "",
    status: surveyResult.data.status === "complete" ? "complete" : "draft",
    sections: (sectionsResult.data ?? []).map((section) => ({
      id: section.id,
      label: section.label ?? "Section",
      type: section.type ?? "Other",
      condition: section.condition ?? "Fair",
      color: section.color ?? "#D4AF37",
      points: Array.isArray(section.points) ? section.points : [],
      area_m2: section.area_m2 ?? null,
      notes: section.notes ?? ""
    })),
    lines: (linesResult.data ?? []).map((line) => ({
      id: line.id,
      label: line.label ?? line.type ?? "Line",
      type: line.type ?? "Other",
      color: line.color ?? "#D4AF37",
      points: Array.isArray(line.points) ? line.points : [],
      length_lm: line.length_lm ?? null,
      notes: line.notes ?? ""
    })),
    features: (featuresResult.data ?? []).map((feature) => ({
      id: feature.id,
      label: feature.label ?? feature.type ?? "Feature",
      type: feature.type ?? "Other",
      color: feature.color ?? "#D4AF37",
      point: feature.point && typeof feature.point === "object" ? feature.point : { x: 0, y: 0 },
      notes: feature.notes ?? ""
    }))
  };
}
