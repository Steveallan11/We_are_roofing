import type { OtherSurveyDetails, SurveyAdaptiveSections, SurveyRecord, SurveyType } from "@/lib/types";

const SURVEY_SECTION_LABELS: Record<string, string> = {
  flat_roof: "Flat Roof",
  pitched_roof: "Pitched Roof",
  fascias: "Fascias / Soffits / Gutters",
  chimney: "Chimney / Lead",
  other: "Other Survey Notes"
};

const SURVEY_FIELD_LABELS: Record<string, string> = {
  roof_style: "Roof Configuration",
  roof_style_notes: "Configuration Notes",
  tile_type: "Covering Type",
  tile_age: "Covering Age",
  tile_condition: "Covering Condition",
  tile_issues: "Covering Issues",
  pitch_angle_deg: "Pitch Angle",
  ridge_length_m: "Single Ridge Length",
  number_of_ridges: "Number Of Ridges",
  total_ridge_metres: "Total Ridge Metres",
  eaves_length_m: "Eaves Length",
  verge_length_m: "Verge Length",
  rafter_length_m: "Rafter Length",
  hip_count: "Hip Count",
  total_hip_metres: "Total Hip Metres",
  valley_count: "Valley Count",
  total_valley_metres: "Total Valley Metres",
  roof_area_estimate_m2: "Roof Area Estimate",
  roof_area_override_m2: "Roof Area Override",
  ridge_type: "Ridge Type",
  ridge_condition: "Ridge Condition",
  hip_type: "Hip Type",
  hip_condition: "Hip Condition",
  valley_type: "Valley Type",
  valley_condition: "Valley Condition",
  verge_type: "Verge Type",
  verge_condition: "Verge Condition",
  eaves_ventilation: "Eaves Ventilation",
  bird_guard_present: "Bird Guard Present",
  membrane_type: "Membrane Type",
  felt_condition: "Felt Condition",
  batten_condition: "Batten Condition",
  batten_notes: "Batten Notes",
  chimney_present: "Chimney Present",
  chimney_condition: "Chimney Condition",
  chimney_flashings_condition: "Chimney Flashings",
  chimney_flaunching_condition: "Chimney Flaunching",
  chimney_pots: "Chimney Pots",
  chimney_cowls: "Chimney Cowls",
  chimney_repointing_needed: "Chimney Repointing Needed",
  solar_panels: "Solar Panels",
  solar_panel_count: "Solar Panel Count",
  roof_windows: "Roof Windows",
  roof_window_count: "Roof Window Count",
  aerial_present: "Aerial Present",
  satellite_present: "Satellite Present",
  vents_present: "Vents Present",
  moss_level: "Moss Coverage",
  moss_treatment_recommended: "Moss Treatment Recommended",
  loft_inspected: "Loft Inspected",
  loft_daylight_visible: "Daylight Visible In Loft",
  loft_damp_patches: "Loft Damp Patches",
  loft_condensation: "Loft Condensation",
  loft_insulation_type: "Loft Insulation Type",
  loft_insulation_depth_mm: "Loft Insulation Depth",
  loft_notes: "Loft Notes",
  scaffold_type: "Scaffold Requirement",
  scaffold_elevations: "Scaffold Elevations",
  access_notes: "Access Notes",
  current_surface_type: "Current Surface Type",
  approximate_age: "Approximate Age",
  length_m: "Length",
  width_m: "Width",
  perimeter_m: "Perimeter",
  deck_condition: "Deck Condition",
  drainage_condition: "Drainage Condition",
  standing_water: "Standing Water",
  upstands_condition: "Upstands Condition",
  flashings_condition: "Flashings Condition",
  outlets_count: "Outlets Count",
  rooflights: "Rooflights",
  recommended_system: "Recommended System",
  current_material: "Current Material",
  fascia_condition: "Fascia Condition",
  soffit_condition: "Soffit Condition",
  guttering_condition: "Guttering Condition",
  downpipe_condition: "Downpipe Condition",
  colour_preference: "Colour Preference",
  front_run_m: "Front Run",
  rear_run_m: "Rear Run",
  left_run_m: "Left Run",
  right_run_m: "Right Run",
  total_linear_metres: "Total Linear Metres",
  total_linear_metres_override: "Total Linear Metres Override",
  gutter_profile: "Gutter Profile",
  cladding_details: "Cladding Details",
  chimney_count: "Chimney Count",
  gas_flue_present: "Gas Flue Present",
  parapet_or_coping: "Parapet Or Coping",
  repointing_needed: "Repointing Needed",
  lead_code: "Lead Code",
  apron_length_m: "Apron Length",
  back_gutter_length_m: "Back Gutter Length",
  step_flashing_length_m: "Step Flashing Length",
  total_measured_run_m: "Total Measured Run",
  total_measured_run_override_m: "Measured Run Override",
  height_or_access_notes: "Height Or Access Notes",
  additional_notes: "Additional Notes",
  survey_focus: "Survey Focus",
  measured_area_m2: "Measured Area",
  measured_run_m: "Measured Run",
  issue_tags: "Issue Tags",
  additional_findings: "Additional Findings"
};

function toNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function roundTwo(value: number) {
  return Math.round(value * 100) / 100;
}

export function calculatePitchedMetrics(details: SurveyAdaptiveSections["pitched_roof"]) {
  const eaves = toNumber(details?.eaves_length_m) ?? 0;
  const rafter = toNumber(details?.rafter_length_m) ?? 0;
  const ridges = toNumber(details?.number_of_ridges) ?? 1;
  const ridgeLength = toNumber(details?.ridge_length_m) ?? 0;
  const totalRidgeMetres = ridgeLength * Math.max(ridges, 0);
  const totalHipMetres = toNumber(details?.total_hip_metres) ?? 0;
  const totalValleyMetres = toNumber(details?.total_valley_metres) ?? 0;
  const vergeLength = toNumber(details?.verge_length_m) ?? 0;
  const pitchAngle = toNumber(details?.pitch_angle_deg);
  const style = details?.roof_style ?? "";
  const shapeMultiplier =
    style === "L-Shape" || style === "T-Shape" || style === "Cross-Hipped"
      ? 1.2
      : style === "Dormer" || style === "Mansard" || style === "Gambrel" || style === "Valley Roof"
        ? 1.15
        : 1;
  const pitchFactor = pitchAngle && pitchAngle > 0 ? 1 / Math.cos((pitchAngle * Math.PI) / 180) : 1;
  const calculatedArea = eaves && rafter ? roundTwo(eaves * rafter * 2 * shapeMultiplier * pitchFactor) : null;
  const finalArea = toNumber(details?.roof_area_override_m2) ?? calculatedArea;

  return {
    totalRidgeMetres: totalRidgeMetres ? roundTwo(totalRidgeMetres) : null,
    totalHipMetres: totalHipMetres ? roundTwo(totalHipMetres) : null,
    totalValleyMetres: totalValleyMetres ? roundTwo(totalValleyMetres) : null,
    totalEavesMetres: eaves ? roundTwo(eaves) : null,
    totalVergeMetres: vergeLength ? roundTwo(vergeLength) : null,
    roofAreaEstimate: finalArea
  };
}

export function calculateFlatMetrics(details: SurveyAdaptiveSections["flat_roof"]) {
  const length = toNumber(details?.length_m) ?? 0;
  const width = toNumber(details?.width_m) ?? 0;
  const perimeter = toNumber(details?.perimeter_m) ?? (length && width ? (length + width) * 2 : 0);
  const calculatedArea = length && width ? roundTwo(length * width) : null;
  const finalArea = toNumber(details?.roof_area_override_m2) ?? calculatedArea;

  return {
    roofAreaEstimate: finalArea,
    perimeterMetres: perimeter ? roundTwo(perimeter) : null
  };
}

export function calculateFasciaMetrics(details: SurveyAdaptiveSections["fascias"]) {
  const total =
    (toNumber(details?.front_run_m) ?? 0) +
    (toNumber(details?.rear_run_m) ?? 0) +
    (toNumber(details?.left_run_m) ?? 0) +
    (toNumber(details?.right_run_m) ?? 0);

  return {
    totalLinearMetres: toNumber(details?.total_linear_metres_override) ?? (total ? roundTwo(total) : null)
  };
}

export function calculateChimneyMetrics(details: SurveyAdaptiveSections["chimney"]) {
  const total =
    (toNumber(details?.apron_length_m) ?? 0) +
    (toNumber(details?.back_gutter_length_m) ?? 0) +
    (toNumber(details?.step_flashing_length_m) ?? 0);

  return {
    totalMeasuredRun: toNumber(details?.total_measured_run_override_m) ?? (total ? roundTwo(total) : null)
  };
}

export function getSurveyMeasurementsSummary(survey?: SurveyRecord | null) {
  if (!survey) return "Not captured yet";
  const adaptive = survey.adaptive_sections ?? {};
  const surveyType = survey.survey_type as SurveyType | undefined;

  if (surveyType === "Pitched / Tiled") {
    const metrics = calculatePitchedMetrics(adaptive.pitched_roof);
    const parts = [
      metrics.roofAreaEstimate ? `${metrics.roofAreaEstimate}m2 roof area` : null,
      metrics.totalRidgeMetres ? `${metrics.totalRidgeMetres}m ridge` : null,
      metrics.totalHipMetres ? `${metrics.totalHipMetres}m hips` : null,
      metrics.totalValleyMetres ? `${metrics.totalValleyMetres}m valleys` : null
    ].filter(Boolean);
    return parts.join(" | ") || survey.measurements || "Not captured yet";
  }

  if (surveyType === "Flat Roof") {
    const metrics = calculateFlatMetrics(adaptive.flat_roof);
    const parts = [
      metrics.roofAreaEstimate ? `${metrics.roofAreaEstimate}m2 area` : null,
      metrics.perimeterMetres ? `${metrics.perimeterMetres}m perimeter` : null
    ].filter(Boolean);
    return parts.join(" | ") || survey.measurements || "Not captured yet";
  }

  if (surveyType === "Fascias / Soffits / Gutters") {
    const metrics = calculateFasciaMetrics(adaptive.fascias);
    return metrics.totalLinearMetres ? `${metrics.totalLinearMetres}m total run` : survey.measurements || "Not captured yet";
  }

  if (surveyType === "Chimney / Lead") {
    const metrics = calculateChimneyMetrics(adaptive.chimney);
    return metrics.totalMeasuredRun ? `${metrics.totalMeasuredRun}m measured lead run` : survey.measurements || "Not captured yet";
  }

  return survey.measurements || "Not captured yet";
}

export function getSurveyHighlights(survey?: SurveyRecord | null) {
  if (!survey) return [];
  const adaptive = survey.adaptive_sections ?? {};
  const surveyType = survey.survey_type as SurveyType | undefined;

  if (surveyType === "Pitched / Tiled") {
    return [
      adaptive.pitched_roof?.roof_style,
      adaptive.pitched_roof?.tile_type,
      adaptive.pitched_roof?.moss_level ? `Moss: ${adaptive.pitched_roof.moss_level}` : null,
      adaptive.pitched_roof?.scaffold_type ? `Access: ${adaptive.pitched_roof.scaffold_type}` : null
    ].filter(Boolean) as string[];
  }

  if (surveyType === "Flat Roof") {
    return [
      adaptive.flat_roof?.current_surface_type,
      adaptive.flat_roof?.recommended_system,
      adaptive.flat_roof?.standing_water ? "Standing water noted" : null
    ].filter(Boolean) as string[];
  }

  if (surveyType === "Fascias / Soffits / Gutters") {
    return [
      adaptive.fascias?.current_material,
      adaptive.fascias?.gutter_profile,
      adaptive.fascias?.colour_preference
    ].filter(Boolean) as string[];
  }

  if (surveyType === "Chimney / Lead") {
    return [
      adaptive.chimney?.lead_code ? `Lead ${adaptive.chimney.lead_code}` : null,
      adaptive.chimney?.chimney_count ? `${adaptive.chimney.chimney_count} chimney(s)` : null,
      adaptive.chimney?.repointing_needed ? "Repointing needed" : null
    ].filter(Boolean) as string[];
  }

  if (surveyType === "Other / Misc") {
    return [
      (adaptive.other as OtherSurveyDetails | undefined)?.survey_focus,
      (adaptive.other as OtherSurveyDetails | undefined)?.recommended_system
    ].filter(Boolean) as string[];
  }

  return [];
}

export function getSurveySectionLabel(sectionName: string) {
  return SURVEY_SECTION_LABELS[sectionName] ?? toTitleCase(sectionName.replaceAll("_", " "));
}

export function getSurveyFieldLabel(fieldName: string) {
  return SURVEY_FIELD_LABELS[fieldName] ?? toTitleCase(fieldName.replaceAll("_", " "));
}

export function formatSurveySnapshotValue(value: unknown): string {
  if (value == null) return "";
  if (Array.isArray(value)) {
    return value.map((item) => formatSurveySnapshotValue(item)).filter(Boolean).join(", ");
  }
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "";
  }
  if (typeof value === "object") {
    return "";
  }
  return String(value).trim();
}

function toTitleCase(value: string) {
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
