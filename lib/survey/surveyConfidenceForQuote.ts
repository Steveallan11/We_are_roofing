import type { GeneratedQuote, SurveyRecord } from "@/lib/types";

/** Overall survey AI confidence below this (0–100) forces Needs Review. */
export const SURVEY_OVERALL_CONFIDENCE_THRESHOLD = 70;

/** Per-field survey confidence below this (0–100) is treated as uncertain. */
export const SURVEY_FIELD_CONFIDENCE_THRESHOLD = 60;

export type SurveyConfidenceSource = Pick<
  SurveyRecord,
  | "ai_confidence"
  | "ai_field_confidence"
  | "ai_review_items"
  | "ai_raw_response"
  | "processing_status"
  | "processing_error"
>;

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

function normalizeConfidenceScore(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  // Some model outputs use 0–1 fractions; survey storage uses percent.
  if (value > 0 && value <= 1) return value * 100;
  return value;
}

function humanizeField(field: string): string {
  return field.replace(/_/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Map survey AI uncertainty into quote missing_info reasons.
 * Empty array means the survey does not force extra review on its own.
 */
export function buildSurveyMissingInfo(survey: SurveyConfidenceSource | null | undefined): string[] {
  if (!survey) return [];

  const reasons: string[] = [];

  if (survey.processing_status === "failed") {
    reasons.push(
      `Survey processing failed${survey.processing_error ? `: ${survey.processing_error}` : ""}`.trim()
    );
  }

  if (survey.processing_status === "pending" || survey.processing_status === "processing") {
    reasons.push("Survey AI processing is not complete yet");
  }

  const raw = (survey.ai_raw_response ?? {}) as Record<string, unknown>;

  if (raw.is_roof_survey === false) {
    const detail =
      (typeof raw.not_roof_reason === "string" && raw.not_roof_reason.trim()) ||
      (typeof raw.visual_summary === "string" && raw.visual_summary.trim()) ||
      "uploaded video does not look like a usable roofing survey";
    reasons.push(`Survey flagged as not a roof survey (${detail})`);
  }

  const overall = normalizeConfidenceScore(survey.ai_confidence);
  if (overall != null && overall < SURVEY_OVERALL_CONFIDENCE_THRESHOLD) {
    reasons.push(
      `Survey overall confidence is ${Math.round(overall)}% (below ${SURVEY_OVERALL_CONFIDENCE_THRESHOLD}%)`
    );
  }

  const fieldConfidence = survey.ai_field_confidence ?? {};
  for (const [field, score] of Object.entries(fieldConfidence)) {
    const normalized = normalizeConfidenceScore(score);
    if (normalized == null) continue;
    if (normalized < SURVEY_FIELD_CONFIDENCE_THRESHOLD) {
      reasons.push(
        `Survey field uncertain: ${humanizeField(field)} (${Math.round(normalized)}% confidence)`
      );
    }
  }

  const manualReview = raw.manual_review_needed;
  if (Array.isArray(manualReview)) {
    for (const field of manualReview) {
      if (typeof field === "string" && field.trim()) {
        reasons.push(`Survey marked for manual review: ${humanizeField(field.trim())}`);
      }
    }
  }

  const reviewItems = Array.isArray(survey.ai_review_items) ? survey.ai_review_items : [];
  for (const item of reviewItems) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const field = typeof row.field === "string" ? row.field : "field";
    const reason =
      typeof row.reason === "string" && row.reason.trim()
        ? row.reason.trim()
        : "needs human review";
    const evidence =
      typeof row.evidence === "string" && row.evidence.trim()
        ? ` Evidence: ${row.evidence.trim()}`
        : "";
    reasons.push(`Survey review: ${humanizeField(field)} — ${reason}${evidence}`);
  }

  return uniqueStrings(reasons);
}

export function surveyForcesNeedsReview(survey: SurveyConfidenceSource | null | undefined): boolean {
  return buildSurveyMissingInfo(survey).length > 0;
}

/**
 * Merge survey uncertainty into the generated quote so deriveQuoteStatus
 * returns Needs Review (Low confidence and/or non-empty missing_info).
 * High-confidence clean surveys leave the quote unchanged.
 */
export function applySurveyConfidenceToQuote(
  quote: GeneratedQuote,
  survey: SurveyConfidenceSource | null | undefined
): GeneratedQuote {
  const surveyMissing = buildSurveyMissingInfo(survey);
  if (surveyMissing.length === 0) return quote;

  return {
    ...quote,
    missing_info: uniqueStrings([...(quote.missing_info ?? []), ...surveyMissing]),
    confidence: "Low"
  };
}
