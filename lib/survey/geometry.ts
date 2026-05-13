import {
  FEATURE_DEFS,
  LINE_DEFS,
  type BOMItem,
  type RoofSurveyFeature,
  type RoofSurveyLine,
  type RoofSurveyRecord,
  type RoofSurveySection,
  type SurveyPoint
} from "@/lib/survey/types";

export const polyArea = (pts: SurveyPoint[]): number => {
  let area = 0;
  const count = pts.length;
  for (let index = 0; index < count; index += 1) {
    const next = (index + 1) % count;
    area += pts[index].x * pts[next].y - pts[next].x * pts[index].y;
  }
  return Math.abs(area / 2);
};

export const lineLen = (pts: SurveyPoint[]): number =>
  pts.slice(1).reduce((sum, point, index) => sum + Math.hypot(point.x - pts[index].x, point.y - pts[index].y), 0);

export const centroid = (pts: SurveyPoint[]): SurveyPoint => ({
  x: pts.reduce((sum, point) => sum + point.x, 0) / pts.length,
  y: pts.reduce((sum, point) => sum + point.y, 0) / pts.length
});

export const ptInPoly = (pt: SurveyPoint, poly: SurveyPoint[]): boolean => {
  let inside = false;
  for (let index = 0, previous = poly.length - 1; index < poly.length; previous = index++) {
    const { x: xi, y: yi } = poly[index];
    const { x: xj, y: yj } = poly[previous];
    if (((yi > pt.y) !== (yj > pt.y)) && pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
};

export const distToSeg = (pt: SurveyPoint, start: SurveyPoint, end: SurveyPoint) => {
  const length = Math.hypot(end.x - start.x, end.y - start.y);
  if (length === 0) {
    return Math.hypot(pt.x - start.x, pt.y - start.y);
  }
  const offset = ((pt.x - start.x) * (end.x - start.x) + (pt.y - start.y) * (end.y - start.y)) / (length * length);
  const clamped = Math.max(0, Math.min(1, offset));
  return Math.hypot(pt.x - (start.x + clamped * (end.x - start.x)), pt.y - (start.y + clamped * (end.y - start.y)));
};

export function getSectionArea(section: RoofSurveySection, scalePxPerM: number | null) {
  if (!scalePxPerM || section.points.length < 3) return null;
  return polyArea(section.points) / (scalePxPerM * scalePxPerM);
}

export function getLineLength(line: RoofSurveyLine, scalePxPerM: number | null) {
  if (!scalePxPerM || line.points.length < 2) return null;
  return lineLen(line.points) / scalePxPerM;
}

export function buildRoofSurveyBom(survey: RoofSurveyRecord): BOMItem[] {
  const items = new Map<string, BOMItem>();
  const add = (key: string, item: BOMItem) => {
    const existing = items.get(key);
    if (!existing) {
      items.set(key, item);
      return;
    }
    existing.qty += item.qty;
  };

  survey.sections.forEach((section) => {
    const qty = section.area_m2 ?? getSectionArea(section, survey.scale_px_per_m);
    if (!qty) return;
    add(`section:${section.type}`, {
      label: section.type || section.label || "Roof Section",
      qty,
      unit: "m²",
      color: section.color,
      source_type: "section"
    });
  });

  survey.lines.forEach((line) => {
    const qty = line.length_lm ?? getLineLength(line, survey.scale_px_per_m);
    if (!qty) return;
    const lineDef = LINE_DEFS.find((item) => item.name === line.type);
    add(`line:${line.type}`, {
      label: line.type || line.label || "Measured Run",
      qty,
      unit: "lm",
      color: line.color || lineDef?.color || "#D4AF37",
      source_type: "line"
    });
  });

  survey.features.forEach((feature) => {
    const featureDef = FEATURE_DEFS.find((item) => item.name === feature.type);
    add(`feature:${feature.type}`, {
      label: feature.type || feature.label || "Feature",
      qty: 1,
      unit: "no.",
      color: feature.color || featureDef?.color || "#D4AF37",
      source_type: "feature"
    });
  });

  return [...items.values()].sort((left, right) => left.unit.localeCompare(right.unit) || left.label.localeCompare(right.label));
}

export function getRoofSurveyTotals(survey: RoofSurveyRecord) {
  return {
    totalAreaM2: survey.sections.reduce((sum, section) => sum + (section.area_m2 ?? getSectionArea(section, survey.scale_px_per_m) ?? 0), 0),
    totalLinesLm: survey.lines.reduce((sum, line) => sum + (line.length_lm ?? getLineLength(line, survey.scale_px_per_m) ?? 0), 0),
    totalFeatures: survey.features.length
  };
}

export function toQuoteCostBreakdown(items: BOMItem[]) {
  return items.map((item) => ({
    item: item.label,
    cost: 0,
    vat_applicable: true,
    notes: `${item.qty.toFixed(item.unit === "no." ? 0 : 2)} ${item.unit} imported from roof survey`
  }));
}

export function toMaterialRows(jobId: string, quoteId: string | null, items: BOMItem[]) {
  return items.map((item) => ({
    job_id: jobId,
    quote_id: quoteId,
    item_name: item.label,
    category: item.source_type === "section" ? "Measured Area" : item.source_type === "line" ? "Measured Run" : "Roof Feature",
    quantity: Number(item.qty.toFixed(2)),
    unit: item.unit,
    required_status: "Check On Site" as const,
    notes: "Imported from roof survey BOM"
  }));
}

export function getFeatureIcon(feature: RoofSurveyFeature) {
  return FEATURE_DEFS.find((item) => item.name === feature.type)?.icon ?? "•";
}
