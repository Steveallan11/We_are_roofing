"use client";

import type { RoofSurveyRecord, SurveyPoint } from "@/lib/survey/types";

type Props = {
  selectedSourceId?: string | null;
  survey: RoofSurveyRecord | null;
};

const WIDTH = 720;
const HEIGHT = 420;
const PAD = 36;

export function TakeoffQuotePreview({ selectedSourceId, survey }: Props) {
  if (!survey || (survey.sections.length === 0 && survey.lines.length === 0 && survey.features.length === 0)) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--border)] bg-black/10 p-5 text-sm text-[var(--muted)]">
        No roof takeoff drawing is linked to this quote yet.
      </div>
    );
  }

  const project = makeProjector(allPoints(survey));
  const selectedLabel = findSelectedLabel(survey, selectedSourceId);

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-black/15 p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="section-kicker text-[0.65rem] uppercase">Drawing Preview</p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {selectedLabel ? `Highlighted: ${selectedLabel}` : "Use View on drawing from a quote row to highlight the matching takeoff item."}
          </p>
        </div>
        <span className="rounded-full border border-[var(--gold)]/35 bg-[var(--gold)]/10 px-3 py-1 text-xs font-semibold text-[var(--gold-l)]">
          {survey.sections.length + survey.lines.length + survey.features.length} items
        </span>
      </div>
      <svg className="h-auto w-full rounded-xl border border-[var(--border)] bg-[#101010]" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="Roof takeoff drawing preview">
        <defs>
          <pattern height="24" id="takeoff-grid" patternUnits="userSpaceOnUse" width="24">
            <path d="M 24 0 L 0 0 0 24" fill="none" stroke="rgba(255,255,255,0.045)" strokeWidth="1" />
          </pattern>
          <filter id="selected-glow">
            <feGaussianBlur result="blur" stdDeviation="4" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <rect fill="url(#takeoff-grid)" height={HEIGHT} width={WIDTH} />

        {survey.sections.map((section) => {
          const points = section.points.map(project).filter(isProjectedPoint);
          if (points.length < 3) return null;
          const selected = selectedSourceId === section.id;
          const centre = centroid(points);
          return (
            <g filter={selected ? "url(#selected-glow)" : undefined} key={`section-${section.id || section.label}`}>
              <polygon
                fill={section.color || "#D4AF37"}
                fillOpacity={selected ? 0.5 : 0.24}
                points={points.map(pointString).join(" ")}
                stroke={selected ? "#ffffff" : section.color || "#D4AF37"}
                strokeWidth={selected ? 5 : 2.5}
              />
              <text fill="#fff" fontSize="12" fontWeight="800" paintOrder="stroke" stroke="#101010" strokeWidth="4" textAnchor="middle" x={centre.x} y={centre.y - 5}>
                {section.label}
              </text>
              <text fill="#D4AF37" fontSize="11" fontWeight="700" paintOrder="stroke" stroke="#101010" strokeWidth="4" textAnchor="middle" x={centre.x} y={centre.y + 12}>
                {Number(section.area_m2 || 0).toFixed(1)} m2
              </text>
            </g>
          );
        })}

        {survey.lines.map((line) => {
          const points = line.points.map(project).filter(isProjectedPoint);
          if (points.length < 2) return null;
          const selected = selectedSourceId === line.id;
          const mid = points[Math.floor(points.length / 2)] ?? points[0];
          return (
            <g filter={selected ? "url(#selected-glow)" : undefined} key={`line-${line.id || line.label}`}>
              <polyline
                fill="none"
                points={points.map(pointString).join(" ")}
                stroke={selected ? "#ffffff" : line.color || "#D4AF37"}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={selected ? 7 : 4}
              />
              <text fill="#fff" fontSize="11" fontWeight="800" paintOrder="stroke" stroke="#101010" strokeWidth="4" textAnchor="middle" x={mid.x} y={mid.y - 9}>
                {line.label} · {Number(line.length_lm || 0).toFixed(1)} lm
              </text>
            </g>
          );
        })}

        {survey.features.map((feature) => {
          const point = project(feature.point);
          if (!point) return null;
          const selected = selectedSourceId === feature.id;
          return (
            <g filter={selected ? "url(#selected-glow)" : undefined} key={`feature-${feature.id || feature.label}`}>
              <circle cx={point.x} cy={point.y} fill={feature.color || "#D4AF37"} r={selected ? 14 : 10} stroke={selected ? "#fff" : "#000"} strokeWidth="2" />
              <text fill="#000" fontSize="9" fontWeight="900" textAnchor="middle" x={point.x} y={point.y + 3}>
                {markerInitials(feature.type || feature.label)}
              </text>
              <text fill="#fff" fontSize="11" fontWeight="800" paintOrder="stroke" stroke="#101010" strokeWidth="4" x={point.x + 16} y={point.y - 11}>
                {feature.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function allPoints(survey: RoofSurveyRecord) {
  return [...survey.sections.flatMap((section) => section.points), ...survey.lines.flatMap((line) => line.points), ...survey.features.map((feature) => feature.point)];
}

function makeProjector(points: SurveyPoint[]) {
  const coords = points.map(toCoord).filter(Boolean) as Array<{ lat: number; lng: number }>;
  const fallback = { north: 1, south: 0, east: 1, west: 0 };
  const bounds = coords.length
    ? {
        north: Math.max(...coords.map((point) => point.lat)),
        south: Math.min(...coords.map((point) => point.lat)),
        east: Math.max(...coords.map((point) => point.lng)),
        west: Math.min(...coords.map((point) => point.lng))
      }
    : fallback;
  const lngSpan = Math.max(bounds.east - bounds.west, 0.000001);
  const latSpan = Math.max(bounds.north - bounds.south, 0.000001);
  const scale = Math.min((WIDTH - PAD * 2) / lngSpan, (HEIGHT - PAD * 2) / latSpan);
  const drawingWidth = lngSpan * scale;
  const drawingHeight = latSpan * scale;
  const offsetX = (WIDTH - drawingWidth) / 2;
  const offsetY = (HEIGHT - drawingHeight) / 2;

  return (point: SurveyPoint) => {
    const coord = toCoord(point);
    if (!coord) return null;
    return {
      x: offsetX + (coord.lng - bounds.west) * scale,
      y: offsetY + (bounds.north - coord.lat) * scale
    };
  };
}

function toCoord(point: SurveyPoint) {
  if (typeof point.lat === "number" && typeof point.lng === "number") return { lat: point.lat, lng: point.lng };
  if (typeof point.x === "number" && typeof point.y === "number") return { lat: point.y, lng: point.x };
  return null;
}

function centroid(points: Array<{ x: number; y: number }>) {
  return {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length
  };
}

function pointString(point: { x: number; y: number }) {
  return `${point.x.toFixed(1)},${point.y.toFixed(1)}`;
}

function isProjectedPoint(point: { x: number; y: number } | null): point is { x: number; y: number } {
  return Boolean(point);
}

function markerInitials(value: string) {
  return value
    .split(/\s+|\/+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function findSelectedLabel(survey: RoofSurveyRecord, selectedSourceId?: string | null) {
  if (!selectedSourceId) return null;
  return (
    survey.sections.find((section) => section.id === selectedSourceId)?.label ??
    survey.lines.find((line) => line.id === selectedSourceId)?.label ??
    survey.features.find((feature) => feature.id === selectedSourceId)?.label ??
    null
  );
}
