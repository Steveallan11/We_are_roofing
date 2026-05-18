import type { RoofType, SurveyAdaptiveSections, SurveyRecord, SurveyType } from "@/lib/types";

type Analysis = Record<string, any>;

export function structureSurvey(analysis: Analysis, transcript: string): Partial<SurveyRecord> {
  const surveyType = inferSurveyType(analysis);
  const roofType = inferRoofType(analysis, surveyType);
  const adaptiveSections = buildAdaptiveSections(analysis, surveyType);
  const overallConfidence = numberOrNull(analysis.overall_confidence);

  return {
    survey_type: surveyType,
    roof_type: roofType,
    roof_condition: analysis.overall_condition || "Unknown",
    problem_observed: analysis.problems || "",
    suspected_cause: analysis.suspected_cause || "",
    recommended_works: analysis.recommendations || "",
    scaffold_required: Boolean(analysis.scaffold_required ?? true),
    scaffold_notes: analysis.scaffold_notes || "",
    safety_notes: analysis.safety_concerns || "",
    voice_note_transcript: transcript,
    raw_notes: buildRawNotes(transcript, overallConfidence, analysis.manual_review_needed),
    adaptive_sections: adaptiveSections,
    source_type: "video",
    ai_confidence: overallConfidence,
    ai_raw_response: analysis,
    processing_status: "complete",
    processing_error: null
  };
}

function inferSurveyType(analysis: Analysis): SurveyType {
  const roof = String(analysis.roof_type || "").toLowerCase();
  if (analysis.has_flat_section && !roof.includes("pitched") && !roof.includes("tile") && !roof.includes("slate")) {
    return "Flat Roof";
  }
  if (roof.includes("chimney") || roof.includes("lead")) return "Chimney / Lead";
  if (roof.includes("fascia") || roof.includes("soffit") || roof.includes("gutter")) return "Fascias / Soffits / Gutters";
  if (roof.includes("pitched") || roof.includes("tile") || roof.includes("slate")) return "Pitched / Tiled";
  return analysis.has_flat_section ? "Flat Roof" : "Other / Misc";
}

function inferRoofType(analysis: Analysis, surveyType: SurveyType): RoofType {
  const roof = String(analysis.roof_type || "").toLowerCase();
  if (surveyType === "Flat Roof") return "Flat";
  if (roof.includes("slate")) return "Slate";
  if (roof.includes("tile")) return "Tile";
  if (roof.includes("chimney")) return "Chimney";
  if (roof.includes("fascia") || roof.includes("gutter") || roof.includes("soffit")) return "Fascia";
  if (roof.includes("pitched")) return "Pitched";
  return surveyType === "Pitched / Tiled" ? "Pitched" : "Other";
}

function buildAdaptiveSections(analysis: Analysis, surveyType: SurveyType): SurveyAdaptiveSections {
  const sections = Array.isArray(analysis.sections) ? analysis.sections : [];
  const features = (analysis.features || {}) as Record<string, any>;

  if (surveyType === "Flat Roof") {
    return {
      flat_roof: {
        current_surface_type: analysis.flat_section_type || sections[0]?.material || "",
        recommended_system: firstRecommendationLine(analysis.recommendations),
        rooflights: features.skylights?.count ? `${features.skylights.count} ${features.skylights.type || "rooflights"}` : ""
      }
    };
  }

  if (surveyType === "Pitched / Tiled") {
    return {
      pitched_roof: {
        tile_type: sections[0]?.material || "",
        tile_condition: analysis.overall_condition || "",
        chimney_present: Boolean(features.chimney?.present),
        chimney_condition: features.chimney?.condition || "",
        solar_panels: Boolean(features.solar_panels),
        roof_windows: Number(features.roof_windows || features.skylights?.count || 0) > 0,
        roof_window_count: numberOrNull(features.roof_windows || features.skylights?.count),
        roof_style_notes: sections.map((section: any) => section.name).filter(Boolean).join(", ") || ""
      }
    };
  }

  if (surveyType === "Chimney / Lead") {
    return {
      chimney: {
        chimney_condition: features.chimney?.condition || analysis.overall_condition || "",
        additional_notes: analysis.problems || ""
      }
    };
  }

  if (surveyType === "Fascias / Soffits / Gutters") {
    return {
      fascias: {
        guttering_condition: features.gutters?.condition || analysis.overall_condition || "",
        cladding_details: analysis.problems || ""
      }
    };
  }

  return {
    other: {
      survey_focus: analysis.roof_type || "Video survey",
      recommended_system: firstRecommendationLine(analysis.recommendations),
      issue_tags: Array.isArray(analysis.manual_review_needed) ? analysis.manual_review_needed : [],
      additional_findings: analysis.problems || ""
    }
  };
}

function buildRawNotes(transcript: string, confidence: number | null, reviewFields: unknown) {
  const manualReview = Array.isArray(reviewFields) && reviewFields.length > 0 ? `\nReview needed: ${reviewFields.join(", ")}` : "";
  return `AI Video Analysis${confidence != null ? ` (${confidence}% confidence)` : ""}${manualReview}\n\nVoice transcript:\n${transcript}`.trim();
}

function firstRecommendationLine(value: unknown) {
  const text = String(value || "").trim();
  return text.split("\n").map((line) => line.trim()).find(Boolean) || text;
}

function numberOrNull(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}
