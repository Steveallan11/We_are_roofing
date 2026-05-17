import {
  AREA_COLORS,
  FEATURE_DEFS,
  LINE_DEFS,
  type RoofSurveyFeature,
  type RoofSurveyLine,
  type RoofSurveySection,
  type SurveyPoint
} from "@/lib/survey/types";
import { getLineLength, getSectionArea } from "@/lib/survey/geometry";

type KmlCoordinate = {
  lon: number;
  lat: number;
};

export type KmlImportResult = {
  sections: RoofSurveySection[];
  lines: RoofSurveyLine[];
  features: RoofSurveyFeature[];
  scale_px_per_m: number;
  notes: string;
};

type ParsedPlacemark = {
  name: string;
  description: string;
  polygons: KmlCoordinate[][];
  lines: KmlCoordinate[][];
  points: KmlCoordinate[];
};

const DEFAULT_PX_PER_M = 12;
const CANVAS_PADDING_PX = 120;

export function parseKmlToRoofSurvey(kmlText: string): KmlImportResult {
  const parser = new DOMParser();
  const xml = parser.parseFromString(kmlText, "application/xml");
  const parseError = xml.querySelector("parsererror");
  if (parseError) {
    throw new Error("The KML file could not be read. Please export it again as valid KML.");
  }

  const placemarks = Array.from(xml.getElementsByTagName("Placemark")).map(parsePlacemark);
  const allCoordinates = placemarks.flatMap((placemark) => [
    ...placemark.polygons.flat(),
    ...placemark.lines.flat(),
    ...placemark.points
  ]);

  if (allCoordinates.length === 0) {
    throw new Error("No coordinates were found in this KML file.");
  }

  const origin = {
    lon: allCoordinates.reduce((sum, point) => sum + point.lon, 0) / allCoordinates.length,
    lat: allCoordinates.reduce((sum, point) => sum + point.lat, 0) / allCoordinates.length
  };
  const projected = allCoordinates.map((point) => projectCoordinate(point, origin));
  const minX = Math.min(...projected.map((point) => point.x));
  const minY = Math.min(...projected.map((point) => point.y));

  const toWorldPoint = (coordinate: KmlCoordinate): SurveyPoint => {
    const metres = projectCoordinate(coordinate, origin);
    return {
      x: (metres.x - minX) * DEFAULT_PX_PER_M + CANVAS_PADDING_PX,
      y: (metres.y - minY) * DEFAULT_PX_PER_M + CANVAS_PADDING_PX
    };
  };

  const sections: RoofSurveySection[] = [];
  const lines: RoofSurveyLine[] = [];
  const features: RoofSurveyFeature[] = [];

  placemarks.forEach((placemark) => {
    const text = `${placemark.name} ${placemark.description}`;
    placemark.polygons.forEach((polygon) => {
      const points = closeDuplicateRemoved(polygon).map(toWorldPoint);
      if (points.length < 3) return;
      const section: RoofSurveySection = {
        label: placemark.name || `KML Area ${sections.length + 1}`,
        type: inferSectionType(text),
        condition: "Fair",
        color: AREA_COLORS[sections.length % AREA_COLORS.length],
        points,
        area_m2: null,
        notes: placemark.description || "Imported from KML"
      };
      sections.push({
        ...section,
        area_m2: getSectionArea(section, DEFAULT_PX_PER_M)
      });
    });

    placemark.lines.forEach((line) => {
      const points = line.map(toWorldPoint);
      if (points.length < 2) return;
      const lineType = inferLineType(text);
      const lineDef = LINE_DEFS.find((item) => item.name === lineType) ?? LINE_DEFS[LINE_DEFS.length - 1];
      const surveyLine: RoofSurveyLine = {
        label: placemark.name || lineType,
        type: lineType,
        color: lineDef.color,
        points,
        length_lm: null,
        notes: placemark.description || "Imported from KML"
      };
      lines.push({
        ...surveyLine,
        length_lm: getLineLength(surveyLine, DEFAULT_PX_PER_M)
      });
    });

    placemark.points.forEach((point) => {
      const featureType = inferFeatureType(text);
      const featureDef = FEATURE_DEFS.find((item) => item.name === featureType) ?? FEATURE_DEFS[FEATURE_DEFS.length - 1];
      features.push({
        label: placemark.name || featureType,
        type: featureType,
        color: featureDef.color,
        point: toWorldPoint(point),
        notes: placemark.description || "Imported from KML"
      });
    });
  });

  return {
    sections,
    lines,
    features,
    scale_px_per_m: DEFAULT_PX_PER_M,
    notes: `Imported ${sections.length} area(s), ${lines.length} measured line(s), and ${features.length} feature(s) from KML. Scale set from GPS coordinates at ${DEFAULT_PX_PER_M} px/m.`
  };
}

function parsePlacemark(placemark: Element): ParsedPlacemark {
  const name = textContent(placemark, "name");
  const description = stripHtml(textContent(placemark, "description"));
  return {
    name,
    description,
    polygons: Array.from(placemark.getElementsByTagName("Polygon")).flatMap((polygon) =>
      Array.from(polygon.getElementsByTagName("coordinates")).map((node) => parseCoordinateList(node.textContent ?? "")).filter((points) => points.length >= 3)
    ),
    lines: Array.from(placemark.getElementsByTagName("LineString")).flatMap((line) =>
      Array.from(line.getElementsByTagName("coordinates")).map((node) => parseCoordinateList(node.textContent ?? "")).filter((points) => points.length >= 2)
    ),
    points: Array.from(placemark.getElementsByTagName("Point")).flatMap((point) =>
      Array.from(point.getElementsByTagName("coordinates")).flatMap((node) => parseCoordinateList(node.textContent ?? "")).slice(0, 1)
    )
  };
}

function parseCoordinateList(value: string): KmlCoordinate[] {
  return value
    .trim()
    .split(/\s+/)
    .map((chunk) => {
      const [lon, lat] = chunk.split(",").map(Number);
      return Number.isFinite(lon) && Number.isFinite(lat) ? { lon, lat } : null;
    })
    .filter((point): point is KmlCoordinate => point != null);
}

function projectCoordinate(point: KmlCoordinate, origin: KmlCoordinate): SurveyPoint {
  const earthRadius = 6_378_137;
  const latRad = (origin.lat * Math.PI) / 180;
  return {
    x: ((point.lon - origin.lon) * Math.PI * earthRadius * Math.cos(latRad)) / 180,
    y: (-(point.lat - origin.lat) * Math.PI * earthRadius) / 180
  };
}

function closeDuplicateRemoved(points: KmlCoordinate[]) {
  if (points.length < 2) return points;
  const first = points[0];
  const last = points[points.length - 1];
  if (Math.abs(first.lon - last.lon) < 0.0000001 && Math.abs(first.lat - last.lat) < 0.0000001) {
    return points.slice(0, -1);
  }
  return points;
}

function textContent(element: Element, tagName: string) {
  return element.getElementsByTagName(tagName)[0]?.textContent?.trim() ?? "";
}

function stripHtml(value: string) {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function inferSectionType(text: string) {
  const lower = text.toLowerCase();
  if (lower.includes("slate")) return "Pitched - Slate";
  if (lower.includes("tile") || lower.includes("pitched")) return "Pitched - Tile";
  if (lower.includes("grp")) return "Flat - GRP";
  if (lower.includes("felt")) return "Flat - Felt";
  if (lower.includes("lead")) return "Flat - Lead";
  return "Flat - EPDM";
}

function inferLineType(text: string) {
  const lower = text.toLowerCase();
  const match = LINE_DEFS.find((item) => lower.includes(item.name.toLowerCase()));
  return match?.name ?? "Other";
}

function inferFeatureType(text: string) {
  const lower = text.toLowerCase();
  const match = FEATURE_DEFS.find((item) => lower.includes(item.name.toLowerCase()));
  if (lower.includes("velux") || lower.includes("skylight")) return "Skylight";
  if (lower.includes("chimney")) return "Chimney";
  if (lower.includes("solar")) return "Solar Panel";
  return match?.name ?? "Other";
}
