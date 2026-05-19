import type { RoofSurveyLine, RoofSurveySection } from "@/lib/survey/types";
import { escapeXml } from "@/lib/survey/kmlExporter";

export function generateTakeoffReportHtml(opts: {
  projectName: string;
  jobRef: string;
  address: string;
  customerName: string;
  sections: RoofSurveySection[];
  lines: RoofSurveyLine[];
  surveyDate: string;
  canvasDataUrl: string;
  scalePxPerM: number | null;
}) {
  const { projectName, jobRef, address, customerName, sections, lines, surveyDate, canvasDataUrl, scalePxPerM } = opts;
  const totalArea = sections.reduce((sum, section) => sum + (section.area_m2 || 0), 0);
  const totalLength = lines.reduce((sum, line) => sum + (line.length_lm || 0), 0);
  const warning = !scalePxPerM
    ? `<div class="warning">Scale not calibrated - measurements shown are estimates only. Set scale in the roof takeoff tool for accurate dimensions.</div>`
    : "";

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Roof Takeoff - ${escapeXml(jobRef)}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Helvetica Neue,Helvetica,Arial,sans-serif;color:#1a1a1a;background:#fff}
.header{background:#0a0a0a;padding:28px 40px 22px;position:relative}
.header:after{content:"";position:absolute;bottom:0;left:0;right:0;height:2px;background:linear-gradient(90deg,#D4AF37,transparent 60%)}
.header h1{color:#D4AF37;font-size:20px;font-family:Georgia,serif;margin:0}
.header p{color:#777;font-size:10px;letter-spacing:3px;text-transform:uppercase;margin-top:4px}
.meta{display:flex;gap:16px;flex-wrap:wrap;padding:14px 40px;background:#faf9f6;border-bottom:1px solid #e8e4da;font-size:11px;color:#777}
.meta strong{color:#1a1a1a}
.body{padding:28px 40px}
.section-head{font-size:9px;color:#D4AF37;font-weight:bold;letter-spacing:3px;text-transform:uppercase;margin:24px 0 10px;padding-bottom:4px;border-bottom:1px solid #e8e4da}
.canvas-image{width:100%;border:1px solid #e8e4da;border-radius:4px}
.warning{padding:10px 14px;background:#fff8e6;border:1px solid #f59e0b;border-left:3px solid #f59e0b;border-radius:0 4px 4px 0;font-size:11px;color:#92400e;margin-bottom:16px}
table{width:100%;border-collapse:collapse;font-size:12px}
thead tr{background:#0a0a0a}
thead th{padding:8px 12px;text-align:left;color:#D4AF37;font-size:9px;letter-spacing:2px;text-transform:uppercase}
thead th:not(:first-child),tbody td:not(:first-child),tfoot td:not(:first-child){text-align:right}
tbody tr:nth-child(even){background:#faf9f6}
tbody td{padding:9px 12px;border-bottom:1px solid #e8e4da}
tfoot td{padding:10px 12px;font-weight:bold;border-top:2px solid #1a1a1a;background:#0a0a0a;color:#fff}
tfoot td:not(:first-child){color:#D4AF37}
.totals{margin-top:24px;padding:16px 20px;background:#0a0a0a;border-radius:4px;display:flex;justify-content:space-between;align-items:center}
.label{color:#D4AF37;font-size:10px;letter-spacing:2px;text-transform:uppercase}
.value{color:#fff;font-size:22px;font-weight:bold}
.footer{background:#0a0a0a;padding:12px 40px;display:flex;justify-content:space-between;font-size:10px;color:#777}
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}@page{size:A4;margin:0}}
</style>
</head>
<body>
<div class="header"><h1>We Are Roofing UK Ltd</h1><p>Roof Takeoff Survey - ${escapeXml(projectName)}</p></div>
<div class="meta">
  <span><strong>Job Ref:</strong> ${escapeXml(jobRef)}</span>
  <span><strong>Property:</strong> ${escapeXml(address)}</span>
  <span><strong>Customer:</strong> ${escapeXml(customerName)}</span>
  <span><strong>Survey Date:</strong> ${escapeXml(surveyDate)}</span>
  <span><strong>Scale:</strong> ${scalePxPerM ? `${scalePxPerM.toFixed(1)} px/m` : "Not calibrated"}</span>
</div>
<div class="body">
${warning}
<div class="section-head">Satellite Image with Roof Survey</div>
${canvasDataUrl ? `<img src="${canvasDataUrl}" class="canvas-image" alt="Roof survey">` : `<p>No annotated image was available.</p>`}
${sections.length > 0 ? sectionsTable(sections, totalArea) : ""}
${lines.length > 0 ? linesTable(lines, totalLength) : ""}
<div class="totals">
  <div><div class="label">Total Roof Area</div><div class="value">${totalArea.toFixed(1)} m2</div></div>
  <div><div class="label">Total Linear Runs</div><div class="value">${totalLength.toFixed(1)} lm</div></div>
  <div style="color:#777;font-size:11px">${sections.length} sections - ${lines.length} lines</div>
</div>
</div>
<div class="footer"><span>We Are Roofing UK Ltd - Yateley, Hampshire - 01252 000000</span><span>Generated ${new Date().toLocaleDateString("en-GB")}</span></div>
</body>
</html>`;
}

export function printToPdf(html: string, filename: string) {
  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(html);
  win.document.title = filename;
  win.document.close();
  win.focus();
  window.setTimeout(() => win.print(), 500);
}

function sectionsTable(sections: RoofSurveySection[], totalArea: number) {
  return `<div class="section-head">Roof Sections (Areas)</div><table><thead><tr><th>#</th><th>Label</th><th>Type</th><th>Area (m2)</th><th>Condition</th><th>Notes</th></tr></thead><tbody>${sections
    .map(
      (section, index) =>
        `<tr><td>${index + 1}</td><td>${escapeXml(section.label || `Section ${index + 1}`)}</td><td>${escapeXml(section.type || "Area")}</td><td>${section.area_m2?.toFixed(1) || "-"}</td><td>${escapeXml(section.condition || "-")}</td><td>${escapeXml(section.notes || "-")}</td></tr>`
    )
    .join("")}</tbody><tfoot><tr><td colspan="3">Total</td><td>${totalArea.toFixed(1)} m2</td><td colspan="2"></td></tr></tfoot></table>`;
}

function linesTable(lines: RoofSurveyLine[], totalLength: number) {
  return `<div class="section-head">Linear Runs</div><table><thead><tr><th>#</th><th>Label</th><th>Type</th><th>Length (lm)</th><th>Notes</th></tr></thead><tbody>${lines
    .map(
      (line, index) =>
        `<tr><td>${index + 1}</td><td>${escapeXml(line.label || `Line ${index + 1}`)}</td><td>${escapeXml(line.type || "Linear")}</td><td>${line.length_lm?.toFixed(1) || "-"}</td><td>${escapeXml(line.notes || "-")}</td></tr>`
    )
    .join("")}</tbody><tfoot><tr><td colspan="3">Total</td><td>${totalLength.toFixed(1)} lm</td><td></td></tr></tfoot></table>`;
}
