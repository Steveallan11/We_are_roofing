import type { RoofSurveyLine, RoofSurveySection } from "@/lib/survey/types";

export function buildCsv(opts: {
  projectName: string;
  jobRef: string;
  address: string;
  sections: RoofSurveySection[];
  lines: RoofSurveyLine[];
  surveyDate: string;
}) {
  const { jobRef, address, sections, lines, surveyDate } = opts;
  const rows: string[] = [
    csvRow(["We Are Roofing UK Ltd - Roof Takeoff"]),
    csvRow(["Job", jobRef]),
    csvRow(["Address", address]),
    csvRow(["Survey date", surveyDate]),
    csvRow(["Generated", new Date().toLocaleDateString("en-GB")]),
    "",
    csvRow(["ROOF SECTIONS (AREAS)"]),
    csvRow(["#", "Label", "Type", "Area (m2)", "Condition", "Notes"]),
    ...sections.map((section, index) =>
      csvRow([index + 1, section.label || `Section ${index + 1}`, section.type || "Area", section.area_m2?.toFixed(2) || "not set", section.condition || "", section.notes || ""])
    ),
    "",
    csvRow(["LINEAR RUNS"]),
    csvRow(["#", "Label", "Type", "Length (lm)", "Notes"]),
    ...lines.map((line, index) => csvRow([index + 1, line.label || `Line ${index + 1}`, line.type || "Linear", line.length_lm?.toFixed(2) || "not set", line.notes || ""])),
    "",
    csvRow(["TOTALS"]),
    csvRow(["Total area (m2)", sections.reduce((sum, section) => sum + (section.area_m2 || 0), 0).toFixed(1)]),
    csvRow(["Total linear (lm)", lines.reduce((sum, line) => sum + (line.length_lm || 0), 0).toFixed(1)]),
    csvRow(["Sections", sections.length]),
    csvRow(["Lines", lines.length])
  ];

  return rows.join("\n");
}

export function downloadCsv(csvString: string, filename: string) {
  const blob = new Blob([`\uFEFF${csvString}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function csvRow(values: Array<string | number>) {
  return values.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",");
}
