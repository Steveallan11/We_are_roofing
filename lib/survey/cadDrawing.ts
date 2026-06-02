import type { RoofSurveyFeature, RoofSurveyLine, RoofSurveySection } from "@/lib/survey/types";

export type TakeoffDrawingStyle = "technical" | "customer" | "quote" | "satellite";

type DrawingPoint = { lat?: number; lng?: number; x?: number; y?: number };

type DrawingOpts = {
  projectName: string;
  jobRef: string;
  address: string;
  customerName?: string;
  surveyDate: string;
  notes?: string;
  sections: RoofSurveySection[];
  lines: RoofSurveyLine[];
  features: RoofSurveyFeature[];
  style: TakeoffDrawingStyle;
  googleMapsApiKey?: string;
  satelliteImageHref?: string | null;
};

const WIDTH = 1200;
const HEIGHT = 850;
const DRAWING_LEFT = 64;
const DRAWING_TOP = 118;
const DRAWING_WIDTH = 760;
const DRAWING_HEIGHT = 610;

const STYLE_COPY: Record<TakeoffDrawingStyle, { title: string; subtitle: string; background: string; stroke: string; soft: string }> = {
  technical: {
    title: "Technical Takeoff Drawing",
    subtitle: "Measured schematic generated from Google Maps roof takeoff geometry",
    background: "#f8f7f2",
    stroke: "#111827",
    soft: "#e5dfcf"
  },
  customer: {
    title: "Customer Roof Sketch",
    subtitle: "Clear roof sketch showing measured areas, runs, and roof details",
    background: "#fffdf7",
    stroke: "#1f2937",
    soft: "#efe6cf"
  },
  quote: {
    title: "Quote Sketch",
    subtitle: "Quote-ready marked drawing for scope and pricing review",
    background: "#0b0b0b",
    stroke: "#f8f5e8",
    soft: "#2a2415"
  },
  satellite: {
    title: "Customer Satellite Roof Plan",
    subtitle: "Satellite roof plan with measured sections, runs, and roof details",
    background: "#fffdf7",
    stroke: "#1f2937",
    soft: "#efe6cf"
  }
};

export function buildTakeoffDrawingSvg(opts: DrawingOpts) {
  const points = allPoints(opts);
  const bounds = getBounds(points);
  const project = makeProjector(bounds);
  const style = STYLE_COPY[opts.style];
  const dark = opts.style === "quote";
  const satelliteUrl =
    opts.style === "satellite" ? opts.satelliteImageHref || (opts.googleMapsApiKey ? buildStaticMapUrl(opts, opts.googleMapsApiKey) : null) : null;
  const text = dark ? "#f8f5e8" : "#111827";
  const muted = dark ? "#b7aa82" : "#6b7280";
  const gold = "#D4AF37";
  const totalArea = opts.sections.reduce((sum, section) => sum + Number(section.area_m2 || 0), 0);
  const totalLength = opts.lines.reduce((sum, line) => sum + Number(line.length_lm || 0), 0);

  const sectionShapes = opts.sections
    .map((section, index) => {
      const coords = section.points.map(project).filter(isProjectedPoint);
      if (coords.length < 3) return "";
      const label = section.label || `Section ${index + 1}`;
      const marker = `S${index + 1}`;
      const centre = centroid(coords);
      return `
        <polygon points="${coords.map(pointString).join(" ")}" fill="${section.color || gold}" fill-opacity="${opts.style === "satellite" ? "0.38" : dark ? "0.34" : "0.22"}" stroke="${section.color || gold}" stroke-width="${opts.style === "satellite" ? "5" : "3"}" />
        <circle cx="${centre.x}" cy="${centre.y - 10}" r="19" fill="${gold}" stroke="#111827" stroke-width="2" />
        <text x="${centre.x}" y="${centre.y - 5}" text-anchor="middle" class="marker-code">${escapeXml(marker)}</text>
        <text x="${centre.x}" y="${centre.y + 20}" text-anchor="middle" class="shape-label">${escapeXml(label)}</text>
        <text x="${centre.x}" y="${centre.y + 38}" text-anchor="middle" class="shape-sub">${Number(section.area_m2 || 0).toFixed(1)} m2</text>`;
    })
    .join("");

  const lineShapes = opts.lines
    .map((line, index) => {
      const coords = line.points.map(project).filter(isProjectedPoint);
      if (coords.length < 2) return "";
      const mid = midpoint(coords);
      const label = line.label || `Line ${index + 1}`;
      return `
        <polyline points="${coords.map(pointString).join(" ")}" fill="none" stroke="${line.color || gold}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" />
        <text x="${mid.x}" y="${mid.y - 10}" text-anchor="middle" class="line-label">${escapeXml(label)} - ${Number(line.length_lm || 0).toFixed(1)} lm</text>`;
    })
    .join("");

  const featureShapes = opts.features
    .map((feature, index) => {
      const point = project(feature.point);
      if (!point) return "";
      const label = feature.label || feature.type || `Item ${index + 1}`;
      return `
        <circle cx="${point.x}" cy="${point.y}" r="13" fill="${feature.color || gold}" stroke="${dark ? "#fff" : "#111"}" stroke-width="2" />
        <text x="${point.x}" y="${point.y + 4}" text-anchor="middle" class="marker-text">${escapeXml(markerInitials(feature.type || label))}</text>
        <text x="${point.x + 18}" y="${point.y - 12}" class="feature-label">${escapeXml(label)}</text>`;
    })
    .join("");

  const legendRows = [
    ...opts.sections.map((section, index) => ({ color: section.color || gold, code: `S${index + 1}`, label: section.label || section.type, value: `${Number(section.area_m2 || 0).toFixed(1)} m2` })),
    ...opts.lines.map((line, index) => ({ color: line.color || gold, code: `L${index + 1}`, label: line.label || line.type, value: `${Number(line.length_lm || 0).toFixed(1)} lm` })),
    ...opts.features.map((feature, index) => ({ color: feature.color || gold, code: `I${index + 1}`, label: feature.label || feature.type, value: "1 no." }))
  ];

  const legend = legendRows
    .slice(0, 20)
    .map(
      (row, index) => `
        <g transform="translate(870 ${170 + index * 24})">
          <rect x="0" y="-10" width="12" height="12" rx="2" fill="${row.color}" />
          <text x="20" y="0" class="legend-code">${escapeXml(row.code)}</text>
          <text x="52" y="0" class="legend-text">${escapeXml(row.label || "Item")}</text>
          <text x="250" y="0" text-anchor="end" class="legend-value">${escapeXml(row.value)}</text>
        </g>`
    )
    .join("");
  const satelliteWarning =
    opts.style === "satellite" && !satelliteUrl
      ? `<text x="${DRAWING_LEFT + 28}" y="${DRAWING_TOP + 48}" class="satellite-warning">Satellite image unavailable - enable Maps Static API and check NEXT_PUBLIC_GOOGLE_MAPS_API_KEY.</text>`
      : "";

  const notes = wrapText(opts.notes || "No additional takeoff notes captured.", 58)
    .slice(0, 5)
    .map((line, index) => `<text x="870" y="${690 + index * 18}" class="notes-text">${escapeXml(line)}</text>`)
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <style>
    .eyebrow{font:700 11px Montserrat,Arial,sans-serif;letter-spacing:2.6px;text-transform:uppercase;fill:${gold}}
    .title{font:700 32px Georgia,serif;fill:${text}}
    .subtitle,.meta,.legend-text,.notes-text{font:500 13px Montserrat,Arial,sans-serif;fill:${muted}}
    .legend-value{font:700 13px Montserrat,Arial,sans-serif;fill:${text}}
    .legend-code{font:800 12px Montserrat,Arial,sans-serif;fill:${gold}}
    .shape-label{font:800 13px Montserrat,Arial,sans-serif;fill:${text};paint-order:stroke;stroke:${style.background};stroke-width:5px;stroke-linejoin:round}
    .shape-sub,.line-label,.feature-label{font:700 11px Montserrat,Arial,sans-serif;fill:${text};paint-order:stroke;stroke:${style.background};stroke-width:4px;stroke-linejoin:round}
    .marker-text{font:900 9px Montserrat,Arial,sans-serif;fill:#000}
    .marker-code{font:900 13px Montserrat,Arial,sans-serif;fill:#000}
    .satellite-warning{font:800 14px Montserrat,Arial,sans-serif;fill:#b45309;paint-order:stroke;stroke:#fff;stroke-width:5px;stroke-linejoin:round}
    .panel-title{font:800 12px Montserrat,Arial,sans-serif;letter-spacing:2px;text-transform:uppercase;fill:${gold}}
    .total-value{font:800 26px Montserrat,Arial,sans-serif;fill:${text}}
  </style>
  <defs>
    <clipPath id="drawingClip"><rect x="${DRAWING_LEFT}" y="${DRAWING_TOP}" width="${DRAWING_WIDTH}" height="${DRAWING_HEIGHT}" rx="18" /></clipPath>
  </defs>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="${style.background}" />
  <rect x="32" y="32" width="${WIDTH - 64}" height="${HEIGHT - 64}" rx="24" fill="${dark ? "#111" : "#fff"}" stroke="${style.soft}" />
  <text x="64" y="74" class="eyebrow">We Are Roofing UK Ltd</text>
  <text x="64" y="110" class="title">${escapeXml(style.title)}</text>
  <text x="64" y="136" class="subtitle">${escapeXml(style.subtitle)}</text>
  <text x="64" y="164" class="meta">${escapeXml(opts.jobRef)} - ${escapeXml(opts.address)}</text>
  <rect x="${DRAWING_LEFT}" y="${DRAWING_TOP}" width="${DRAWING_WIDTH}" height="${DRAWING_HEIGHT}" rx="18" fill="${dark ? "#161616" : "#fbfaf5"}" stroke="${style.soft}" />
  ${
    satelliteUrl
      ? `<image href="${escapeXml(satelliteUrl)}" x="${DRAWING_LEFT}" y="${DRAWING_TOP}" width="${DRAWING_WIDTH}" height="${DRAWING_HEIGHT}" preserveAspectRatio="xMidYMid slice" clip-path="url(#drawingClip)" opacity="0.92" />
  <rect x="${DRAWING_LEFT}" y="${DRAWING_TOP}" width="${DRAWING_WIDTH}" height="${DRAWING_HEIGHT}" rx="18" fill="rgba(0,0,0,0.08)" stroke="${style.soft}" />`
      : gridLines(dark)
  }
  ${satelliteWarning}
  <g>${sectionShapes}${lineShapes}${featureShapes}</g>
  <rect x="850" y="118" width="286" height="560" rx="18" fill="${dark ? "#161616" : "#fbfaf5"}" stroke="${style.soft}" />
  <text x="870" y="148" class="panel-title">Measured Items</text>
  ${legend || `<text x="870" y="178" class="subtitle">No measured items yet.</text>`}
  <rect x="850" y="704" width="286" height="74" rx="18" fill="${dark ? "#201b0f" : "#f8f0d8"}" stroke="${gold}" stroke-opacity="0.35" />
  <text x="870" y="733" class="panel-title">Totals</text>
  <text x="870" y="764" class="total-value">${totalArea.toFixed(1)} m2</text>
  <text x="1010" y="764" class="total-value">${totalLength.toFixed(1)} lm</text>
  <text x="64" y="760" class="panel-title">Takeoff Notes</text>
  ${notes}
  <text x="64" y="812" class="meta">Customer: ${escapeXml(opts.customerName || "Not set")} - Survey date: ${escapeXml(opts.surveyDate)}</text>
</svg>`;
}

export function downloadSvg(svg: string, filename: string) {
  downloadBlob(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }), filename.endsWith(".svg") ? filename : `${filename}.svg`);
}

export async function downloadPng(svg: string, filename: string) {
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  try {
    const image = await loadImage(url);
    const canvas = document.createElement("canvas");
    canvas.width = WIDTH * 2;
    canvas.height = HEIGHT * 2;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((png) => {
      if (png) downloadBlob(png, filename.endsWith(".png") ? filename : `${filename}.png`);
    }, "image/png");
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function printDrawing(svg: string, filename: string) {
  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(`<!DOCTYPE html><html><head><title>${escapeXml(filename)}</title><style>body{margin:0;background:#f4f1e8}svg{width:100%;height:auto;display:block}@page{size:landscape;margin:8mm}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body>${svg}</body></html>`);
  win.document.close();
  win.focus();
  window.setTimeout(() => win.print(), 400);
}

function allPoints(opts: Pick<DrawingOpts, "sections" | "lines" | "features">) {
  return [
    ...opts.sections.flatMap((section) => section.points),
    ...opts.lines.flatMap((line) => line.points),
    ...opts.features.map((feature) => feature.point)
  ];
}

function getBounds(points: DrawingPoint[]) {
  const coords = points.map(toCoord).filter(Boolean) as Array<{ lat: number; lng: number }>;
  if (!coords.length) return { north: 1, south: 0, east: 1, west: 0 };
  return {
    north: Math.max(...coords.map((point) => point.lat)),
    south: Math.min(...coords.map((point) => point.lat)),
    east: Math.max(...coords.map((point) => point.lng)),
    west: Math.min(...coords.map((point) => point.lng))
  };
}

function makeProjector(bounds: ReturnType<typeof getBounds>) {
  const lngSpan = Math.max(bounds.east - bounds.west, 0.000001);
  const latSpan = Math.max(bounds.north - bounds.south, 0.000001);
  const scale = Math.min(DRAWING_WIDTH / lngSpan, DRAWING_HEIGHT / latSpan) * 0.86;
  const shapeWidth = lngSpan * scale;
  const shapeHeight = latSpan * scale;
  const offsetX = DRAWING_LEFT + (DRAWING_WIDTH - shapeWidth) / 2;
  const offsetY = DRAWING_TOP + (DRAWING_HEIGHT - shapeHeight) / 2;

  return (point: DrawingPoint) => {
    const coord = toCoord(point);
    if (!coord) return null;
    return {
      x: offsetX + (coord.lng - bounds.west) * scale,
      y: offsetY + (bounds.north - coord.lat) * scale
    };
  };
}

function toCoord(point: DrawingPoint) {
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

function midpoint(points: Array<{ x: number; y: number }>) {
  return points[Math.floor(points.length / 2)] ?? points[0];
}

function pointString(point: { x: number; y: number }) {
  return `${point.x.toFixed(1)},${point.y.toFixed(1)}`;
}

function isProjectedPoint(point: { x: number; y: number } | null): point is { x: number; y: number } {
  return Boolean(point);
}

function gridLines(dark: boolean) {
  const stroke = dark ? "#272727" : "#eee6d3";
  const lines: string[] = [];
  for (let x = DRAWING_LEFT + 40; x < DRAWING_LEFT + DRAWING_WIDTH; x += 40) {
    lines.push(`<line x1="${x}" y1="${DRAWING_TOP}" x2="${x}" y2="${DRAWING_TOP + DRAWING_HEIGHT}" stroke="${stroke}" stroke-width="1" />`);
  }
  for (let y = DRAWING_TOP + 40; y < DRAWING_TOP + DRAWING_HEIGHT; y += 40) {
    lines.push(`<line x1="${DRAWING_LEFT}" y1="${y}" x2="${DRAWING_LEFT + DRAWING_WIDTH}" y2="${y}" stroke="${stroke}" stroke-width="1" />`);
  }
  return lines.join("");
}

export function buildStaticMapUrl(opts: Pick<DrawingOpts, "sections" | "lines" | "features">, apiKey: string) {
  const params = new URLSearchParams({
    key: apiKey,
    maptype: "satellite",
    size: "640x640",
    scale: "2",
    format: "jpg"
  });

  const visiblePoints = allPoints(opts)
    .map(toCoord)
    .filter(Boolean)
    .slice(0, 60) as Array<{ lat: number; lng: number }>;
  visiblePoints.forEach((point) => params.append("visible", `${point.lat},${point.lng}`));

  opts.sections.slice(0, 10).forEach((section) => {
    const coords = section.points.map(toCoord).filter(Boolean).slice(0, 24) as Array<{ lat: number; lng: number }>;
    if (coords.length < 3) return;
    const color = staticMapColor(section.color || "#D4AF37");
    const path = [`color:0x${color}ff`, `fillcolor:0x${color}44`, "weight:3", ...coords.map((point) => `${point.lat},${point.lng}`), `${coords[0].lat},${coords[0].lng}`].join("|");
    params.append("path", path);
  });

  opts.lines.slice(0, 12).forEach((line) => {
    const coords = line.points.map(toCoord).filter(Boolean).slice(0, 24) as Array<{ lat: number; lng: number }>;
    if (coords.length < 2) return;
    const color = staticMapColor(line.color || "#D4AF37");
    params.append("path", [`color:0x${color}ff`, "weight:4", ...coords.map((point) => `${point.lat},${point.lng}`)].join("|"));
  });

  opts.features.slice(0, 12).forEach((feature) => {
    const point = toCoord(feature.point);
    if (!point) return;
    params.append("markers", `color:yellow|label:${markerInitials(feature.type || feature.label).slice(0, 1) || "X"}|${point.lat},${point.lng}`);
  });

  return `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`;
}

function staticMapColor(value: string) {
  const clean = value.replace("#", "").trim();
  return /^[0-9a-fA-F]{6}$/.test(clean) ? clean : "D4AF37";
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

function wrapText(value: string, max: number) {
  const words = value.replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let current = "";
  words.forEach((word) => {
    if (`${current} ${word}`.trim().length > max) {
      if (current) lines.push(current);
      current = word;
      return;
    }
    current = `${current} ${word}`.trim();
  });
  if (current) lines.push(current);
  return lines.length ? lines : [value];
}

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = url;
  });
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function escapeXml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
