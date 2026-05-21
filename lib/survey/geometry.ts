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
  if (pts.every(isGeoPoint)) return sphericalPolygonArea(pts);
  let area = 0;
  const count = pts.length;
  for (let index = 0; index < count; index += 1) {
    const next = (index + 1) % count;
    area += (pts[index].x ?? 0) * (pts[next].y ?? 0) - (pts[next].x ?? 0) * (pts[index].y ?? 0);
  }
  return Math.abs(area / 2);
};

export const lineLen = (pts: SurveyPoint[]): number =>
  pts.every(isGeoPoint)
    ? sphericalLineLength(pts)
    : pts.slice(1).reduce((sum, point, index) => sum + Math.hypot((point.x ?? 0) - (pts[index].x ?? 0), (point.y ?? 0) - (pts[index].y ?? 0)), 0);

export const centroid = (pts: SurveyPoint[]): SurveyPoint => ({
  x: pts.reduce((sum, point) => sum + (point.x ?? 0), 0) / pts.length,
  y: pts.reduce((sum, point) => sum + (point.y ?? 0), 0) / pts.length
});

export const ptInPoly = (pt: SurveyPoint, poly: SurveyPoint[]): boolean => {
  let inside = false;
  for (let index = 0, previous = poly.length - 1; index < poly.length; previous = index++) {
    const xi = poly[index].x ?? 0;
    const yi = poly[index].y ?? 0;
    const xj = poly[previous].x ?? 0;
    const yj = poly[previous].y ?? 0;
    const px = pt.x ?? 0;
    const py = pt.y ?? 0;
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
};

export const distToSeg = (pt: SurveyPoint, start: SurveyPoint, end: SurveyPoint) => {
  const px = pt.x ?? 0;
  const py = pt.y ?? 0;
  const sx = start.x ?? 0;
  const sy = start.y ?? 0;
  const ex = end.x ?? 0;
  const ey = end.y ?? 0;
  const length = Math.hypot(ex - sx, ey - sy);
  if (length === 0) {
    return Math.hypot(px - sx, py - sy);
  }
  const offset = ((px - sx) * (ex - sx) + (py - sy) * (ey - sy)) / (length * length);
  const clamped = Math.max(0, Math.min(1, offset));
  return Math.hypot(px - (sx + clamped * (ex - sx)), py - (sy + clamped * (ey - sy)));
};

export function getSectionArea(section: RoofSurveySection, scalePxPerM: number | null) {
  if (section.points.every(isGeoPoint) && section.points.length >= 3) return polyArea(section.points);
  if (!scalePxPerM || section.points.length < 3) return null;
  return polyArea(section.points) / (scalePxPerM * scalePxPerM);
}

export function getLineLength(line: RoofSurveyLine, scalePxPerM: number | null) {
  if (line.points.every(isGeoPoint) && line.points.length >= 2) return lineLen(line.points);
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
    const sourceLabel = section.label || section.type || "Roof Section";
    add(`section:${section.id ?? section.label}:${section.type}`, {
      source_id: section.id,
      label: measurementLabel(section.label, section.type || "Roof Section"),
      source_label: sourceLabel,
      measurement_label: formatMeasurement(qty, "m²"),
      quote_section: sourceLabel,
      pricing_category: section.type || "Roof Section",
      qty,
      unit: "m²",
      color: section.color,
      source_type: "section",
      source_notes: section.notes
    });
  });

  survey.lines.forEach((line) => {
    const qty = line.length_lm ?? getLineLength(line, survey.scale_px_per_m);
    if (!qty) return;
    const lineDef = LINE_DEFS.find((item) => item.name === line.type);
    const sourceLabel = line.label || line.type || "Measured Run";
    add(`line:${line.id ?? line.label}:${line.type}`, {
      source_id: line.id,
      label: measurementLabel(line.label, line.type || "Measured Run"),
      source_label: sourceLabel,
      measurement_label: formatMeasurement(qty, "lm"),
      quote_section: sourceLabel,
      pricing_category: line.type || "Measured Run",
      qty,
      unit: "lm",
      color: line.color || lineDef?.color || "#D4AF37",
      source_type: "line",
      source_notes: line.notes
    });
  });

  survey.features.forEach((feature) => {
    const featureDef = FEATURE_DEFS.find((item) => item.name === feature.type);
    const sourceLabel = feature.label || feature.type || "Feature";
    add(`feature:${feature.id ?? feature.label}:${feature.type}`, {
      source_id: feature.id,
      label: measurementLabel(feature.label, feature.type || "Feature"),
      source_label: sourceLabel,
      measurement_label: "1 no.",
      quote_section: sourceLabel,
      pricing_category: feature.type || "Feature",
      qty: 1,
      unit: "no.",
      color: feature.color || featureDef?.color || "#D4AF37",
      source_type: "feature",
      source_notes: feature.notes
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
    notes: [
      `Takeoff measurement: ${item.measurement_label}`,
      `Drawing item: ${item.source_label}`,
      item.source_notes ? `Andy notes: ${item.source_notes}` : null
    ]
      .filter(Boolean)
      .join("\n"),
    quantity: Number(item.qty.toFixed(item.unit === "no." ? 0 : 2)),
    unit: item.unit,
    unit_rate: 0,
    pricing_source: "roof_survey_takeoff",
    pricing_category: item.pricing_category,
    quote_section: item.quote_section,
    measurement_label: item.measurement_label,
    source_id: item.source_id,
    source_type: item.source_type,
    source_label: item.source_label,
    source_color: item.color,
    takeoff_notes: item.source_notes ?? ""
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
    notes: ["Imported from roof survey BOM", item.measurement_label, item.source_notes].filter(Boolean).join(" - ")
  }));
}

function measurementLabel(label: string | null | undefined, type: string) {
  const cleanLabel = (label || "").trim();
  const cleanType = (type || "").trim();
  if (!cleanLabel) return cleanType;
  if (!cleanType || cleanLabel.toLowerCase().includes(cleanType.toLowerCase())) return cleanLabel;
  return `${cleanLabel} - ${cleanType}`;
}

function formatMeasurement(qty: number, unit: BOMItem["unit"]) {
  return `${qty.toFixed(unit === "no." ? 0 : 2)} ${unit}`;
}

export function getFeatureIcon(feature: RoofSurveyFeature) {
  return FEATURE_DEFS.find((item) => item.name === feature.type)?.icon ?? "*";
}

function isGeoPoint(point: SurveyPoint) {
  return typeof point.lat === "number" && typeof point.lng === "number";
}

function toRad(value: number) {
  return (value * Math.PI) / 180;
}

function haversine(left: SurveyPoint, right: SurveyPoint) {
  const radius = 6371008.8;
  const lat1 = toRad(left.lat ?? 0);
  const lat2 = toRad(right.lat ?? 0);
  const dLat = lat2 - lat1;
  const dLng = toRad((right.lng ?? 0) - (left.lng ?? 0));
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * radius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function sphericalLineLength(points: SurveyPoint[]) {
  return points.slice(1).reduce((sum, point, index) => sum + haversine(points[index], point), 0);
}

function sphericalPolygonArea(points: SurveyPoint[]) {
  if (points.length < 3) return 0;
  const origin = points[0];
  let area = 0;
  for (let index = 1; index < points.length - 1; index += 1) {
    const a = haversine(origin, points[index]);
    const b = haversine(points[index], points[index + 1]);
    const c = haversine(points[index + 1], origin);
    const semi = (a + b + c) / 2;
    area += Math.sqrt(Math.max(0, semi * (semi - a) * (semi - b) * (semi - c)));
  }
  return area;
}
