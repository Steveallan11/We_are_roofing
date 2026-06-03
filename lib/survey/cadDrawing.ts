import type { RoofSurveyFeature, RoofSurveyLine, RoofSurveySection } from "@/lib/survey/types";

export type TakeoffDrawingStyle = "customer_quote" | "technical_satellite" | "section_detail" | "technical" | "customer" | "quote" | "satellite";
export type TakeoffDrawingFraming = "detail" | "close" | "building" | "context";

type DrawingPoint = { lat?: number; lng?: number; x?: number; y?: number };

type CustomerQuoteDrawingSection = {
  code: string;
  label: string;
  measurementLm: number;
  roofWorksLm: number;
  scaffoldLm: number;
  hasRoofWorks: boolean;
  hasScaffold: boolean;
  points: DrawingPoint[];
  lineSegments: DrawingPoint[][];
  color: string;
  notes: string[];
};

export type DrawingQuoteSection = {
  code: string;
  label: string;
  measurement?: string;
  roofNet?: number;
  accessNet?: number;
  vat?: number;
  total?: number;
};

export type DrawingOpts = {
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
  staticMapFraming?: TakeoffDrawingFraming;
  googleMapsApiKey?: string;
  satelliteImageHref?: string | null;
  satelliteInsetImageHref?: string | null;
  quoteSections?: DrawingQuoteSection[];
};

const WIDTH = 1200;
const HEIGHT = 850;
const DRAWING_LEFT = 64;
const DRAWING_TOP = 118;
const DRAWING_WIDTH = 760;
const DRAWING_HEIGHT = 610;
const EXPORT_SECTION_COLORS = ["#D4AF37", "#3B82F6", "#10B981", "#F97316", "#8B5CF6", "#EF4444", "#06B6D4", "#EC4899", "#84CC16", "#F59E0B"] as const;

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
  },
  customer_quote: {
    title: "Customer Quote Roof Plan",
    subtitle: "Clean plan showing the roof sections used in your quotation",
    background: "#fffdf7",
    stroke: "#1f2937",
    soft: "#efe6cf"
  },
  technical_satellite: {
    title: "Technical Satellite Takeoff Plan",
    subtitle: "Full measured takeoff with all areas, lines, and roof details",
    background: "#fffdf7",
    stroke: "#1f2937",
    soft: "#efe6cf"
  },
  section_detail: {
    title: "Section Detail Roof Plan",
    subtitle: "Close-up detail for one quoted roof section",
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
  const satelliteStyle = opts.style === "satellite" || opts.style === "customer_quote" || opts.style === "technical_satellite" || opts.style === "section_detail";
  const customerQuotePlan = opts.style === "customer_quote" || opts.style === "section_detail";
  const customerQuoteSections = buildCustomerQuoteSections(opts);
  const customerQuoteMapData = customerQuoteSectionsToMapData(customerQuoteSections);
  const mapSource = customerQuotePlan ? customerQuoteMapData : opts;
  const satelliteUrl = satelliteStyle ? opts.satelliteImageHref || (opts.googleMapsApiKey ? buildStaticMapUrl(mapSource, opts.googleMapsApiKey, opts.staticMapFraming) : null) : null;
  const satelliteInsetUrl = satelliteStyle ? opts.satelliteInsetImageHref || (opts.googleMapsApiKey ? buildStaticMapUrl(opts, opts.googleMapsApiKey, "context") : null) : null;
  const useStaticMapGeometry = Boolean(satelliteUrl);
  const text = dark ? "#f8f5e8" : "#111827";
  const muted = dark ? "#b7aa82" : "#6b7280";
  const gold = "#D4AF37";
  const totalArea = opts.sections.reduce((sum, section) => sum + Number(section.area_m2 || 0), 0);
  const totalLength = opts.lines.reduce((sum, line) => sum + Number(line.length_lm || 0), 0);
  const customerPlan = opts.style === "satellite" || customerQuotePlan;
  const orderedCustomerLines = customerPlan ? orderCustomerLines(opts.lines) : opts.lines;

  const sectionShapes = useStaticMapGeometry
    ? ""
    : opts.sections
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

  const lineShapes = useStaticMapGeometry
    ? ""
    : opts.lines
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

  const featureShapes = useStaticMapGeometry
    ? ""
    : opts.features
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

  const mapCode = opts.style === "satellite" ? sectionMarkerLabel : (index: number) => `L${index + 1}`;
  const legendRows = [
    ...opts.sections.map((section, index) => ({ color: exportSectionColor(index, section.color), code: opts.style === "satellite" ? sectionMarkerLabel(index) : `S${index + 1}`, label: section.label || section.type, value: `${Number(section.area_m2 || 0).toFixed(1)} m2` })),
    ...orderedCustomerLines.map((line, index) => ({ color: exportLineColor(index, line), code: mapCode(opts.sections.length + index), label: line.label || line.type, value: `${Number(line.length_lm || 0).toFixed(1)} lm` })),
    ...opts.features.map((feature, index) => ({ color: feature.color || gold, code: opts.style === "satellite" ? sectionMarkerLabel(opts.sections.length + opts.lines.length + index) : `I${index + 1}`, label: feature.label || feature.type, value: "1 no." }))
  ];

  const legend = legendRows
    .slice(0, 20)
    .map(
      (row, index) => `
        <g transform="translate(870 ${188 + index * 24})">
          <rect x="0" y="-10" width="12" height="12" rx="2" fill="${row.color}" />
          <text x="20" y="0" class="legend-code">${escapeXml(row.code)}</text>
          <text x="52" y="0" class="legend-text">${escapeXml(row.label || "Item")}</text>
          <text x="250" y="0" text-anchor="end" class="legend-value">${escapeXml(row.value)}</text>
        </g>`
    )
    .join("");
  const quoteRows = (opts.quoteSections || []).filter((row) => row.label.trim()).slice(0, 11);
  const quoteLegend = quoteRows
    .map((row, index) => {
      const y = 170 + index * 44;
      const detailParts = [
        typeof row.roofNet === "number" ? `Roof ${formatMoney(row.roofNet)}` : null,
        typeof row.accessNet === "number" ? `Access ${formatMoney(row.accessNet)}` : null,
        typeof row.vat === "number" ? `VAT ${formatMoney(row.vat)}` : null
      ].filter(Boolean);
      const detail = detailParts.length ? detailParts.join(" | ") : row.measurement || "Quote-linked takeoff section";
      return `
        <g transform="translate(870 ${y})">
          <rect x="0" y="-13" width="34" height="22" rx="7" fill="${gold}" />
          <text x="17" y="1" text-anchor="middle" class="quote-code">${escapeXml(row.code)}</text>
          <text x="44" y="-1" class="quote-label">${escapeXml(row.label)}</text>
          <text x="44" y="17" class="quote-detail">${escapeXml(detail)}</text>
          ${typeof row.total === "number" ? `<text x="250" y="-1" text-anchor="end" class="quote-total">${escapeXml(formatMoney(row.total))}</text>` : ""}
        </g>`;
    })
    .join("");
  const satelliteWarning =
    opts.style === "satellite" && !satelliteUrl
      ? `<text x="${DRAWING_LEFT + 28}" y="${DRAWING_TOP + 48}" class="satellite-warning">Satellite image unavailable - enable Maps Static API and check NEXT_PUBLIC_GOOGLE_MAPS_API_KEY.</text>`
      : "";

  const notes = wrapText(opts.notes || "No additional takeoff notes captured.", 92)
    .slice(0, 3)
    .map((line, index) => `<text x="64" y="${780 + index * 18}" class="notes-text">${escapeXml(line)}</text>`)
    .join("");
  const customerScheduleRows = customerQuotePlan ? buildCustomerQuoteScheduleRows(customerQuoteSections) : buildCustomerScheduleRows(legendRows);
  const customerTitle = customerQuotePlan ? "Customer Quote Roof Plan" : "Customer Roof Measurement Plan";
  const customerSubtitle = customerQuotePlan ? "Lettered sections match the quotation" : "Numbered roof sections used to prepare your quotation";
  const customerPanelTitle = customerQuotePlan ? "Your quoted roof sections" : "How to read this plan";
  const customerPanelLine1 = customerQuotePlan ? "Each marker is one quoted work section." : "Markers on the roof match the groups below.";
  const customerPanelLine2 = customerQuotePlan ? "Roof works and scaffold/access are grouped together." : "Prices are shown in the quotation, not on this drawing.";

  if (customerPlan) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <style>
    .eyebrow{font:700 11px Montserrat,Arial,sans-serif;letter-spacing:2.6px;text-transform:uppercase;fill:${gold}}
    .title{font:700 31px Georgia,serif;fill:${text}}
    .subtitle,.meta,.notes-text{font:500 13px Montserrat,Arial,sans-serif;fill:${muted}}
    .panel-title{font:800 12px Montserrat,Arial,sans-serif;letter-spacing:2px;text-transform:uppercase;fill:${gold}}
    .panel-helper{font:600 11px Montserrat,Arial,sans-serif;fill:${muted}}
    .customer-group{font:900 10px Montserrat,Arial,sans-serif;letter-spacing:1.5px;text-transform:uppercase;fill:${gold}}
    .customer-code{font:900 10px Montserrat,Arial,sans-serif;fill:#fff}
    .customer-label{font:800 12px Montserrat,Arial,sans-serif;fill:${text}}
    .customer-value{font:900 12px Montserrat,Arial,sans-serif;fill:${text}}
    .customer-note{font:600 10px Montserrat,Arial,sans-serif;fill:${muted}}
    .total-value{font:800 24px Montserrat,Arial,sans-serif;fill:${text}}
    .small-label{font:800 10px Montserrat,Arial,sans-serif;letter-spacing:1.5px;text-transform:uppercase;fill:${gold}}
    .satellite-warning{font:800 14px Montserrat,Arial,sans-serif;fill:#b45309;paint-order:stroke;stroke:#fff;stroke-width:5px;stroke-linejoin:round}
  </style>
  <defs>
    <clipPath id="mainClip"><rect x="64" y="154" width="742" height="520" rx="18" /></clipPath>
    <clipPath id="insetClip"><rect x="64" y="704" width="250" height="94" rx="14" /></clipPath>
  </defs>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="${style.background}" />
  <rect x="32" y="32" width="${WIDTH - 64}" height="${HEIGHT - 64}" rx="24" fill="#fff" stroke="${style.soft}" />
  <text x="64" y="74" class="eyebrow">We Are Roofing UK Ltd</text>
  <text x="64" y="110" class="title">${escapeXml(customerTitle)}</text>
  <text x="64" y="136" class="subtitle">${escapeXml(customerSubtitle)}</text>
  <text x="64" y="164" class="meta">${escapeXml(opts.jobRef)} - ${escapeXml(opts.address)}</text>

  <rect x="64" y="154" width="742" height="520" rx="18" fill="#fbfaf5" stroke="${style.soft}" />
  ${
    satelliteUrl
      ? `<image href="${escapeXml(satelliteUrl)}" x="64" y="154" width="742" height="520" preserveAspectRatio="xMidYMid slice" clip-path="url(#mainClip)" opacity="0.94" />
  <rect x="64" y="154" width="742" height="520" rx="18" fill="rgba(0,0,0,0.04)" stroke="${style.soft}" />`
      : gridLines(false)
  }
  ${
    satelliteUrl
      ? ""
      : `<text x="92" y="204" class="satellite-warning">Satellite image unavailable - enable Maps Static API and check NEXT_PUBLIC_GOOGLE_MAPS_API_KEY.</text>`
  }
  <text x="84" y="642" class="small-label">${customerQuotePlan ? "Clean quote section plan" : "Close roof detail"}</text>

  <rect x="828" y="154" width="308" height="520" rx="18" fill="#fbfaf5" stroke="${style.soft}" />
  <text x="848" y="186" class="panel-title">${escapeXml(customerPanelTitle)}</text>
  <text x="848" y="208" class="panel-helper">${escapeXml(customerPanelLine1)}</text>
  <text x="848" y="226" class="panel-helper">${escapeXml(customerPanelLine2)}</text>
  ${customerScheduleRows || `<text x="848" y="258" class="subtitle">No measured items yet.</text>`}

  <rect x="64" y="704" width="250" height="94" rx="14" fill="#fbfaf5" stroke="${style.soft}" />
  ${
    satelliteInsetUrl
      ? `<image href="${escapeXml(satelliteInsetUrl)}" x="64" y="704" width="250" height="94" preserveAspectRatio="xMidYMid slice" clip-path="url(#insetClip)" opacity="0.92" />
  <rect x="64" y="704" width="250" height="94" rx="14" fill="rgba(0,0,0,0.04)" stroke="${style.soft}" />`
      : ""
  }
  <text x="80" y="786" class="small-label">Wider site context</text>

  <rect x="338" y="704" width="468" height="94" rx="14" fill="#fbfaf5" stroke="${style.soft}" />
  <text x="358" y="732" class="panel-title">Customer note</text>
  <text x="358" y="756" class="panel-helper">${customerQuotePlan ? "This plan is simplified so customers can follow the quoted sections." : "The numbered sections on this plan match the quotation sections."}</text>
  <text x="358" y="774" class="panel-helper">Scaffold/access and final prices are confirmed in the quote document.</text>

  <rect x="828" y="704" width="308" height="94" rx="14" fill="#f8f0d8" stroke="${gold}" stroke-opacity="0.35" />
  <text x="848" y="732" class="panel-title">${customerQuotePlan ? "Quote sections" : "Measured totals"}</text>
  <text x="848" y="765" class="total-value">${customerQuotePlan ? customerQuoteSections.length : totalArea.toFixed(1)}</text>
  <text x="986" y="765" class="total-value">${customerQuotePlan ? `${customerQuoteSections.reduce((sum, section) => sum + section.measurementLm, 0).toFixed(0)} lm` : `${totalLength.toFixed(1)} lm`}</text>
  <text x="848" y="787" class="panel-helper">${customerQuotePlan ? "Clean customer view - technical takeoff available separately" : `${opts.sections.length} area(s), ${opts.lines.length} line(s), ${opts.features.length} item(s)`}</text>
  <text x="64" y="834" class="meta">Customer: ${escapeXml(opts.customerName || "Not set")} - Survey date: ${escapeXml(opts.surveyDate)}</text>
</svg>`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <style>
    .eyebrow{font:700 11px Montserrat,Arial,sans-serif;letter-spacing:2.6px;text-transform:uppercase;fill:${gold}}
    .title{font:700 32px Georgia,serif;fill:${text}}
    .subtitle,.meta,.legend-text,.notes-text{font:500 13px Montserrat,Arial,sans-serif;fill:${muted}}
    .legend-value{font:700 13px Montserrat,Arial,sans-serif;fill:${text}}
    .legend-code{font:800 12px Montserrat,Arial,sans-serif;fill:${gold}}
    .quote-code{font:900 10px Montserrat,Arial,sans-serif;fill:#000}
    .quote-label{font:800 12px Montserrat,Arial,sans-serif;fill:${text}}
    .quote-detail{font:600 10px Montserrat,Arial,sans-serif;fill:${muted}}
    .quote-total{font:900 12px Montserrat,Arial,sans-serif;fill:${gold}}
    .panel-helper{font:600 10px Montserrat,Arial,sans-serif;fill:${muted}}
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
  <text x="870" y="148" class="panel-title">${quoteRows.length ? "Quote Sections" : "Colour Key"}</text>
  ${quoteRows.length ? "" : `<text x="870" y="166" class="panel-helper">Numbers on the roof match this list.</text>`}
  ${quoteRows.length ? quoteLegend : legend || `<text x="870" y="178" class="subtitle">No measured items yet.</text>`}
  <rect x="850" y="704" width="286" height="74" rx="18" fill="${dark ? "#201b0f" : "#f8f0d8"}" stroke="${gold}" stroke-opacity="0.35" />
  <text x="870" y="733" class="panel-title">Totals</text>
  <text x="870" y="764" class="total-value">${totalArea.toFixed(1)} m2</text>
  <text x="1010" y="764" class="total-value">${totalLength.toFixed(1)} lm</text>
  <text x="64" y="758" class="panel-title">Takeoff Notes</text>
  ${notes}
  <text x="64" y="834" class="meta">Customer: ${escapeXml(opts.customerName || "Not set")} - Survey date: ${escapeXml(opts.surveyDate)}</text>
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

export function buildStaticMapUrl(opts: Pick<DrawingOpts, "sections" | "lines" | "features">, apiKey: string, framing: TakeoffDrawingFraming = "building") {
  const coords = allPoints(opts).map(toCoord).filter(Boolean) as Array<{ lat: number; lng: number }>;
  const cropCoords = primaryCropPoints(opts);
  const bounds = getGeoBounds(cropCoords.length ? cropCoords : coords);
  const crop = framingConfig(framing);
  const croppedBounds = bounds ? expandGeoBoundsByMeters(bounds, crop.paddingMeters) : null;
  const center = bounds ? geoBoundsCenter(bounds) : null;
  const zoom = croppedBounds ? getStaticMapZoom(croppedBounds, 640, 514, crop.zoomBoost) : null;
  const orderedLines = orderCustomerLines(opts.lines);
  const params = new URLSearchParams({
    key: apiKey,
    maptype: "satellite",
    size: "640x514",
    scale: "2",
    format: "jpg"
  });

  if (center && zoom != null) {
    params.set("center", `${center.lat},${center.lng}`);
    params.set("zoom", String(zoom));
  }

  opts.sections.slice(0, 10).forEach((section, index) => {
    const coords = section.points.map(toCoord).filter(Boolean).slice(0, 24) as Array<{ lat: number; lng: number }>;
    if (coords.length < 3) return;
    const color = staticMapColor(exportSectionColor(index, section.color));
    const path = [`color:0x${color}ff`, `fillcolor:0x${color}88`, "weight:5", ...coords.map((point) => `${point.lat},${point.lng}`), `${coords[0].lat},${coords[0].lng}`].join("|");
    params.append("path", path);
    const centre = geoCentroid(coords);
    params.append("markers", `color:0x${color}|label:${sectionMarkerLabel(index)}|${centre.lat},${centre.lng}`);
  });

  orderedLines.slice(0, 16).forEach((line, index) => {
    const coords = line.points.map(toCoord).filter(Boolean).slice(0, 24) as Array<{ lat: number; lng: number }>;
    if (coords.length < 2) return;
    const color = staticMapColor(exportLineColor(index, line));
    const isCustomerQuoteLine = line.type === "Customer Quote Section";
    params.append("path", [`color:0x${color}${isCustomerQuoteLine ? "cc" : "ff"}`, `weight:${isCustomerQuoteLine ? 3 : 5}`, ...coords.map((point) => `${point.lat},${point.lng}`)].join("|"));
    const mid = geoMidpoint(coords);
    const markerLabel = isCustomerQuoteLine ? quoteSectionMarkerLabel(index) : sectionMarkerLabel(opts.sections.length + index);
    params.append("markers", `color:0x${color}|label:${markerLabel}|${mid.lat},${mid.lng}`);
  });

  opts.features.slice(0, 12).forEach((feature, index) => {
    const point = toCoord(feature.point);
    if (!point) return;
    params.append("markers", `color:yellow|label:${sectionMarkerLabel(opts.sections.length + opts.lines.length + index)}|${point.lat},${point.lng}`);
  });

  return `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`;
}

export function buildDrawingStaticMapUrl(opts: DrawingOpts, apiKey: string, framing: TakeoffDrawingFraming = "building") {
  const customerQuotePlan = opts.style === "customer_quote" || opts.style === "section_detail";
  const mapSource = customerQuotePlan ? customerQuoteSectionsToMapData(buildCustomerQuoteSections(opts)) : opts;
  return buildStaticMapUrl(mapSource, apiKey, framing);
}

function staticMapColor(value: string) {
  const clean = value.replace("#", "").trim();
  return /^[0-9a-fA-F]{6}$/.test(clean) ? clean : "D4AF37";
}

function exportSectionColor(index: number, fallback?: string | null) {
  const paletteColor = EXPORT_SECTION_COLORS[index % EXPORT_SECTION_COLORS.length];
  const clean = fallback?.replace("#", "").trim();
  if (!clean || clean.toUpperCase() === "D4AF37") return paletteColor;
  return /^[0-9a-fA-F]{6}$/.test(clean) ? `#${clean}` : paletteColor;
}

function exportLineColor(index: number, line: RoofSurveyLine) {
  const label = `${line.label || ""} ${line.type || ""}`.toLowerCase();
  if (label.includes("ridge")) return "#3B82F6";
  if (label.includes("valley")) return "#8B5CF6";
  if (label.includes("scaffold") || label.includes("access")) return "#10B981";
  if (label.includes("problem") || label.includes("repair") || label.includes("leak")) return "#EF4444";
  if (label.includes("section")) return EXPORT_SECTION_COLORS[index % EXPORT_SECTION_COLORS.length];
  return line.color || EXPORT_SECTION_COLORS[index % EXPORT_SECTION_COLORS.length];
}

function framingConfig(framing: TakeoffDrawingFraming) {
  if (framing === "detail") return { paddingMeters: 5, zoomBoost: 2 };
  if (framing === "close") return { paddingMeters: 4, zoomBoost: 2 };
  if (framing === "context") return { paddingMeters: 28, zoomBoost: -1 };
  return { paddingMeters: 8, zoomBoost: 1 };
}

function getGeoBounds(points: Array<{ lat: number; lng: number }>) {
  if (!points.length) return null;
  return {
    north: Math.max(...points.map((point) => point.lat)),
    south: Math.min(...points.map((point) => point.lat)),
    east: Math.max(...points.map((point) => point.lng)),
    west: Math.min(...points.map((point) => point.lng))
  };
}

function primaryCropPoints(opts: Pick<DrawingOpts, "sections" | "lines" | "features">) {
  const sectionPoints = opts.sections.flatMap((section) => section.points).map(toCoord).filter(Boolean) as Array<{ lat: number; lng: number }>;
  if (sectionPoints.length) return sectionPoints;

  const linePoints = opts.lines.flatMap((line) => line.points).map(toCoord).filter(Boolean) as Array<{ lat: number; lng: number }>;
  if (linePoints.length) return linePoints;

  return opts.features.map((feature) => toCoord(feature.point)).filter(Boolean) as Array<{ lat: number; lng: number }>;
}

function expandGeoBoundsByMeters(bounds: NonNullable<ReturnType<typeof getGeoBounds>>, metres: number) {
  const center = geoBoundsCenter(bounds);
  const latPadding = metres / 111_320;
  const lngPadding = metres / Math.max(111_320 * Math.cos((center.lat * Math.PI) / 180), 1);

  return {
    north: bounds.north + latPadding,
    south: bounds.south - latPadding,
    east: bounds.east + lngPadding,
    west: bounds.west - lngPadding
  };
}

function geoBoundsCenter(bounds: NonNullable<ReturnType<typeof getGeoBounds>>) {
  return {
    lat: (bounds.north + bounds.south) / 2,
    lng: (bounds.east + bounds.west) / 2
  };
}

function getStaticMapZoom(bounds: NonNullable<ReturnType<typeof getGeoBounds>>, width: number, height: number, boost = 0) {
  const lngSpan = Math.max(Math.abs(bounds.east - bounds.west), 0.00001);
  const latFraction = Math.max(Math.abs(latRad(bounds.north) - latRad(bounds.south)), 0.00001);
  const lngZoom = Math.floor(Math.log2(width / 256 / (lngSpan / 360)));
  const latZoom = Math.floor(Math.log2(height / 256 / latFraction));
  return Math.max(18, Math.min(22, Math.min(lngZoom, latZoom) + boost));
}

function latRad(lat: number) {
  const sin = Math.sin((lat * Math.PI) / 180);
  return Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI);
}

function geoCentroid(points: Array<{ lat: number; lng: number }>) {
  return {
    lat: points.reduce((sum, point) => sum + point.lat, 0) / points.length,
    lng: points.reduce((sum, point) => sum + point.lng, 0) / points.length
  };
}

function geoMidpoint(points: Array<{ lat: number; lng: number }>) {
  return points[Math.floor(points.length / 2)] ?? points[0];
}

function sectionMarkerLabel(index: number) {
  return index < 9 ? String(index + 1) : String.fromCharCode(65 + Math.min(index - 9, 25));
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

function customerRowDescription(label: string) {
  const clean = label.trim();
  if (!clean) return "Measured quote section";
  if (clean.toLowerCase().includes("ridge")) return "Ridge/run measurement";
  if (clean.toLowerCase().includes("valley")) return "Valley/detail measurement";
  if (clean.toLowerCase().includes("scaffold") || clean.toLowerCase().includes("access")) return "Access/scaffold reference";
  if (clean.toLowerCase().includes("roof work")) return "Roof works measurement";
  if (clean.toLowerCase().includes("section")) return "Measured quote section";
  return "Measured roof item";
}

function buildCustomerScheduleRows(rows: Array<{ color: string; code: string; label?: string; value: string }>) {
  const groups = [
    { key: "section", title: "Roof work sections", rows: rows.filter((row) => customerRowGroup(row.label || "") === "section") },
    { key: "scaffold", title: "Scaffold / access lines", rows: rows.filter((row) => customerRowGroup(row.label || "") === "scaffold") },
    { key: "ridge", title: "Ridge runs", rows: rows.filter((row) => customerRowGroup(row.label || "") === "ridge") },
    { key: "detail", title: "Other measured details", rows: rows.filter((row) => customerRowGroup(row.label || "") === "detail") }
  ].filter((group) => group.rows.length);
  const output: string[] = [];
  let y = 252;
  let shown = 0;
  const maxRows = 12;

  groups.forEach((group) => {
    if (shown >= maxRows) return;
    output.push(`<text x="848" y="${y}" class="customer-group">${escapeXml(group.title)}</text>`);
    y += 22;
    group.rows.forEach((row) => {
      if (shown >= maxRows) return;
      output.push(`
        <g transform="translate(842 ${y})">
          <circle cx="13" cy="-5" r="10" fill="${row.color}" stroke="#111827" stroke-width="1.3" />
          <text x="13" y="-1" text-anchor="middle" class="customer-code">${escapeXml(row.code)}</text>
          <text x="32" y="-7" class="customer-label">${escapeXml(truncateText(row.label || "Measured section", 26))}</text>
          <text x="264" y="-7" text-anchor="end" class="customer-value">${escapeXml(row.value)}</text>
          <text x="32" y="10" class="customer-note">${escapeXml(truncateText(customerRowDescription(row.label || "Measured item"), 34))}</text>
        </g>`);
      y += 28;
      shown += 1;
    });
    y += 6;
  });

  if (rows.length > shown) {
    output.push(`<text x="848" y="650" class="customer-note">+ ${rows.length - shown} more item(s) on the technical takeoff plan</text>`);
  }

  return output.join("");
}

function buildCustomerQuoteScheduleRows(sections: CustomerQuoteDrawingSection[]) {
  const maxRows = 12;
  const visibleSections = sections.slice(0, maxRows);
  const rows = visibleSections
    .map((section, index) => {
      const y = 256 + index * 32;
      const roofMeasurement = section.roofWorksLm > 0 ? `Roof works ${formatLinearMetres(section.roofWorksLm)}` : null;
      const scaffoldMeasurement = section.scaffoldLm > 0 ? `Scaffold/access ${formatLinearMetres(section.scaffoldLm)}` : null;
      const scope = [roofMeasurement, scaffoldMeasurement].filter(Boolean).join("  |  ") || "No drawing marker yet";

      return `
        <g transform="translate(842 ${y})">
          <circle cx="16" cy="-7" r="12" fill="${section.color}" stroke="#111827" stroke-width="1.5" />
          <text x="16" y="-2" text-anchor="middle" class="customer-code">${escapeXml(section.code)}</text>
          <text x="48" y="-9" class="customer-label">${escapeXml(truncateText(section.label, 25))}</text>
          <text x="48" y="8" class="customer-note">${escapeXml(truncateText(scope, 38))}</text>
        </g>`;
    })
    .join("");

  if (sections.length <= maxRows) return rows;
  return `${rows}<text x="848" y="650" class="customer-note">+ ${sections.length - maxRows} more section(s) on the technical takeoff plan</text>`;
}

function buildCustomerQuoteSections(opts: Pick<DrawingOpts, "sections" | "lines" | "features" | "quoteSections">): CustomerQuoteDrawingSection[] {
  const groups = new Map<string, Omit<CustomerQuoteDrawingSection, "code">>();

  opts.lines.forEach((line, index) => {
    const label = customerQuoteSectionLabel(line.label || line.type || `Section ${index + 1}`);
    const existing = groups.get(label) ?? {
      label,
      measurementLm: 0,
      roofWorksLm: 0,
      scaffoldLm: 0,
      hasRoofWorks: false,
      hasScaffold: false,
      points: [] as DrawingPoint[],
      lineSegments: [] as DrawingPoint[][],
      color: exportLineColor(groups.size, line),
      notes: [] as string[]
    };
    const identity = `${line.type || ""} ${line.label || ""}`.toLowerCase();
    existing.hasScaffold ||= identity.includes("scaffold") || identity.includes("access");
    existing.hasRoofWorks ||= identity.includes("roof work") || identity.includes("roof works") || identity.includes("section");
    existing.measurementLm += Number(line.length_lm || 0);
    if (identity.includes("scaffold") || identity.includes("access")) {
      existing.scaffoldLm += Number(line.length_lm || 0);
    } else if (identity.includes("roof work") || identity.includes("roof works") || identity.includes("section")) {
      existing.roofWorksLm += Number(line.length_lm || 0);
    }
    existing.points.push(...line.points);
    if (line.points.length >= 2) existing.lineSegments.push(line.points);
    if (line.notes) existing.notes.push(line.notes);
    groups.set(label, existing);
  });

  opts.sections.forEach((section) => {
    const label = customerQuoteSectionLabel(section.label || section.type || "Roof Section");
    const existing = groups.get(label) ?? {
      label,
      measurementLm: 0,
      roofWorksLm: 0,
      scaffoldLm: 0,
      hasRoofWorks: true,
      hasScaffold: false,
      points: [] as DrawingPoint[],
      lineSegments: [] as DrawingPoint[][],
      color: section.color || EXPORT_SECTION_COLORS[groups.size % EXPORT_SECTION_COLORS.length],
      notes: [] as string[]
    };
    existing.hasRoofWorks = true;
    existing.points.push(...section.points);
    if (section.notes) existing.notes.push(section.notes);
    groups.set(label, existing);
  });

  (opts.quoteSections || []).forEach((quoteSection) => {
    const label = customerQuoteSectionLabel(quoteSection.label || "Quoted Section");
    if (groups.has(label)) return;
    groups.set(label, {
      label,
      measurementLm: 0,
      roofWorksLm: 0,
      scaffoldLm: 0,
      hasRoofWorks: typeof quoteSection.roofNet === "number" && quoteSection.roofNet > 0,
      hasScaffold: typeof quoteSection.accessNet === "number" && quoteSection.accessNet > 0,
      points: [],
      lineSegments: [],
      color: EXPORT_SECTION_COLORS[groups.size % EXPORT_SECTION_COLORS.length],
      notes: []
    });
  });

  return [...groups.values()]
    .sort((left, right) => naturalLabelCompare(left.label, right.label))
    .map((section, index) => ({ ...section, code: quoteSectionMarkerLabel(index) }));
}

function customerQuoteSectionsToMapData(sections: CustomerQuoteDrawingSection[]): Pick<DrawingOpts, "sections" | "lines" | "features"> {
  return {
    sections: [],
    lines: sections
      .map((section) => ({ section, anchor: customerQuoteAnchorSegment(section) }))
      .filter((item) => item.anchor.length >= 2)
      .map(({ section, anchor }) => ({
          id: section.label,
          label: section.label,
          type: "Customer Quote Section",
          color: section.color,
          points: anchor.map(toSurveyPoint),
          length_lm: section.measurementLm,
          notes: section.notes.join("\n")
        })),
    features: []
  };
}

function customerQuoteAnchorSegment(section: CustomerQuoteDrawingSection) {
  if (section.lineSegments.length) {
    return [...section.lineSegments].sort((left, right) => drawingPointSpan(right) - drawingPointSpan(left))[0];
  }
  return section.points;
}

function drawingPointSpan(points: DrawingPoint[]) {
  const coords = points.map(toCoord).filter(Boolean) as Array<{ lat: number; lng: number }>;
  if (coords.length < 2) return 0;
  const bounds = getGeoBounds(coords);
  if (!bounds) return 0;
  return Math.abs(bounds.north - bounds.south) + Math.abs(bounds.east - bounds.west);
}

function toSurveyPoint(point: DrawingPoint) {
  const coord = toCoord(point) ?? { lat: 0, lng: 0 };
  return { x: coord.lng, y: coord.lat, lat: coord.lat, lng: coord.lng };
}

function customerQuoteSectionLabel(value: string) {
  const clean = value
    .replace(/\s*[-–—]\s*(roof\s*works?|roof\s*work\s*section|scaffold\s*\/?\s*access|access|scaffold)\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
  return clean || "General Works";
}

function quoteSectionMarkerLabel(index: number) {
  return String.fromCharCode(65 + Math.min(index, 25));
}

function truncateText(value: string, max: number) {
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length <= max ? clean : `${clean.slice(0, Math.max(0, max - 1)).trimEnd()}...`;
}

function formatLinearMetres(value: number) {
  return `${value.toFixed(value >= 10 ? 0 : 1)} lm`;
}

function customerRowGroup(label: string) {
  const clean = label.toLowerCase();
  if (clean.includes("scaffold") || clean.includes("access")) return "scaffold";
  if (clean.includes("ridge")) return "ridge";
  if (clean.includes("roof work") || clean.includes("section") || clean.includes("eaves") || clean.includes("verge")) return "section";
  return "detail";
}

function orderCustomerLines(lines: RoofSurveyLine[]) {
  return [...lines].sort((a, b) => {
    const groupDelta = customerLineSortOrder(a) - customerLineSortOrder(b);
    if (groupDelta !== 0) return groupDelta;
    return naturalLabelCompare(a.label || a.type || "", b.label || b.type || "");
  });
}

function customerLineSortOrder(line: RoofSurveyLine) {
  const label = `${line.label || ""} ${line.type || ""}`.toLowerCase();
  if (label.includes("scaffold") || label.includes("access")) return 2;
  if (label.includes("section") || label.includes("eaves") || label.includes("verge") || label.includes("roof work")) return 1;
  if (label.includes("ridge")) return 3;
  if (label.includes("valley") || label.includes("hip")) return 4;
  return 5;
}

function naturalLabelCompare(a: string, b: string) {
  return a.localeCompare(b, "en-GB", { numeric: true, sensitivity: "base" });
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

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(value);
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
