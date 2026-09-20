import type { GeneratedQuote, SurveyRecord } from "@/lib/types";

/**
 * Thresholds for piping survey AI confidence into quote Needs Review.
 *
 * Survey vision stores overall/field confidence on a 0–100 scale
 * (see process-video: overall_confidence < 20 → review-only job).
 * Quote generation uses a higher bar so uncertain-but-usable surveys
 * still land in Needs Review with concrete missing_info reasons.
 *
 * Manual surveys with no AI confidence fields do NOT force Needs Review.
 */
export const SURVEY_OVERALL_CONFIDENCE_MIN = 60;
export const SURVEY_FIELD_CONFIDENCE_MIN = 50;

export type SurveyConfidenceSource = Pick<
  SurveyRecord,
  "ai_confidence" | "ai_field_confidence" | "ai_review_items" | "ai_raw_response"
> | null | undefined;

export type SurveyConfidenceReviewResult = {
  /** True when survey uncertainty should force quote status Needs Review. */
  forceNeedsReview: boolean;
  /** Concrete reasons to merge into quote.missing_info (does not wipe model reasons). */
  missing_info: string[];
};

/**
 * Map survey confidence fields → missing_info strings + forceNeedsReview.
 *
 * Forces Needs Review when ANY of:
 * - overall ai_confidence is present and below SURVEY_OVERALL_CONFIDENCE_MIN
 * - any ai_field_confidence value is below SURVEY_FIELD_CONFIDENCE_MIN
 * - manual_review_needed is a non-empty list (from ai_raw_response)
 * - ai_review_items is a non-empty list
 *
 * High-confidence clean surveys (overall ≥ 60, fields ≥ 50, no review flags)
 * return forceNeedsReview: false and an empty missing_info list.
 */
export function mapSurveyConfidenceToQuoteReview(
  survey: SurveyConfidenceSource
): SurveyConfidenceReviewResult {
  if (!survey) {
    return { forceNeedsReview: false, missing_info: [] };
  }

  const reasons: string[] = [];
  let forceNeedsReview = false;

  const overall = normaliseConfidencePercent(survey.ai_confidence);
  const fieldConfidence = survey.ai_field_confidence ?? {};
  const fieldEntries = Object.entries(fieldConfidence).filter(([, value]) => Number.isFinite(Number(value)));
  const reviewItems = Array.isArray(survey.ai_review_items) ? survey.ai_review_items : [];
  const manualReviewNeeded = readManualReviewNeeded(survey.ai_raw_response);

  const hasConfidenceSignal =
    overall != null ||
    fieldEntries.length > 0 ||
    reviewItems.length > 0 ||
    manualReviewNeeded.length > 0;

  // Manual / non-AI surveys: do not invent Needs Review.
  if (!hasConfidenceSignal) {
    return { forceNeedsReview: false, missing_info: [] };
  }

  if (overall != null && overall < SURVEY_OVERALL_CONFIDENCE_MIN) {
    forceNeedsReview = true;
    reasons.push(
      `Survey overall confidence ${formatPercent(overall)} is below ${SURVEY_OVERALL_CONFIDENCE_MIN}% — quote needs review`
    );
  }

  for (const [field, rawValue] of fieldEntries) {
    const percent = normaliseConfidencePercent(rawValue);
    if (percent == null || percent >= SURVEY_FIELD_CONFIDENCE_MIN) continue;
    forceNeedsReview = true;
    reasons.push(
      `Survey field "${humaniseField(field)}" confidence ${formatPercent(percent)} is below ${SURVEY_FIELD_CONFIDENCE_MIN}%`
    );
  }

  for (const field of manualReviewNeeded) {
    forceNeedsReview = true;
    reasons.push(`Survey flagged "${humaniseField(field)}" for manual review`);
  }

  for (const item of reviewItems) {
    const review = (item ?? {}) as Record<string, unknown>;
    const field = String(review.field || "field").trim() || "field";
    const reason = String(review.reason || "Needs human check").trim() || "Needs human check";
    const itemConfidence = normaliseConfidencePercent(review.confidence);

    forceNeedsReview = true;
    const confidenceSuffix =
      itemConfidence != null ? ` (${formatPercent(itemConfidence)} confidence)` : "";
    reasons.push(`Survey review: ${humaniseField(field)} — ${reason}${confidenceSuffix}`);
  }

  return {
    forceNeedsReview,
    missing_info: dedupeMissingInfo(reasons)
  };
}

/** Merge survey reasons into model-produced missing_info without wiping either side. */
export function mergeQuoteMissingInfo(existing: string[] | null | undefined, surveyReasons: string[]): string[] {
  return dedupeMissingInfo([...(existing ?? []), ...surveyReasons]);
}

/**
 * Apply survey confidence outcome onto a generated quote:
 * - merge missing_info
 * - lower confidence to Low when survey forces Needs Review
 */
export function applySurveyConfidenceToQuote(
  quote: GeneratedQuote,
  survey: SurveyConfidenceSource
): GeneratedQuote {
  const surveyReview = mapSurveyConfidenceToQuoteReview(survey);
  if (!surveyReview.forceNeedsReview && surveyReview.missing_info.length === 0) {
    return quote;
  }

  return {
    ...quote,
    missing_info: mergeQuoteMissingInfo(quote.missing_info, surveyReview.missing_info),
    confidence: surveyReview.forceNeedsReview ? "Low" : quote.confidence
  };
}

function readManualReviewNeeded(raw: Record<string, unknown> | null | undefined): string[] {
  if (!raw || typeof raw !== "object") return [];
  const value = raw.manual_review_needed;
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean);
  }
  if (typeof value === "string" && value.trim()) {
    return [value.trim()];
  }
  if (value === true) {
    return ["survey"];
  }
  return [];
}

/** Accept 0–1 fractions or 0–100 percentages; return 0–100 or null. */
function normaliseConfidencePercent(value: unknown): number | null {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return null;
  if (numeric <= 1) return Math.round(numeric * 1000) / 10; // e.g. 0.65 → 65
  return Math.round(numeric * 10) / 10;
}

function formatPercent(value: number) {
  return Number.isInteger(value) ? `${value}%` : `${value}%`;
}

function humaniseField(field: string) {
  return field
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function dedupeMissingInfo(items: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of items) {
    const cleaned = String(item || "").trim();
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(cleaned);
  }
  return result;
}
