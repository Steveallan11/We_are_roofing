import type { RoofSurveyBounds, RoofSurveyLine, RoofSurveySection, SurveyPoint } from "@/lib/survey/types";

type ExportSection = RoofSurveySection;
type ExportLine = RoofSurveyLine;

function pixelToLatLng(x: number, y: number, bounds: RoofSurveyBounds, canvasWidth: number, canvasHeight: number) {
  const lng = bounds.west + (x / canvasWidth) * (bounds.east - bounds.west);
  const lat = bounds.north - (y / canvasHeight) * (bounds.north - bounds.south);
  return { lat, lng };
}

export function buildKml(opts: {
  projectName: string;
  jobRef: string;
  address: string;
  sections: ExportSection[];
  lines: ExportLine[];
  bounds: RoofSurveyBounds | null | undefined;
  canvasWidth: number;
  canvasHeight: number;
  scalePxPerM: number | null;
  surveyDate: string;
}) {
  const { projectName, jobRef, address, sections, lines, bounds, canvasWidth, canvasHeight, scalePxPerM, surveyDate } = opts;
  const hasGeo = Boolean(bounds);

  const coordsFromPoints = (points: SurveyPoint[], close = false) => {
    const coords = points.map((point) => {
      if (!bounds) return `${point.x.toFixed(2)},${point.y.toFixed(2)},0`;
      const { lat, lng } = pixelToLatLng(point.x, point.y, bounds, canvasWidth, canvasHeight);
      return `${lng.toFixed(8)},${lat.toFixed(8)},0`;
    });
    if (close && coords.length > 0) coords.push(coords[0]);
    return coords.join("\n      ");
  };

  const styles = `
  <Style id="roofSection">
    <LineStyle><color>ff37AFD4</color><width>2</width></LineStyle>
    <PolyStyle><color>4037AFD4</color><fill>1</fill><outline>1</outline></PolyStyle>
  </Style>
  <Style id="roofLine"><LineStyle><color>ff81b910</color><width>3</width></LineStyle></Style>
  <Style id="ridge"><LineStyle><color>fff6823b</color><width>2</width></LineStyle></Style>
  <Style id="valley"><LineStyle><color>fff65c8b</color><width>2</width></LineStyle></Style>
  <Style id="eaves"><LineStyle><color>ff0b9ef5</color><width>2</width></LineStyle></Style>`;

  const sectionPlacemarks = sections
    .filter((section) => section.points.length >= 3)
    .map((section, index) => {
      const label = section.label || `Roof Section ${index + 1}`;
      const areaNote = section.area_m2 ? `Area: ${section.area_m2.toFixed(1)} m2` : "Area: not measured (set scale to calculate)";
      return `
  <Placemark>
    <name>${escapeXml(label)}</name>
    <description>${escapeXml(`${section.type || "Area"} - ${areaNote}${section.notes ? `\n${section.notes}` : ""}`)}</description>
    <styleUrl>#roofSection</styleUrl>
    <ExtendedData>
      <Data name="type"><value>${escapeXml(section.type || "Area")}</value></Data>
      <Data name="condition"><value>${escapeXml(section.condition || "")}</value></Data>
      <Data name="area_m2"><value>${section.area_m2?.toFixed(2) || "not set"}</value></Data>
      <Data name="job_ref"><value>${escapeXml(jobRef)}</value></Data>
    </ExtendedData>
    <Polygon><outerBoundaryIs><LinearRing><coordinates>
      ${coordsFromPoints(section.points, true)}
    </coordinates></LinearRing></outerBoundaryIs></Polygon>
  </Placemark>`;
    })
    .join("");

  const linePlacemarks = lines
    .filter((line) => line.points.length >= 2)
    .map((line, index) => {
      const label = line.label || `Roof Line ${index + 1}`;
      const type = (line.type || "Linear").toLowerCase();
      const styleId = type.includes("ridge") ? "ridge" : type.includes("valley") ? "valley" : type.includes("eave") ? "eaves" : "roofLine";
      const lengthNote = line.length_lm ? `Length: ${line.length_lm.toFixed(1)} lm` : "Length: not measured (set scale to calculate)";
      return `
  <Placemark>
    <name>${escapeXml(label)}</name>
    <description>${escapeXml(`${line.type || "Linear"} - ${lengthNote}${line.notes ? `\n${line.notes}` : ""}`)}</description>
    <styleUrl>#${styleId}</styleUrl>
    <ExtendedData>
      <Data name="type"><value>${escapeXml(line.type || "Linear")}</value></Data>
      <Data name="length_lm"><value>${line.length_lm?.toFixed(2) || "not set"}</value></Data>
      <Data name="job_ref"><value>${escapeXml(jobRef)}</value></Data>
    </ExtendedData>
    <LineString><tessellate>1</tessellate><coordinates>
      ${coordsFromPoints(line.points)}
    </coordinates></LineString>
  </Placemark>`;
    })
    .join("");

  const totalArea = sections.reduce((sum, section) => sum + (section.area_m2 || 0), 0);
  const totalLength = lines.reduce((sum, line) => sum + (line.length_lm || 0), 0);

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
<Document>
  <name>${escapeXml(projectName)}</name>
  <description>${escapeXml(`Roof takeoff survey for ${address}
Job reference: ${jobRef}
Survey date: ${surveyDate}
Scale: ${scalePxPerM ? `${scalePxPerM.toFixed(1)} px/m (calibrated)` : "not calibrated"}
Geographic accuracy: ${hasGeo ? "GPS-referenced" : "Pixel-based fallback - set bounds for Google Earth positioning"}

TOTALS
Total roof area: ${totalArea.toFixed(1)} m2
Total linear runs: ${totalLength.toFixed(1)} lm
Sections drawn: ${sections.length}
Lines drawn: ${lines.length}`)}</description>
  ${styles}
  <Folder><name>Roof Sections (Areas)</name>${sectionPlacemarks || "<description>No sections drawn yet</description>"}</Folder>
  <Folder><name>Linear Runs</name>${linePlacemarks || "<description>No lines drawn yet</description>"}</Folder>
</Document>
</kml>`;
}

export function downloadKml(kmlString: string, filename: string) {
  downloadBlob(kmlString, filename.endsWith(".kml") ? filename : `${filename}.kml`, "application/vnd.google-earth.kml+xml");
}

export function escapeXml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function downloadBlob(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
