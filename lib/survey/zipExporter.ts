import JSZip from "jszip";

export async function exportZipPackage(opts: {
  projectName: string;
  jobRef: string;
  address: string;
  customerName: string;
  surveyDate: string;
  kmlString: string;
  csvString: string;
  canvasDataUrl: string;
  satelliteImageUrl?: string | null;
}) {
  const safeName = safeFilename(opts.projectName || opts.jobRef || "roof_takeoff");
  const zip = new JSZip();

  zip.file(`${safeName}_survey.kml`, opts.kmlString);
  zip.file(`${safeName}_measurements.csv`, `\uFEFF${opts.csvString}`);

  if (opts.canvasDataUrl) {
    const [, mime = "", payload = ""] = opts.canvasDataUrl.match(/^data:([^;]+);base64,(.*)$/) ?? [];
    if (mime === "image/svg+xml") {
      zip.file(`${safeName}_cad_drawing.svg`, payload, { base64: true });
    } else {
      zip.file(`${safeName}_survey_annotated.jpg`, payload || opts.canvasDataUrl.replace(/^data:image\/\w+;base64,/, ""), { base64: true });
    }
  }

  if (opts.satelliteImageUrl) {
    try {
      const response = await fetch(opts.satelliteImageUrl);
      if (response.ok) zip.file(`${safeName}_satellite.jpg`, await response.arrayBuffer());
    } catch {
      // The original image is helpful, but the export package is still useful without it.
    }
  }

  zip.file(
    "README.txt",
    `WE ARE ROOFING UK LTD - ROOF TAKEOFF PACKAGE
=============================================
Job: ${opts.jobRef}
Address: ${opts.address}
Customer: ${opts.customerName}
Survey date: ${opts.surveyDate}

FILES
-----
${safeName}_survey.kml
  Open in Google Earth or Google Maps. Geographic placement requires survey bounds.

${safeName}_measurements.csv
  Measurements spreadsheet for Excel, Numbers, or Google Sheets.

${safeName}_cad_drawing.svg / ${safeName}_survey_annotated.jpg
  Generated drawing or annotated image with roof sections, lines, and items overlaid.

${safeName}_satellite.jpg
  Original satellite image, when available.
`
  );

  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${safeName}_takeoff_package.zip`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function safeFilename(value: string) {
  return value.replace(/[^a-zA-Z0-9-_]+/g, "_").replace(/^_+|_+$/g, "") || "roof_takeoff";
}
