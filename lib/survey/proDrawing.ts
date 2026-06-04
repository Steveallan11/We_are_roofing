import type { RoofSurveyFeature, RoofSurveyLine, RoofSurveySection } from "@/lib/survey/types";

/**
 * Pro drawing pipeline — fetches a clean satellite image (no Google-baked paths/markers)
 * and overlays our own SVG so we can render: inline edge dimensions, scale bar, north arrow,
 * non-overlapping numbered markers, hatched material fills, and proper title blocks.
 *
 * Three styles:
 *  - "satellite-pro"   Clean satellite + dimensioned SVG overlay (best customer plan)
 *  - "schematic-cad"   Pure CAD-style line drawing, hatched fills, fully dimensioned
 *  - "dimensioned-bw"  Black-and-white technical drawing with every edge labelled
 */

export type ProDrawingStyle = "satellite-pro" | "schematic-cad" | "dimensioned-bw";
export type ProDrawingFraming = "close" | "building" | "context";

type LatLng = { lat: number; lng: number };
type Pixel = { x: number; y: number };

export type ProDrawingOpts = {
  projectName: string;
  jobRef: string;
  address: string;
  customerName?: string;
  surveyDate: string;
  notes?: string;
  sections: RoofSurveySection[];
  lines: RoofSurveyLine[];
  features: RoofSurveyFeature[];
  style: ProDrawingStyle;
  framing?: ProDrawingFraming;
  satelliteImageHref?: string | null;
  satelliteInsetImageHref?: string | null;
  satelliteMeta?: SatelliteMeta | null;
};

export type SatelliteMeta = {
  center: LatLng;
  zoom: number;
  scale: 1 | 2;
  width: number;
  height: number;
};

const SHEET = { width: 1684, height: 1190 };
const MARGIN = 56;
const HEADER_HEIGHT = 96;
const FOOTER_HEIGHT = 64;
const LEGEND_WIDTH = 380;
const SCALE_BAR_TARGET_M: number[] = [1, 2, 5, 10, 20, 50, 100];

const PALETTE = [
  "#D4AF37", "#3B82F6", "#10B981", "#F97316",
  "#8B5CF6", "#EF4444", "#06B6D4", "#EC4899",
  "#84CC16", "#F59E0B"
] as const;

const LINE_COLOURS: Record<string, string> = {
  ridge: "#3B82F6",
  hip: "#06B6D4",
  valley: "#8B5CF6",
  eaves: "#F59E0B",
  verge: "#F97316",
  abutment: "#EF4444",
  parapet: "#EC4899",
  flashing: "#D4AF37",
  gutter: "#10B981",
  fascia: "#94A3B8",
  soaker: "#84CC16",
  default: "#D4AF37"
};

const HATCH_PATTERNS: Record<string, { angle: number; spacing: number; stroke: string }> = {
  "Pitched Tile": { angle: 45, spacing: 6, stroke: "#1f2937" },
  "Pitched Slate": { angle: 0, spacing: 5, stroke: "#1f2937" },
  "Flat EPDM": { angle: 90, spacing: 4, stroke: "#374151" },
  "Flat GRP": { angle: 30, spacing: 5, stroke: "#374151" },
  "Flat Felt": { angle: 60, spacing: 7, stroke: "#1f2937" },
  Lead: { angle: 0, spacing: 4, stroke: "#1f2937" },
  Other: { angle: 45, spacing: 8, stroke: "#1f2937" }
};

/* ------------------------------------------------------------------------ */
/* Static-map helpers (project lat/lng → pixel inside the static image)     */
/* ------------------------------------------------------------------------ */

function latRadMercator(lat: number) {
  const sin = Math.sin((lat * Math.PI) / 180);
  return Math.log((1 + sin) / (1 - sin)) / 2;
}

function lngRadMercator(lng: number) {
  return (lng * Math.PI) / 180;
}

/** World pixel at given zoom (Google's Web Mercator with 256-px world tile). */
function worldPixel(point: LatLng, zoom: number, scale: 1 | 2): Pixel {
  const worldSize = 256 * Math.pow(2, zoom) * scale;
  const x = ((point.lng + 180) / 360) * worldSize;
  const sin = Math.sin((point.lat * Math.PI) / 180);
  const y = (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * worldSize;
  return { x, y };
}

function projectToSatellite(point: LatLng, sat: SatelliteMeta, origin: Pixel) {
  const world = worldPixel(point, sat.zoom, sat.scale);
  const center = worldPixel(sat.center, sat.zoom, sat.scale);
  return {
    x: origin.x + (world.x - center.x) + (sat.width * sat.scale) / 2 / sat.scale,
    y: origin.y + (world.y - center.y) + (sat.height * sat.scale) / 2 / sat.scale
  };
}

function metersPerPixel(lat: number, zoom: number, scale: 1 | 2) {
  return (156543.03392 * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, zoom) / scale;
}

/* ------------------------------------------------------------------------ */
/* Geometry helpers                                                          */
/* ------------------------------------------------------------------------ */

const EARTH_R = 6378137;
function haversine(a: LatLng, b: LatLng) {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_R * Math.asin(Math.sqrt(h));
}

function toLatLng(point: { lat?: number; lng?: number; x?: number; y?: number }): LatLng | null {
  if (typeof point.lat === "number" && typeof point.lng === "number") return { lat: point.lat, lng: point.lng };
  if (typeof point.x === "number" && typeof point.y === "number") return { lat: point.y, lng: point.x };
  return null;
}

function allLatLngs(sections: RoofSurveySection[], lines: RoofSurveyLine[], features: RoofSurveyFeature[]) {
  return [
    ...sections.flatMap((s) => s.points.map(toLatLng).filter(Boolean)),
    ...lines.flatMap((l) => l.points.map(toLatLng).filter(Boolean)),
    ...features.map((f) => toLatLng(f.point)).filter(Boolean)
  ] as LatLng[];
}

function centroidLatLng(points: LatLng[]) {
  return {
    lat: points.reduce((s, p) => s + p.lat, 0) / points.length,
    lng: points.reduce((s, p) => s + p.lng, 0) / points.length
  };
}

function midpointLatLng(points: LatLng[]) {
  return points[Math.floor(points.length / 2)] ?? points[0];
}

function geoBounds(points: LatLng[]) {
  if (!points.length) return null;
  return {
    north: Math.max(...points.map((p) => p.lat)),
    south: Math.min(...points.map((p) => p.lat)),
    east: Math.max(...points.map((p) => p.lng)),
    west: Math.min(...points.map((p) => p.lng))
  };
}

function expandBoundsMeters(b: NonNullable<ReturnType<typeof geoBounds>>, m: number) {
  const center = { lat: (b.north + b.south) / 2, lng: (b.east + b.west) / 2 };
  const latPad = m / 111_320;
  const lngPad = m / Math.max(111_320 * Math.cos((center.lat * Math.PI) / 180), 1);
  return { north: b.north + latPad, south: b.south - latPad, east: b.east + lngPad, west: b.west - lngPad };
}

function pickZoomForBounds(bounds: NonNullable<ReturnType<typeof geoBounds>>, w: number, h: number, boost = 0) {
  const lngSpan = Math.max(Math.abs(bounds.east - bounds.west), 0.00001);
  const latFraction = Math.max(Math.abs(latRadMercator(bounds.north) - latRadMercator(bounds.south)) / (2 * Math.PI), 0.00001);
  const lngZoom = Math.floor(Math.log2(w / 256 / (lngSpan / 360)));
  const latZoom = Math.floor(Math.log2(h / 256 / latFraction));
  return Math.max(18, Math.min(22, Math.min(lngZoom, latZoom) + boost));
}

/* ------------------------------------------------------------------------ */
/* Public: build a CLEAN satellite static-map URL + its metadata             */
/* ------------------------------------------------------------------------ */

export function buildCleanSatellite(
  opts: Pick<ProDrawingOpts, "sections" | "lines" | "features" | "framing">,
  apiKey: string,
  framing: ProDrawingFraming = "building"
): { url: string; meta: SatelliteMeta } | null {
  const coords = allLatLngs(opts.sections, opts.lines, opts.features);
  if (!coords.length) return null;
  const bounds = geoBounds(coords);
  if (!bounds) return null;

  const cfg = framing === "close"
    ? { paddingMeters: 4, zoomBoost: 1 }
    : framing === "context"
    ? { paddingMeters: 28, zoomBoost: -1 }
    : { paddingMeters: 10, zoomBoost: 0 };

  const padded = expandBoundsMeters(bounds, cfg.paddingMeters);
  const center = { lat: (padded.north + padded.south) / 2, lng: (padded.east + padded.west) / 2 };
  const width = 640;
  const height = 520;
  const scale: 1 | 2 = 2;
  const zoom = pickZoomForBounds(padded, width, height, cfg.zoomBoost);

  const params = new URLSearchParams({
    key: apiKey,
    maptype: "satellite",
    size: `${width}x${height}`,
    scale: String(scale),
    format: "png32",
    center: `${center.lat},${center.lng}`,
    zoom: String(zoom)
  });

  return {
    url: `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`,
    meta: { center, zoom, scale, width, height }
  };
}

/* ------------------------------------------------------------------------ */
/* Layout: drawing area + legend area inside the sheet                       */
/* ------------------------------------------------------------------------ */

type Layout = {
  drawingX: number; drawingY: number; drawingW: number; drawingH: number;
  legendX: number; legendY: number; legendW: number; legendH: number;
};

function pageLayout(): Layout {
  const drawingX = MARGIN;
  const drawingY = MARGIN + HEADER_HEIGHT;
  const drawingW = SHEET.width - MARGIN * 2 - LEGEND_WIDTH - 32;
  const drawingH = SHEET.height - MARGIN * 2 - HEADER_HEIGHT - FOOTER_HEIGHT;
  return {
    drawingX, drawingY, drawingW, drawingH,
    legendX: drawingX + drawingW + 32,
    legendY: drawingY,
    legendW: LEGEND_WIDTH,
    legendH: drawingH
  };
}

/* ------------------------------------------------------------------------ */
/* Project lat/lng to a target rect (image-fitting math)                     */
/* ------------------------------------------------------------------------ */

function makeRectProjector(coords: LatLng[], rect: { x: number; y: number; w: number; h: number }, padding = 24) {
  const bounds = geoBounds(coords);
  if (!bounds) return null;
  const lngSpan = Math.max(bounds.east - bounds.west, 0.0000001);
  const latSpan = Math.max(bounds.north - bounds.south, 0.0000001);
  // Convert to flat metres using local lat scale so X & Y use the same physical scale
  const center = { lat: (bounds.north + bounds.south) / 2, lng: (bounds.east + bounds.west) / 2 };
  const mPerLatDeg = 111_320;
  const mPerLngDeg = Math.cos((center.lat * Math.PI) / 180) * 111_320;
  const w = lngSpan * mPerLngDeg;
  const h = latSpan * mPerLatDeg;
  const sx = (rect.w - padding * 2) / Math.max(w, 0.0001);
  const sy = (rect.h - padding * 2) / Math.max(h, 0.0001);
  const scale = Math.min(sx, sy);
  const offX = rect.x + (rect.w - w * scale) / 2;
  const offY = rect.y + (rect.h - h * scale) / 2;
  return {
    project: (p: LatLng) => ({
      x: offX + (p.lng - bounds.west) * mPerLngDeg * scale,
      y: offY + (bounds.north - p.lat) * mPerLatDeg * scale
    }),
    metersPerSvgUnit: 1 / scale
  };
}

/* ------------------------------------------------------------------------ */
/* Inline edge dimensions for polygons / polylines                           */
/* ------------------------------------------------------------------------ */

function edgeDimension(p1: Pixel, p2: Pixel, label: string, theme: "light" | "dark") {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const length = Math.hypot(dx, dy);
  if (length < 28) return ""; // too short to label cleanly
  const mx = (p1.x + p2.x) / 2;
  const my = (p1.y + p2.y) / 2;
  let angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  if (angle > 90) angle -= 180;
  if (angle < -90) angle += 180;
  const haloFill = theme === "dark" ? "#0a0a0a" : "#ffffff";
  const textFill = theme === "dark" ? "#ffffff" : "#111827";
  return `
    <g transform="translate(${mx.toFixed(1)} ${my.toFixed(1)}) rotate(${angle.toFixed(1)})">
      <text y="-6" text-anchor="middle" font-family="Inter,Helvetica,Arial,sans-serif" font-size="11" font-weight="700"
        paint-order="stroke" stroke="${haloFill}" stroke-width="3" stroke-linejoin="round" fill="${textFill}">${label}</text>
    </g>`;
}

/* ------------------------------------------------------------------------ */
/* Scale bar + north arrow                                                   */
/* ------------------------------------------------------------------------ */

function pickScaleBarMeters(targetPx: number, mPerPx: number) {
  let best = SCALE_BAR_TARGET_M[0];
  let bestDiff = Infinity;
  for (const m of SCALE_BAR_TARGET_M) {
    const px = m / mPerPx;
    const diff = Math.abs(px - targetPx);
    if (diff < bestDiff && px <= targetPx * 1.4) { best = m; bestDiff = diff; }
  }
  return best;
}

function scaleBar(x: number, y: number, mPerPx: number, theme: "light" | "dark") {
  if (!isFinite(mPerPx) || mPerPx <= 0) return "";
  const targetPx = 160;
  const meters = pickScaleBarMeters(targetPx, mPerPx);
  const widthPx = meters / mPerPx;
  const fg = theme === "dark" ? "#ffffff" : "#111827";
  const bg = theme === "dark" ? "#1a1a1a" : "#ffffff";
  return `
    <g transform="translate(${x} ${y})" font-family="Inter,Helvetica,Arial,sans-serif">
      <rect x="-12" y="-26" width="${widthPx + 24}" height="44" rx="6" fill="${bg}" fill-opacity="0.92" stroke="${fg}" stroke-opacity="0.4"/>
      <text x="${widthPx / 2}" y="-12" text-anchor="middle" font-size="9" font-weight="700"
        letter-spacing="1.4" fill="${fg}" fill-opacity="0.7">SCALE</text>
      <rect x="0" y="-2" width="${widthPx / 2}" height="6" fill="${fg}"/>
      <rect x="${widthPx / 2}" y="-2" width="${widthPx / 2}" height="6" fill="${bg}" stroke="${fg}" stroke-width="1"/>
      <text x="0" y="16" font-size="10" font-weight="700" fill="${fg}">0</text>
      <text x="${widthPx}" y="16" text-anchor="end" font-size="10" font-weight="700" fill="${fg}">${meters} m</text>
    </g>`;
}

function northArrow(x: number, y: number, theme: "light" | "dark") {
  const fg = theme === "dark" ? "#ffffff" : "#111827";
  const bg = theme === "dark" ? "#1a1a1a" : "#ffffff";
  return `
    <g transform="translate(${x} ${y})" font-family="Inter,Helvetica,Arial,sans-serif">
      <circle r="22" fill="${bg}" fill-opacity="0.92" stroke="${fg}" stroke-opacity="0.4"/>
      <path d="M0 -16 L8 12 L0 7 L-8 12 Z" fill="${fg}"/>
      <text y="-26" text-anchor="middle" font-size="10" font-weight="800" letter-spacing="1.4" fill="${fg}">N</text>
    </g>`;
}

/* ------------------------------------------------------------------------ */
/* Marker placement (avoid overlap)                                          */
/* ------------------------------------------------------------------------ */

type Marker = { x: number; y: number; code: string; color: string; href?: string };

function distributeMarkers(markers: Marker[], radius = 22) {
  const placed: Marker[] = [];
  const taken: Pixel[] = [];
  for (const m of markers) {
    let { x, y } = m;
    let attempts = 0;
    while (taken.some((t) => Math.hypot(t.x - x, t.y - y) < radius * 1.9) && attempts < 16) {
      const angle = (attempts * 137.5 * Math.PI) / 180;
      x = m.x + Math.cos(angle) * radius * 1.6;
      y = m.y + Math.sin(angle) * radius * 1.6;
      attempts += 1;
    }
    taken.push({ x, y });
    placed.push({ ...m, x, y });
  }
  return placed;
}

/* ------------------------------------------------------------------------ */
/* Helpers                                                                   */
/* ------------------------------------------------------------------------ */

function sectionColor(index: number, fallback?: string | null) {
  const clean = fallback?.replace("#", "").trim();
  if (clean && /^[0-9a-fA-F]{6}$/.test(clean) && clean.toUpperCase() !== "D4AF37") return `#${clean}`;
  return PALETTE[index % PALETTE.length];
}

function lineColor(line: RoofSurveyLine, fallbackIndex: number) {
  const key = `${line.type || ""}${line.label || ""}`.toLowerCase();
  for (const [k, v] of Object.entries(LINE_COLOURS)) if (k !== "default" && key.includes(k)) return v;
  return line.color || PALETTE[fallbackIndex % PALETTE.length];
}

function customerAreaLabel(index: number) {
  return `Area ${markerCode(index)}`;
}

function customerLineLabel(line: RoofSurveyLine, index: number) {
  const label = line.label || line.type || `Line ${index + 1}`;
  const length = Number(line.length_lm || 0);
  if (length <= 0) return label;
  return `${label} - ${length.toFixed(1)} lm`;
}

function markerCode(index: number) {
  let n = index;
  let code = "";
  do {
    code = String.fromCharCode(65 + (n % 26)) + code;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return code;
}

function escapeXml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function pointsToPath(points: Pixel[], close: boolean) {
  if (!points.length) return "";
  return points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ") + (close ? " Z" : "");
}

/* ------------------------------------------------------------------------ */
/* SATELLITE-PRO: clean satellite + dimensioned overlay                      */
/* ------------------------------------------------------------------------ */

function buildSatelliteProSvg(opts: ProDrawingOpts) {
  const layout = pageLayout();
  const meta = opts.satelliteMeta;
  const satelliteHref = opts.satelliteImageHref || null;

  // Fit the satellite image into the drawing area at correct aspect ratio
  let imgX = layout.drawingX;
  let imgY = layout.drawingY;
  let imgW = layout.drawingW;
  let imgH = layout.drawingH;
  let project: (p: LatLng) => Pixel = () => ({ x: 0, y: 0 });
  let mPerPx = 0;

  if (meta) {
    const imgAspect = meta.width / meta.height;
    const drawAspect = layout.drawingW / layout.drawingH;
    if (imgAspect > drawAspect) {
      imgW = layout.drawingW;
      imgH = imgW / imgAspect;
      imgY = layout.drawingY + (layout.drawingH - imgH) / 2;
    } else {
      imgH = layout.drawingH;
      imgW = imgH * imgAspect;
      imgX = layout.drawingX + (layout.drawingW - imgW) / 2;
    }
    const pxPerImage = imgW / meta.width; // SVG units per source pixel
    project = (p: LatLng) => {
      const world = worldPixel(p, meta.zoom, meta.scale);
      const center = worldPixel(meta.center, meta.zoom, meta.scale);
      const offsetX = (world.x - center.x) / meta.scale;
      const offsetY = (world.y - center.y) / meta.scale;
      return {
        x: imgX + imgW / 2 + offsetX * pxPerImage,
        y: imgY + imgH / 2 + offsetY * pxPerImage
      };
    };
    mPerPx = metersPerPixel(meta.center.lat, meta.zoom, meta.scale) / pxPerImage;
  }

  return renderSheet({
    opts,
    layout,
    theme: "light",
    background: "#f8f7f2",
    sheetBg: "#ffffff",
    drawingFill: "#fbfaf5",
    body: () => {
      const overlay: string[] = [];
      const sectionMarkers: Marker[] = [];
      const lineMarkers: Marker[] = [];
      const totalArea = opts.sections.reduce((s, x) => s + Number(x.area_m2 || 0), 0);
      const totalLength = opts.lines.reduce((s, x) => s + Number(x.length_lm || 0), 0);

      // satellite image (or warning)
      if (satelliteHref && meta) {
        overlay.push(`
          <defs><clipPath id="satClip"><rect x="${layout.drawingX}" y="${layout.drawingY}" width="${layout.drawingW}" height="${layout.drawingH}" rx="12"/></clipPath></defs>
          <image href="${escapeXml(satelliteHref)}" x="${imgX}" y="${imgY}" width="${imgW}" height="${imgH}" preserveAspectRatio="xMidYMid slice" clip-path="url(#satClip)"/>
          <rect x="${layout.drawingX}" y="${layout.drawingY}" width="${layout.drawingW}" height="${layout.drawingH}" rx="12" fill="rgba(0,0,0,0.12)"/>
        `);
      } else {
        overlay.push(`
          <text x="${layout.drawingX + layout.drawingW / 2}" y="${layout.drawingY + layout.drawingH / 2}" text-anchor="middle"
            font-family="Inter,sans-serif" font-size="14" font-weight="700" fill="#b45309">
            Satellite image unavailable - check NEXT_PUBLIC_GOOGLE_MAPS_API_KEY.</text>
        `);
      }

      // Customer plan: keep this readable. Detailed dimensions live on the technical drawings.
      opts.sections.forEach((section, idx) => {
        const ll = section.points.map(toLatLng).filter(Boolean) as LatLng[];
        if (ll.length < 3) return;
        const pts = ll.map(project);
        const color = sectionColor(idx, section.color);
        overlay.push(`
          <path d="${pointsToPath(pts, true)}"
            fill="${color}" fill-opacity="0.38"
            stroke="#ffffff" stroke-width="8" stroke-linejoin="round" opacity="0.96"/>
          <path d="${pointsToPath(pts, true)}"
            fill="none" stroke="${color}" stroke-width="4" stroke-linejoin="round"/>`);
        const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
        const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
        sectionMarkers.push({ x: cx, y: cy, code: markerCode(idx), color });
      });

      // Customer plan shows the lines selected in the export panel. Technical clutter is controlled before export.
      const customerLines = opts.lines;
      customerLines.forEach((line, idx) => {
        const ll = line.points.map(toLatLng).filter(Boolean) as LatLng[];
        if (ll.length < 2) return;
        const pts = ll.map(project);
        const color = lineColor(line, idx);
        overlay.push(`
          <path d="${pointsToPath(pts, false)}" fill="none" stroke="#ffffff" stroke-width="9" stroke-linecap="round" stroke-linejoin="round" opacity="0.86"/>
          <path d="${pointsToPath(pts, false)}" fill="none" stroke="${color}" stroke-width="4.8" stroke-opacity="0.95" stroke-linecap="round" stroke-linejoin="round"/>`);
        const midIdx = Math.floor(pts.length / 2);
        lineMarkers.push({
          x: pts[midIdx].x,
          y: pts[midIdx].y,
          code: markerCode(opts.sections.length + idx),
          color
        });
      });

      // Distribute choice markers to avoid overlap.
      const allMarkers = distributeMarkers([...sectionMarkers, ...lineMarkers], 28);
      allMarkers.forEach((m) => {
        overlay.push(`
          <g transform="translate(${m.x.toFixed(1)} ${m.y.toFixed(1)})">
            <circle r="24" fill="#0a0a0a" fill-opacity="0.58"/>
            <circle r="20" fill="${m.color}" stroke="#ffffff" stroke-width="3"/>
            <text text-anchor="middle" y="6" font-family="Inter,sans-serif" font-size="18" font-weight="900" fill="#0a0a0a">${escapeXml(m.code)}</text>
          </g>`);
      });

      // Scale bar + north arrow (only if we have meta)
      if (mPerPx > 0) {
        overlay.push(scaleBar(layout.drawingX + 32, layout.drawingY + layout.drawingH - 32, mPerPx, "light"));
      }
      overlay.push(northArrow(layout.drawingX + layout.drawingW - 40, layout.drawingY + 40, "light"));

      // Right legend
      const legend = renderLegend({
        layout,
        theme: "light",
        sections: opts.sections,
        lines: opts.lines,
        features: opts.features,
        totalArea,
        totalLength,
        customerSummary: true
      });

      return overlay.join("\n") + legend;
    }
  });
}

/* ------------------------------------------------------------------------ */
/* SCHEMATIC-CAD: clean line drawing with hatched fills and dimensions       */
/* ------------------------------------------------------------------------ */

function buildSchematicCadSvg(opts: ProDrawingOpts) {
  const layout = pageLayout();
  return renderSheet({
    opts,
    layout,
    theme: "light",
    background: "#fafaf5",
    sheetBg: "#ffffff",
    drawingFill: "#ffffff",
    body: () => {
      const coords = allLatLngs(opts.sections, opts.lines, opts.features);
      const projector = makeRectProjector(coords, { x: layout.drawingX, y: layout.drawingY, w: layout.drawingW, h: layout.drawingH }, 64);
      const totalArea = opts.sections.reduce((s, x) => s + Number(x.area_m2 || 0), 0);
      const totalLength = opts.lines.reduce((s, x) => s + Number(x.length_lm || 0), 0);

      if (!projector) {
        return `<text x="${layout.drawingX + layout.drawingW / 2}" y="${layout.drawingY + layout.drawingH / 2}" text-anchor="middle" font-family="Inter,sans-serif" font-size="14">No measured data yet.</text>`;
      }

      const mPerPx = projector.metersPerSvgUnit;
      const overlay: string[] = [];

      // Hatch pattern defs (unique per section type used)
      const usedTypes = new Set(opts.sections.map((s) => s.type || "Other"));
      overlay.push("<defs>");
      usedTypes.forEach((type) => {
        const pat = HATCH_PATTERNS[type] ?? HATCH_PATTERNS.Other;
        const id = `hatch-${type.replace(/\W+/g, "")}`;
        overlay.push(`
          <pattern id="${id}" patternUnits="userSpaceOnUse" width="${pat.spacing * 2}" height="${pat.spacing * 2}" patternTransform="rotate(${pat.angle})">
            <line x1="0" y1="0" x2="0" y2="${pat.spacing * 2}" stroke="${pat.stroke}" stroke-width="0.6" stroke-opacity="0.55"/>
          </pattern>`);
      });
      // Grid
      overlay.push(`
        <pattern id="cadGrid" x="${layout.drawingX}" y="${layout.drawingY}" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M40 0 L0 0 0 40" fill="none" stroke="#e5e5e0" stroke-width="0.6"/>
        </pattern>`);
      overlay.push("</defs>");

      // Background grid
      overlay.push(`<rect x="${layout.drawingX}" y="${layout.drawingY}" width="${layout.drawingW}" height="${layout.drawingH}" fill="url(#cadGrid)"/>`);
      overlay.push(`<rect x="${layout.drawingX}" y="${layout.drawingY}" width="${layout.drawingW}" height="${layout.drawingH}" fill="none" stroke="#111827" stroke-width="1.5"/>`);

      // Sections: hatched fills + outline + edge dimensions + centroid label
      opts.sections.forEach((section, idx) => {
        const ll = section.points.map(toLatLng).filter(Boolean) as LatLng[];
        if (ll.length < 3) return;
        const pts = ll.map((p) => projector.project(p));
        const type = section.type || "Other";
        const id = `hatch-${type.replace(/\W+/g, "")}`;
        const color = sectionColor(idx, section.color);
        overlay.push(`
          <path d="${pointsToPath(pts, true)}" fill="url(#${id})" fill-opacity="0.85" stroke="${color}" stroke-width="2"/>
          <path d="${pointsToPath(pts, true)}" fill="none" stroke="#111827" stroke-width="2.5"/>`);
        for (let i = 0; i < ll.length; i += 1) {
          const next = (i + 1) % ll.length;
          const lengthM = haversine(ll[i], ll[next]);
          overlay.push(edgeDimension(pts[i], pts[next], `${lengthM.toFixed(2)} m`, "light"));
        }
        const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
        const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
        const area = Number(section.area_m2 || 0);
        overlay.push(`
          <g transform="translate(${cx} ${cy})" font-family="Inter,sans-serif">
            <circle r="22" fill="#ffffff" stroke="#111827" stroke-width="2"/>
            <text text-anchor="middle" y="-2" font-size="13" font-weight="800" fill="#111827">${markerCode(idx)}</text>
            <text text-anchor="middle" y="13" font-size="9" font-weight="600" fill="#374151">${area.toFixed(1)} m²</text>
          </g>`);
      });

      // Lines: different CAD stroke styles per type
      opts.lines.forEach((line, idx) => {
        const ll = line.points.map(toLatLng).filter(Boolean) as LatLng[];
        if (ll.length < 2) return;
        const pts = ll.map((p) => projector.project(p));
        const color = lineColor(line, idx);
        const isDashed = /flashing|abutment|parapet|soaker/i.test(`${line.type} ${line.label}`);
        overlay.push(`
          <path d="${pointsToPath(pts, false)}" fill="none" stroke="${color}" stroke-width="3"
            ${isDashed ? 'stroke-dasharray="8 4"' : ""} stroke-linecap="round" stroke-linejoin="round"/>`);
        for (let i = 1; i < ll.length; i += 1) {
          const lengthM = haversine(ll[i - 1], ll[i]);
          overlay.push(edgeDimension(pts[i - 1], pts[i], `${lengthM.toFixed(2)} m`, "light"));
        }
        const midIdx = Math.floor(pts.length / 2);
        overlay.push(`
          <g transform="translate(${pts[midIdx].x} ${pts[midIdx].y - 20})" font-family="Inter,sans-serif">
            <rect x="-15" y="-12" width="30" height="20" rx="4" fill="#ffffff" stroke="${color}" stroke-width="1.5"/>
            <text text-anchor="middle" y="3" font-size="11" font-weight="800" fill="${color}">${markerCode(opts.sections.length + idx)}</text>
          </g>`);
      });

      // Features: standard CAD symbols
      opts.features.forEach((f, idx) => {
        const p = toLatLng(f.point);
        if (!p) return;
        const px = projector.project(p);
        overlay.push(`
          <g transform="translate(${px.x} ${px.y})">
            <rect x="-9" y="-9" width="18" height="18" fill="#ffffff" stroke="#111827" stroke-width="1.5"/>
            <text text-anchor="middle" y="4" font-family="Inter,sans-serif" font-size="11" font-weight="800" fill="#111827">${markerCode(opts.sections.length + opts.lines.length + idx)}</text>
          </g>`);
      });

      overlay.push(scaleBar(layout.drawingX + 32, layout.drawingY + layout.drawingH - 32, mPerPx, "light"));
      overlay.push(northArrow(layout.drawingX + layout.drawingW - 40, layout.drawingY + 40, "light"));

      const legend = renderLegend({
        layout,
        theme: "light",
        sections: opts.sections,
        lines: opts.lines,
        features: opts.features,
        totalArea,
        totalLength,
        showHatchPatterns: true
      });

      return overlay.join("\n") + legend;
    }
  });
}

/* ------------------------------------------------------------------------ */
/* DIMENSIONED-BW: pure black-and-white, no colour, every edge labelled      */
/* ------------------------------------------------------------------------ */

function buildDimensionedBwSvg(opts: ProDrawingOpts) {
  const layout = pageLayout();
  return renderSheet({
    opts,
    layout,
    theme: "light",
    background: "#ffffff",
    sheetBg: "#ffffff",
    drawingFill: "#ffffff",
    body: () => {
      const coords = allLatLngs(opts.sections, opts.lines, opts.features);
      const projector = makeRectProjector(coords, { x: layout.drawingX, y: layout.drawingY, w: layout.drawingW, h: layout.drawingH }, 64);
      const totalArea = opts.sections.reduce((s, x) => s + Number(x.area_m2 || 0), 0);
      const totalLength = opts.lines.reduce((s, x) => s + Number(x.length_lm || 0), 0);
      if (!projector) return "";
      const overlay: string[] = [];

      // Sections: outline only, no fill
      opts.sections.forEach((section, idx) => {
        const ll = section.points.map(toLatLng).filter(Boolean) as LatLng[];
        if (ll.length < 3) return;
        const pts = ll.map((p) => projector.project(p));
        overlay.push(`<path d="${pointsToPath(pts, true)}" fill="#f3f4f6" stroke="#111827" stroke-width="2"/>`);
        for (let i = 0; i < ll.length; i += 1) {
          const next = (i + 1) % ll.length;
          const lengthM = haversine(ll[i], ll[next]);
          overlay.push(edgeDimension(pts[i], pts[next], `${lengthM.toFixed(2)} m`, "light"));
        }
        const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
        const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
        overlay.push(`
          <g transform="translate(${cx} ${cy})" font-family="Inter,sans-serif">
            <text text-anchor="middle" y="-2" font-size="14" font-weight="800" fill="#111827">${markerCode(idx)}</text>
            <text text-anchor="middle" y="14" font-size="10" font-weight="600" fill="#374151">${Number(section.area_m2 || 0).toFixed(2)} m²</text>
          </g>`);
      });

      // Lines: standard CAD line types
      opts.lines.forEach((line, idx) => {
        const ll = line.points.map(toLatLng).filter(Boolean) as LatLng[];
        if (ll.length < 2) return;
        const pts = ll.map((p) => projector.project(p));
        const isRidge = /ridge/i.test(`${line.type} ${line.label}`);
        const isValley = /valley/i.test(`${line.type} ${line.label}`);
        const isFlashing = /flashing|abutment|parapet|soaker/i.test(`${line.type} ${line.label}`);
        const dash = isRidge ? "" : isValley ? "12 4 2 4" : isFlashing ? "8 4" : "";
        overlay.push(`
          <path d="${pointsToPath(pts, false)}" fill="none" stroke="#111827" stroke-width="${isRidge ? 3 : 2}"
            ${dash ? `stroke-dasharray="${dash}"` : ""} stroke-linecap="round" stroke-linejoin="round"/>`);
        for (let i = 1; i < ll.length; i += 1) {
          const lengthM = haversine(ll[i - 1], ll[i]);
          overlay.push(edgeDimension(pts[i - 1], pts[i], `${lengthM.toFixed(2)} m`, "light"));
        }
        const midIdx = Math.floor(pts.length / 2);
        overlay.push(`
          <g transform="translate(${pts[midIdx].x} ${pts[midIdx].y - 18})" font-family="Inter,sans-serif">
            <rect x="-15" y="-12" width="30" height="20" rx="4" fill="#ffffff" stroke="#111827" stroke-width="1.5"/>
            <text text-anchor="middle" y="3" font-size="11" font-weight="900" fill="#111827">${markerCode(opts.sections.length + idx)}</text>
          </g>`);
      });

      opts.features.forEach((feature, idx) => {
        const p = toLatLng(feature.point);
        if (!p) return;
        const px = projector.project(p);
        overlay.push(`
          <g transform="translate(${px.x} ${px.y})" font-family="Inter,sans-serif">
            <rect x="-12" y="-12" width="24" height="24" fill="#ffffff" stroke="#111827" stroke-width="1.5"/>
            <text text-anchor="middle" y="4" font-size="10" font-weight="900" fill="#111827">${markerCode(opts.sections.length + opts.lines.length + idx)}</text>
          </g>`);
      });

      overlay.push(scaleBar(layout.drawingX + 32, layout.drawingY + layout.drawingH - 32, projector.metersPerSvgUnit, "light"));
      overlay.push(northArrow(layout.drawingX + layout.drawingW - 40, layout.drawingY + 40, "light"));

      const legend = renderLegend({
        layout, theme: "light",
        sections: opts.sections, lines: opts.lines, features: opts.features,
        totalArea, totalLength,
        cadLegend: true
      });

      return overlay.join("\n") + legend;
    }
  });
}

/* ------------------------------------------------------------------------ */
/* Common sheet wrapper (header/footer + title block)                        */
/* ------------------------------------------------------------------------ */

type SheetArgs = {
  opts: ProDrawingOpts;
  layout: Layout;
  theme: "light" | "dark";
  background: string;
  sheetBg: string;
  drawingFill: string;
  body: () => string;
};

function renderSheet({ opts, layout, theme: _theme, background, sheetBg, drawingFill, body }: SheetArgs) {
  const styleTitle: Record<ProDrawingStyle, string> = {
    "satellite-pro": "Customer Roof Plan",
    "schematic-cad": "Schematic Roof Plan",
    "dimensioned-bw": "Dimensioned Roof Plan"
  };
  const styleSubtitle: Record<ProDrawingStyle, string> = {
    "satellite-pro": "Measured plan over aerial imagery — all dimensions to scale",
    "schematic-cad": "CAD-style schematic with material hatching and dimensions",
    "dimensioned-bw": "Technical roof plan with every edge dimensioned"
  };
  const totalArea = opts.sections.reduce((s, x) => s + Number(x.area_m2 || 0), 0);
  const totalLength = opts.lines.reduce((s, x) => s + Number(x.length_lm || 0), 0);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${SHEET.width}" height="${SHEET.height}" viewBox="0 0 ${SHEET.width} ${SHEET.height}" font-family="Inter,Helvetica,Arial,sans-serif">
  <rect width="${SHEET.width}" height="${SHEET.height}" fill="${background}"/>
  <rect x="${MARGIN / 2}" y="${MARGIN / 2}" width="${SHEET.width - MARGIN}" height="${SHEET.height - MARGIN}" rx="14" fill="${sheetBg}" stroke="#e5e5e0"/>

  <!-- Header -->
  <text x="${MARGIN}" y="${MARGIN + 28}" font-size="11" font-weight="800" letter-spacing="2.8" fill="#D4AF37">WE ARE ROOFING UK LTD</text>
  <text x="${MARGIN}" y="${MARGIN + 60}" font-family="Georgia,serif" font-size="28" font-weight="700" fill="#111827">${escapeXml(styleTitle[opts.style])}</text>
  <text x="${MARGIN}" y="${MARGIN + 82}" font-size="13" font-weight="500" fill="#6b7280">${escapeXml(styleSubtitle[opts.style])}</text>
  <text x="${SHEET.width - MARGIN}" y="${MARGIN + 28}" text-anchor="end" font-size="11" font-weight="700" letter-spacing="1.8" fill="#374151">${escapeXml(opts.jobRef)}</text>
  <text x="${SHEET.width - MARGIN}" y="${MARGIN + 48}" text-anchor="end" font-size="12" fill="#374151">${escapeXml(opts.address)}</text>
  <text x="${SHEET.width - MARGIN}" y="${MARGIN + 66}" text-anchor="end" font-size="11" fill="#6b7280">Survey: ${escapeXml(opts.surveyDate)}</text>
  <text x="${SHEET.width - MARGIN}" y="${MARGIN + 82}" text-anchor="end" font-size="11" fill="#6b7280">Customer: ${escapeXml(opts.customerName || "—")}</text>

  <!-- Drawing area background -->
  <rect x="${layout.drawingX}" y="${layout.drawingY}" width="${layout.drawingW}" height="${layout.drawingH}" rx="12" fill="${drawingFill}" stroke="#e5e5e0"/>

  ${body()}

  <!-- Footer / title block -->
  <rect x="${MARGIN}" y="${SHEET.height - MARGIN - FOOTER_HEIGHT}" width="${SHEET.width - MARGIN * 2}" height="${FOOTER_HEIGHT}" rx="10" fill="#0a0a0a"/>
  <text x="${MARGIN + 20}" y="${SHEET.height - MARGIN - FOOTER_HEIGHT + 24}" font-size="10" font-weight="800" letter-spacing="2.6" fill="#D4AF37">PROJECT</text>
  <text x="${MARGIN + 20}" y="${SHEET.height - MARGIN - FOOTER_HEIGHT + 44}" font-size="13" font-weight="700" fill="#ffffff">${escapeXml(opts.projectName)}</text>
  <text x="${SHEET.width / 2}" y="${SHEET.height - MARGIN - FOOTER_HEIGHT + 24}" text-anchor="middle" font-size="10" font-weight="800" letter-spacing="2.6" fill="#D4AF37">MEASURED TOTALS</text>
  <text x="${SHEET.width / 2}" y="${SHEET.height - MARGIN - FOOTER_HEIGHT + 44}" text-anchor="middle" font-size="13" font-weight="700" fill="#ffffff">${totalArea.toFixed(1)} m²  ·  ${totalLength.toFixed(1)} lm  ·  ${opts.sections.length + opts.lines.length + opts.features.length} items</text>
  <text x="${SHEET.width - MARGIN - 20}" y="${SHEET.height - MARGIN - FOOTER_HEIGHT + 24}" text-anchor="end" font-size="10" font-weight="800" letter-spacing="2.6" fill="#D4AF37">SHEET</text>
  <text x="${SHEET.width - MARGIN - 20}" y="${SHEET.height - MARGIN - FOOTER_HEIGHT + 44}" text-anchor="end" font-size="13" font-weight="700" fill="#ffffff">${escapeXml(opts.jobRef)} / 01 · ${new Date().toLocaleDateString("en-GB")}</text>
</svg>`;
}

/* ------------------------------------------------------------------------ */
/* Right-hand legend                                                         */
/* ------------------------------------------------------------------------ */

type LegendArgs = {
  layout: Layout;
  theme: "light" | "dark";
  sections: RoofSurveySection[];
  lines: RoofSurveyLine[];
  features: RoofSurveyFeature[];
  totalArea: number;
  totalLength: number;
  showHatchPatterns?: boolean;
  cadLegend?: boolean;
  customerSummary?: boolean;
};

function renderLegend({ layout, sections, lines, features, totalArea, totalLength, cadLegend, customerSummary }: LegendArgs) {
  let y = layout.legendY + 28;
  const parts: string[] = [];

  parts.push(`<rect x="${layout.legendX}" y="${layout.legendY}" width="${layout.legendW}" height="${layout.legendH}" rx="12" fill="#fbfaf5" stroke="#e5e5e0"/>`);
  parts.push(`<text x="${layout.legendX + 20}" y="${y}" font-size="11" font-weight="800" letter-spacing="2.4" fill="#D4AF37">HOW TO READ THIS PLAN</text>`);
  y += 22;
  parts.push(`<text x="${layout.legendX + 20}" y="${y}" font-size="11" fill="#6b7280">Letters on the drawing match each item below.</text>`);
  y += 14;
  parts.push(`<text x="${layout.legendX + 20}" y="${y}" font-size="11" fill="#6b7280">All dimensions in metres unless noted.</text>`);
  y += 24;

  // Sections group
  if (sections.length) {
    parts.push(`<text x="${layout.legendX + 20}" y="${y}" font-size="10" font-weight="800" letter-spacing="1.6" fill="#D4AF37">ROOF AREAS</text>`);
    y += 18;
    sections.forEach((s, idx) => {
      const color = sectionColor(idx, s.color);
      const area = Number(s.area_m2 || 0);
      const label = customerSummary ? customerAreaLabel(idx) : s.label || s.type || `Area ${idx + 1}`;
      const conditionText = s.condition ? ` · ${s.condition}` : "";
      parts.push(`
        <g transform="translate(${layout.legendX + 20} ${y})">
          <circle cx="11" cy="-4" r="11" fill="${color}" stroke="#111827" stroke-width="1.2"/>
          <text x="11" y="0" text-anchor="middle" font-size="11" font-weight="800" fill="#0a0a0a">${markerCode(idx)}</text>
          <text x="32" y="-6" font-size="12" font-weight="700" fill="#111827">${escapeXml(label)}</text>
          <text x="${layout.legendW - 40}" y="-6" text-anchor="end" font-size="12" font-weight="800" fill="#111827">${area.toFixed(1)} m²</text>
          <text x="32" y="10" font-size="10" fill="#6b7280">${escapeXml(`${s.type || "Roof area"}${conditionText}`)}</text>
        </g>`);
      y += 32;
    });
    y += 8;
  }

  if (customerSummary) {
    const customerLines = lines;
    if (customerLines.length) {
      parts.push(`<text x="${layout.legendX + 20}" y="${y}" font-size="10" font-weight="800" letter-spacing="1.6" fill="#D4AF37">SELECTED ROOF LINES</text>`);
      y += 18;
      customerLines.forEach((line, idx) => {
        const color = lineColor(line, idx);
        const codeIndex = sections.length + idx;
        const code = markerCode(codeIndex);
        parts.push(`
          <g transform="translate(${layout.legendX + 20} ${y})">
            <circle cx="11" cy="-5" r="10" fill="#ffffff" stroke="${color}" stroke-width="2"/>
            <text x="11" y="-1" text-anchor="middle" font-size="9" font-weight="900" fill="${color}">${escapeXml(code)}</text>
            <rect x="28" y="-9" width="20" height="6" rx="3" fill="${color}"/>
            <text x="56" y="-3" font-size="12" font-weight="700" fill="#111827">${escapeXml(customerLineLabel(line, codeIndex))}</text>
          </g>`);
        y += 24;
      });
      y += 8;
    }

    const hiddenCount = features.length;
    if (hiddenCount > 0) {
    parts.push(`
      <g transform="translate(${layout.legendX + 20} ${y})">
        <rect x="0" y="-12" width="${layout.legendW - 40}" height="58" rx="9" fill="#fff7df" stroke="#D4AF37" stroke-opacity="0.35"/>
        <text x="14" y="6" font-size="11" font-weight="800" fill="#111827">Technical details available</text>
        <text x="14" y="24" font-size="10" fill="#6b7280">${hiddenCount} extra item${hiddenCount === 1 ? "" : "s"} are shown on the Technical Takeoff Plan.</text>
      </g>`);
    y += 78;
    }
  }

  // Lines group
  if (!customerSummary && lines.length) {
    parts.push(`<text x="${layout.legendX + 20}" y="${y}" font-size="10" font-weight="800" letter-spacing="1.6" fill="#D4AF37">RIDGES, VALLEYS &amp; EDGES</text>`);
    y += 18;
    lines.forEach((l, idx) => {
      const color = lineColor(l, idx);
      const length = Number(l.length_lm || 0);
      const label = l.label || l.type || `Line ${idx + 1}`;
      const code = markerCode(sections.length + idx);
      parts.push(`
        <g transform="translate(${layout.legendX + 20} ${y})">
          <circle cx="11" cy="-5" r="10" fill="#ffffff" stroke="${color}" stroke-width="2"/>
          <text x="11" y="-1" text-anchor="middle" font-size="9" font-weight="900" fill="${color}">${escapeXml(code)}</text>
          <rect x="28" y="-9" width="20" height="6" rx="3" fill="${color}"/>
          <text x="56" y="-3" font-size="12" font-weight="700" fill="#111827">${escapeXml(label)}</text>
          <text x="${layout.legendW - 40}" y="-3" text-anchor="end" font-size="12" font-weight="800" fill="#111827">${length.toFixed(1)} lm</text>
        </g>`);
      y += 22;
    });
    y += 8;
  }

  // Features group
  if (!customerSummary && features.length) {
    parts.push(`<text x="${layout.legendX + 20}" y="${y}" font-size="10" font-weight="800" letter-spacing="1.6" fill="#D4AF37">ROOF FEATURES</text>`);
    y += 18;
    features.forEach((f, idx) => {
      const code = markerCode(sections.length + lines.length + idx);
      parts.push(`
        <g transform="translate(${layout.legendX + 20} ${y})">
          <rect x="2" y="-12" width="18" height="18" fill="${f.color || "#fbbf24"}" stroke="#111827" stroke-width="1.2"/>
          <text x="11" y="1" text-anchor="middle" font-size="9" font-weight="900" fill="#0a0a0a">${escapeXml(code)}</text>
          <text x="32" y="0" font-size="12" font-weight="700" fill="#111827">${escapeXml(f.label || f.type || `Item ${idx + 1}`)}</text>
        </g>`);
      y += 22;
    });
  }

  // CAD legend explaining line styles
  if (cadLegend) {
    y += 12;
    parts.push(`<text x="${layout.legendX + 20}" y="${y}" font-size="10" font-weight="800" letter-spacing="1.6" fill="#D4AF37">LINE TYPE KEY</text>`);
    y += 18;
    const cadKeys = [
      { label: "Ridge (solid heavy)", dash: "", weight: 3 },
      { label: "Valley (chain)", dash: "12 4 2 4", weight: 2 },
      { label: "Flashing / abutment (dashed)", dash: "8 4", weight: 2 },
      { label: "Eaves / gutter (solid)", dash: "", weight: 2 }
    ];
    cadKeys.forEach((k) => {
      parts.push(`
        <g transform="translate(${layout.legendX + 20} ${y})">
          <path d="M0 -4 L40 -4" fill="none" stroke="#111827" stroke-width="${k.weight}" ${k.dash ? `stroke-dasharray="${k.dash}"` : ""}/>
          <text x="52" y="0" font-size="11" fill="#374151">${escapeXml(k.label)}</text>
        </g>`);
      y += 20;
    });
  }

  // Totals box at the bottom of the legend
  const totalsY = layout.legendY + layout.legendH - 100;
  parts.push(`
    <rect x="${layout.legendX + 16}" y="${totalsY}" width="${layout.legendW - 32}" height="80" rx="10" fill="#f8f0d8" stroke="#D4AF37" stroke-opacity="0.4"/>
    <text x="${layout.legendX + 28}" y="${totalsY + 22}" font-size="10" font-weight="800" letter-spacing="2" fill="#D4AF37">MEASURED TOTALS</text>
    <text x="${layout.legendX + 28}" y="${totalsY + 50}" font-size="22" font-weight="800" fill="#111827">${totalArea.toFixed(1)} m²</text>
    <text x="${layout.legendX + 28}" y="${totalsY + 70}" font-size="10" fill="#6b7280">${sections.length} areas</text>
    <text x="${layout.legendX + layout.legendW - 28}" y="${totalsY + 50}" text-anchor="end" font-size="22" font-weight="800" fill="#111827">${totalLength.toFixed(1)} lm</text>
    <text x="${layout.legendX + layout.legendW - 28}" y="${totalsY + 70}" text-anchor="end" font-size="10" fill="#6b7280">${lines.length} lines · ${features.length} features</text>
  `);

  return parts.join("\n");
}

/* ------------------------------------------------------------------------ */
/* Public entry                                                              */
/* ------------------------------------------------------------------------ */

export function buildProDrawingSvg(opts: ProDrawingOpts) {
  if (opts.style === "satellite-pro") return buildSatelliteProSvg(opts);
  if (opts.style === "schematic-cad") return buildSchematicCadSvg(opts);
  return buildDimensionedBwSvg(opts);
}

export function downloadProSvg(svg: string, filename: string) {
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".svg") ? filename : `${filename}.svg`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function downloadProPng(svg: string, filename: string, scale = 2) {
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = SHEET.width * scale;
    canvas.height = SHEET.height * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas not available");
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0);
    const pngBlob: Blob = await new Promise((resolve) => canvas.toBlob((b) => resolve(b!), "image/png"));
    const pngUrl = URL.createObjectURL(pngBlob);
    const a = document.createElement("a");
    a.href = pngUrl;
    a.download = filename.endsWith(".png") ? filename : `${filename}.png`;
    a.click();
    URL.revokeObjectURL(pngUrl);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function printProDrawing(svg: string, filename: string) {
  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(`<!DOCTYPE html><html><head><title>${escapeXml(filename)}</title>
    <style>
    @page{size:A3 landscape;margin:0}
    html,body{margin:0;width:420mm;min-height:297mm;background:#f4f1e8}
    svg{width:420mm;height:297mm;display:block}
    @media screen{body{display:flex;justify-content:center;padding:16px}svg{max-width:100%;height:auto;box-shadow:0 12px 40px rgba(0,0,0,.25)}}
    @media print{html,body{background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}svg{box-shadow:none}}
    </style>
    </head><body>${svg}</body></html>`);
  win.document.close();
  win.focus();
  window.setTimeout(() => win.print(), 400);
}
