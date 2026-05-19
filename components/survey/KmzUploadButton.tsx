"use client";

import { useState } from "react";
import JSZip from "jszip";

export type ParsedKmlShape =
  | {
      id: string;
      name: string;
      kind: "polygon";
      coordinates: Array<{ lat: number; lng: number }>;
      knownArea?: number | null;
    }
  | {
      id: string;
      name: string;
      kind: "line";
      coordinates: Array<{ lat: number; lng: number }>;
      knownLength?: number | null;
    };

type Props = {
  mapRef: React.MutableRefObject<google.maps.Map | null>;
  onShapesLoaded: (shapes: ParsedKmlShape[]) => void;
};

export function KmzUploadButton({ mapRef, onShapesLoaded }: Props) {
  const [importing, setImporting] = useState(false);

  async function handleFile(file: File) {
    setImporting(true);
    try {
      const kmlText = file.name.toLowerCase().endsWith(".kmz") ? await readKmz(file, mapRef.current) : await file.text();
      const shapes = parseKmlShapes(kmlText);
      if (shapes.length === 0) {
        window.alert("No polygons or lines were found in that KML/KMZ file.");
        return;
      }
      onShapesLoaded(shapes);
    } catch (error) {
      window.alert(`Import failed: ${error instanceof Error ? error.message : "Unable to import KML/KMZ."}`);
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="absolute right-3 top-3 z-10">
      <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-[rgba(212,175,55,0.45)] bg-black/80 px-4 py-2 text-xs font-bold text-[var(--gold)] shadow-xl backdrop-blur">
        {importing ? "Importing..." : "Import KML / KMZ"}
        <input
          accept=".kml,.kmz,application/vnd.google-earth.kml+xml,application/vnd.google-earth.kmz"
          className="hidden"
          disabled={importing}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.currentTarget.value = "";
            if (file) void handleFile(file);
          }}
          type="file"
        />
      </label>
    </div>
  );
}

async function readKmz(file: File, map: google.maps.Map | null) {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const kmlFile = zip.file("doc.kml") ?? zip.file(/\.kml$/i)[0];
  if (!kmlFile) throw new Error("No KML file found inside the KMZ.");
  const kmlText = await kmlFile.async("text");
  const overlay = await extractGroundOverlayImage(zip, kmlText);
  if (overlay && map) displayGroundOverlay(overlay, map);
  return kmlText;
}

export function parseKmlShapes(kmlText: string): ParsedKmlShape[] {
  const xmlDoc = new DOMParser().parseFromString(kmlText, "application/xml");
  const parseError = xmlDoc.querySelector("parsererror");
  if (parseError) throw new Error("The KML file could not be parsed.");

  const shapes: ParsedKmlShape[] = [];
  xmlDoc.querySelectorAll("Placemark").forEach((placemark) => {
    const name = placemark.querySelector("name")?.textContent?.trim() || "Imported Shape";
    const polygon = placemark.querySelector("Polygon");
    const line = placemark.querySelector("LineString");

    if (polygon) {
      const coordinates = parseCoords(polygon.querySelector("coordinates")?.textContent || "");
      if (coordinates.length >= 3) {
        const areaValue = placemark.querySelector('ExtendedData Data[name="area_m2"] value')?.textContent;
        shapes.push({ id: crypto.randomUUID(), name, kind: "polygon", coordinates, knownArea: areaValue ? Number.parseFloat(areaValue) : null });
      }
    }

    if (line) {
      const coordinates = parseCoords(line.querySelector("coordinates")?.textContent || "");
      if (coordinates.length >= 2) {
        const lengthValue = placemark.querySelector('ExtendedData Data[name="length_lm"] value')?.textContent;
        shapes.push({ id: crypto.randomUUID(), name, kind: "line", coordinates, knownLength: lengthValue ? Number.parseFloat(lengthValue) : null });
      }
    }
  });

  return shapes;
}

function parseCoords(text: string) {
  return text
    .trim()
    .split(/\s+/)
    .map((part) => {
      const [lng, lat] = part.split(",").map((value) => Number.parseFloat(value));
      return { lat, lng };
    })
    .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng));
}

async function extractGroundOverlayImage(zip: JSZip, kmlText: string) {
  const xmlDoc = new DOMParser().parseFromString(kmlText, "application/xml");
  const overlay = xmlDoc.querySelector("GroundOverlay");
  if (!overlay) return null;

  const north = Number.parseFloat(overlay.querySelector("north")?.textContent || "");
  const south = Number.parseFloat(overlay.querySelector("south")?.textContent || "");
  const east = Number.parseFloat(overlay.querySelector("east")?.textContent || "");
  const west = Number.parseFloat(overlay.querySelector("west")?.textContent || "");
  const href = overlay.querySelector("Icon href")?.textContent?.trim() || "";
  if (!href || ![north, south, east, west].every(Number.isFinite)) return null;

  const imageFile = zip.file(href) ?? zip.file(href.replace(/^\.\//, ""));
  if (!imageFile) return null;

  return {
    imageUrl: URL.createObjectURL(await imageFile.async("blob")),
    bounds: { north, south, east, west }
  };
}

function displayGroundOverlay(overlay: { imageUrl: string; bounds: { north: number; south: number; east: number; west: number } }, map: google.maps.Map) {
  const bounds = new google.maps.LatLngBounds(
    new google.maps.LatLng(overlay.bounds.south, overlay.bounds.west),
    new google.maps.LatLng(overlay.bounds.north, overlay.bounds.east)
  );
  new google.maps.GroundOverlay(overlay.imageUrl, bounds, { map, opacity: 0.85 });
  map.fitBounds(bounds);
}
