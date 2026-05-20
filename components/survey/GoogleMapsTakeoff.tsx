"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { importLibrary, setOptions } from "@googlemaps/js-api-loader";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { KmzUploadButton, type ParsedKmlShape } from "@/components/survey/KmzUploadButton";
import { buildCsv, downloadCsv } from "@/lib/survey/csvExporter";
import { exportZipPackage } from "@/lib/survey/zipExporter";
import type { RoofSurveyRecord, SurveyPoint } from "@/lib/survey/types";

type DrawnSection = {
  id: string;
  label: string;
  type: string;
  polygon: google.maps.Polygon;
  area_m2: number;
  color: string;
  notes: string;
};

type DrawnLine = {
  id: string;
  label: string;
  type: string;
  polyline: google.maps.Polyline;
  length_lm: number;
  color: string;
  notes: string;
};

type Props = {
  surveyId: string;
  jobId: string;
  address: string;
  jobRef?: string | null;
  customerName?: string | null;
  customerEmail?: string | null;
  initialSurvey: RoofSurveyRecord;
};

const LINE_TYPES = ["Ridge", "Hip", "Valley", "Eaves", "Verge", "Abutment", "Flashing", "Gutter", "Parapet"];
const SECTION_TYPES = ["Pitched Tile", "Pitched Slate", "Flat EPDM", "Flat GRP", "Flat Felt", "Lead", "Other"];
const SECTION_COLOURS = ["#D4AF37", "#10b981", "#3b82f6", "#8b5cf6", "#f59e0b", "#ef4444"];
const LINE_COLOURS: Record<string, string> = {
  Ridge: "#3b82f6",
  Hip: "#8b5cf6",
  Valley: "#10b981",
  Eaves: "#f59e0b",
  Verge: "#f97316",
  Abutment: "#ef4444",
  Flashing: "#D4AF37",
  Gutter: "#64748b",
  Parapet: "#ec4899",
  default: "#888888"
};

export function GoogleMapsTakeoff({ surveyId, jobId, address, jobRef, customerName, customerEmail, initialSurvey }: Props) {
  const router = useRouter();
  const mapElRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const drawingRef = useRef<google.maps.drawing.DrawingManager | null>(null);
  const loadedExistingRef = useRef(false);

  const [sections, setSections] = useState<DrawnSection[]>([]);
  const [lines, setLines] = useState<DrawnLine[]>([]);
  const [drawMode, setDrawMode] = useState<"none" | "section" | "line">("none");
  const [sectionType, setSectionType] = useState("Pitched Tile");
  const [lineType, setLineType] = useState("Ridge");
  const [sectionColor, setSectionColor] = useState("#D4AF37");
  const [searchAddr, setSearchAddr] = useState(address);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  const geocodeAddress = useCallback((addr: string, map = mapRef.current) => {
    if (!map || !window.google?.maps) return;
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ address: `${addr}, UK` }, (results, status) => {
      if (status === "OK" && results?.[0]) {
        map.setCenter(results[0].geometry.location);
        map.setZoom(20);
      }
    });
  }, []);

  const recalcSection = useCallback((id: string, polygon: google.maps.Polygon) => {
    const area = round2(google.maps.geometry.spherical.computeArea(polygon.getPath()));
    setSections((current) => current.map((section) => (section.id === id ? { ...section, area_m2: area } : section)));
  }, []);

  const recalcLine = useCallback((id: string, polyline: google.maps.Polyline) => {
    const length = round2(google.maps.geometry.spherical.computeLength(polyline.getPath()));
    setLines((current) => current.map((line) => (line.id === id ? { ...line, length_lm: length } : line)));
  }, []);

  const attachPolygonListeners = useCallback(
    (id: string, polygon: google.maps.Polygon) => {
      const path = polygon.getPath();
      ["set_at", "insert_at", "remove_at"].forEach((eventName) => {
        google.maps.event.addListener(path, eventName, () => recalcSection(id, polygon));
      });
    },
    [recalcSection]
  );

  const attachPolylineListeners = useCallback(
    (id: string, polyline: google.maps.Polyline) => {
      const path = polyline.getPath();
      ["set_at", "insert_at", "remove_at"].forEach((eventName) => {
        google.maps.event.addListener(path, eventName, () => recalcLine(id, polyline));
      });
    },
    [recalcLine]
  );

  const addSectionOverlay = useCallback(
    (opts: { id?: string; label: string; type: string; color: string; coordinates: Array<{ lat: number; lng: number }>; notes?: string; area_m2?: number | null }) => {
      if (!mapRef.current || opts.coordinates.length < 3) return null;
      const polygon = new google.maps.Polygon({
        paths: opts.coordinates,
        fillColor: opts.color,
        fillOpacity: 0.3,
        strokeColor: opts.color,
        strokeWeight: 2,
        editable: true,
        clickable: true,
        map: mapRef.current
      });
      const id = opts.id || crypto.randomUUID();
      const area_m2 = opts.area_m2 ?? round2(google.maps.geometry.spherical.computeArea(polygon.getPath()));
      attachPolygonListeners(id, polygon);
      const section = { id, label: opts.label, type: opts.type, polygon, area_m2, color: opts.color, notes: opts.notes || "" };
      setSections((current) => [...current, section]);
      return section;
    },
    [attachPolygonListeners]
  );

  const addLineOverlay = useCallback(
    (opts: { id?: string; label: string; type: string; color: string; coordinates: Array<{ lat: number; lng: number }>; notes?: string; length_lm?: number | null }) => {
      if (!mapRef.current || opts.coordinates.length < 2) return null;
      const polyline = new google.maps.Polyline({
        path: opts.coordinates,
        strokeColor: opts.color,
        strokeWeight: 3,
        editable: true,
        clickable: true,
        map: mapRef.current
      });
      const id = opts.id || crypto.randomUUID();
      const length_lm = opts.length_lm ?? round2(google.maps.geometry.spherical.computeLength(polyline.getPath()));
      attachPolylineListeners(id, polyline);
      const line = { id, label: opts.label, type: opts.type, polyline, length_lm, color: opts.color, notes: opts.notes || "" };
      setLines((current) => [...current, line]);
      return line;
    },
    [attachPolylineListeners]
  );

  const loadExistingShapes = useCallback(() => {
    if (loadedExistingRef.current || !mapRef.current) return;
    loadedExistingRef.current = true;
    const bounds = new google.maps.LatLngBounds();

    initialSurvey.sections.forEach((section) => {
      const coordinates = toLatLngPoints(section.points);
      if (!coordinates.length) return;
      addSectionOverlay({
        id: section.id,
        label: section.label,
        type: section.type,
        color: section.color,
        notes: section.notes,
        area_m2: section.area_m2,
        coordinates
      });
      coordinates.forEach((point) => bounds.extend(point));
    });

    initialSurvey.lines.forEach((line) => {
      const coordinates = toLatLngPoints(line.points);
      if (!coordinates.length) return;
      addLineOverlay({
        id: line.id,
        label: line.label,
        type: line.type,
        color: line.color,
        notes: line.notes,
        length_lm: line.length_lm,
        coordinates
      });
      coordinates.forEach((point) => bounds.extend(point));
    });

    if (!bounds.isEmpty()) mapRef.current.fitBounds(bounds);
  }, [addLineOverlay, addSectionOverlay, initialSurvey.lines, initialSurvey.sections]);

  useEffect(() => {
    if (!apiKey || !mapElRef.current) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setOptions({ key: apiKey, v: "weekly", libraries: ["drawing", "geometry", "places"] });

    Promise.all([importLibrary("maps"), importLibrary("drawing"), importLibrary("geometry"), importLibrary("places")])
      .then(() => {
        if (cancelled || !mapElRef.current) return;
        const map = new google.maps.Map(mapElRef.current, {
          zoom: 19,
          center: { lat: 51.279, lng: -0.833 },
          mapTypeId: "satellite",
          tilt: 0,
          heading: 0,
          streetViewControl: false,
          fullscreenControl: true,
          mapTypeControlOptions: { mapTypeIds: ["satellite", "hybrid", "roadmap"] }
        });
        mapRef.current = map;

        const drawingManager = new google.maps.drawing.DrawingManager({
          drawingMode: null,
          drawingControl: false,
          polygonOptions: sectionOptions(sectionColor),
          polylineOptions: lineOptions(lineType)
        });
        drawingManager.setMap(map);
        drawingRef.current = drawingManager;

        google.maps.event.addListener(drawingManager, "polygoncomplete", (polygon: google.maps.Polygon) => {
          const id = crypto.randomUUID();
          polygon.setOptions(sectionOptions(sectionColor));
          attachPolygonListeners(id, polygon);
          const area_m2 = round2(google.maps.geometry.spherical.computeArea(polygon.getPath()));
          setSections((current) => [
            ...current,
            {
              id,
              label: `${sectionType} Section ${current.length + 1}`,
              type: sectionType,
              polygon,
              area_m2,
              color: sectionColor,
              notes: ""
            }
          ]);
          drawingManager.setDrawingMode(null);
          setDrawMode("none");
        });

        google.maps.event.addListener(drawingManager, "polylinecomplete", (polyline: google.maps.Polyline) => {
          const id = crypto.randomUUID();
          const color = LINE_COLOURS[lineType] || LINE_COLOURS.default;
          polyline.setOptions(lineOptions(lineType));
          attachPolylineListeners(id, polyline);
          const length_lm = round2(google.maps.geometry.spherical.computeLength(polyline.getPath()));
          setLines((current) => [
            ...current,
            {
              id,
              label: `${lineType} ${current.length + 1}`,
              type: lineType,
              polyline,
              length_lm,
              color,
              notes: ""
            }
          ]);
          drawingManager.setDrawingMode(null);
          setDrawMode("none");
        });

        if (address) geocodeAddress(address, map);
        loadExistingShapes();
        setLoading(false);
      })
      .catch((loadError) => {
        setError(loadError instanceof Error ? loadError.message : "Unable to load Google Maps.");
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [address, apiKey, attachPolygonListeners, attachPolylineListeners, geocodeAddress, lineType, loadExistingShapes, sectionColor, sectionType]);

  function startDrawSection() {
    if (!drawingRef.current) return;
    drawingRef.current.setOptions({ polygonOptions: sectionOptions(sectionColor) });
    drawingRef.current.setDrawingMode(google.maps.drawing.OverlayType.POLYGON);
    setDrawMode("section");
  }

  function startDrawLine() {
    if (!drawingRef.current) return;
    drawingRef.current.setOptions({ polylineOptions: lineOptions(lineType) });
    drawingRef.current.setDrawingMode(google.maps.drawing.OverlayType.POLYLINE);
    setDrawMode("line");
  }

  function cancelDraw() {
    drawingRef.current?.setDrawingMode(null);
    setDrawMode("none");
  }

  function deleteSection(id: string) {
    setSections((current) => {
      current.find((section) => section.id === id)?.polygon.setMap(null);
      return current.filter((section) => section.id !== id);
    });
  }

  function deleteLine(id: string) {
    setLines((current) => {
      current.find((line) => line.id === id)?.polyline.setMap(null);
      return current.filter((line) => line.id !== id);
    });
  }

  function handleKmlShapes(shapes: ParsedKmlShape[]) {
    const bounds = new google.maps.LatLngBounds();
    shapes.forEach((shape) => {
      shape.coordinates.forEach((point) => bounds.extend(point));
      if (shape.kind === "polygon") {
        addSectionOverlay({
          label: shape.name,
          type: "Other",
          color: "#3b82f6",
          coordinates: shape.coordinates,
          area_m2: shape.knownArea ?? null,
          notes: "Imported from KML/KMZ"
        });
      } else {
        addLineOverlay({
          label: shape.name,
          type: "Other",
          color: "#3b82f6",
          coordinates: shape.coordinates,
          length_lm: shape.knownLength ?? null,
          notes: "Imported from KML/KMZ"
        });
      }
    });
    if (!bounds.isEmpty()) mapRef.current?.fitBounds(bounds);
    setMessage(`Imported ${shapes.length} KML/KMZ shape${shapes.length === 1 ? "" : "s"}.`);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/survey/roof-survey/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ surveyId, jobId, sections: serialiseSections(sections), lines: serialiseLines(lines) })
      });
      const result = (await response.json().catch(() => null)) as { saved?: boolean; error?: string } | null;
      if (!response.ok || !result?.saved) throw new Error(result?.error || "Unable to save the map takeoff.");
      setMessage("Roof takeoff saved.");
      return true;
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save the map takeoff.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handleApplyToQuote() {
    setApplying(true);
    setError(null);
    setMessage(null);
    try {
      const saved = await handleSave();
      if (!saved) return;

      const response = await fetch(`/api/roof-surveys/${surveyId}/apply-to-quote`, { method: "POST" });
      const result = (await response.json().catch(() => null)) as { ok?: boolean; quote_url?: string; imported_items?: number; error?: string } | null;
      if (!response.ok || !result?.ok || !result.quote_url) {
        throw new Error(result?.error || "Unable to create a quote draft from this takeoff.");
      }

      setMessage(`Imported ${result.imported_items ?? 0} measured item${result.imported_items === 1 ? "" : "s"} into the quote draft.`);
      router.push(result.quote_url as Route);
      router.refresh();
    } catch (applyError) {
      setError(applyError instanceof Error ? applyError.message : "Unable to create a quote draft from this takeoff.");
    } finally {
      setApplying(false);
    }
  }

  const totalArea = sections.reduce((sum, section) => sum + section.area_m2, 0);
  const totalLength = lines.reduce((sum, line) => sum + line.length_lm, 0);
  const exportRows = useMemo(() => ({ sections: serialiseSections(sections), lines: serialiseLines(lines) }), [lines, sections]);

  if (!apiKey) {
    return (
      <div className="rounded-3xl border border-[#f59e0b]/40 bg-[#1f1605] p-6 text-[#ffd999]">
        <p className="font-display text-2xl text-[var(--gold)]">Google Maps API key needed</p>
        <p className="mt-2 text-sm">Add `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` in Vercel, then redeploy. The old canvas tool is still in the codebase, but this new zero-calibration map needs Google Maps enabled.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[1.5rem] border border-[var(--border)] bg-[var(--surface)]">
      <div className="flex min-h-[78vh] flex-col lg:flex-row">
        <aside className="w-full shrink-0 border-b border-[var(--border)] bg-card2 lg:w-[320px] lg:border-b-0 lg:border-r">
          <div className="space-y-4 p-4">
            <GoogleEarthGuide />
            <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
              <p className="label">Property</p>
              <div className="mt-3 flex gap-2">
                <input className="field" onChange={(event) => setSearchAddr(event.target.value)} onKeyDown={(event) => event.key === "Enter" && geocodeAddress(searchAddr)} value={searchAddr} />
                <button className="button-primary !px-4" onClick={() => geocodeAddress(searchAddr)} type="button">
                  Go
                </button>
              </div>
            </section>

            <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
              <p className="label">Draw Roof Section</p>
              <select className="field mt-3" onChange={(event) => setSectionType(event.target.value)} value={sectionType}>
                {SECTION_TYPES.map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </select>
              <div className="mt-3 flex gap-2">
                {SECTION_COLOURS.map((color) => (
                  <button
                    aria-label={`Use colour ${color}`}
                    className="h-7 w-7 rounded-md"
                    key={color}
                    onClick={() => setSectionColor(color)}
                    style={{ background: color, border: color === sectionColor ? "2px solid #fff" : "1px solid transparent" }}
                    type="button"
                  />
                ))}
              </div>
              <button className={`mt-3 w-full ${drawMode === "section" ? "button-secondary" : "button-primary"}`} onClick={drawMode === "section" ? cancelDraw : startDrawSection} type="button">
                {drawMode === "section" ? "Cancel drawing" : "Draw Section"}
              </button>
            </section>

            <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
              <p className="label">Draw Linear Run</p>
              <select className="field mt-3" onChange={(event) => setLineType(event.target.value)} value={lineType}>
                {LINE_TYPES.map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </select>
              <button className={`mt-3 w-full ${drawMode === "line" ? "button-secondary" : "button-primary"}`} onClick={drawMode === "line" ? cancelDraw : startDrawLine} type="button">
                {drawMode === "line" ? "Cancel drawing" : "Draw Line"}
              </button>
            </section>

            <section className="rounded-2xl border border-[var(--border)] bg-black/20 p-4">
              <p className="label">Totals</p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <Metric label="Area" value={`${totalArea.toFixed(1)} m2`} />
                <Metric label="Linear" value={`${totalLength.toFixed(1)} lm`} />
              </div>
              <button className="button-primary mt-4 w-full" disabled={saving} onClick={() => void handleSave()} type="button">
                {saving ? "Saving..." : "Save Survey"}
              </button>
              <button className="button-secondary mt-2 w-full !border-[var(--success)]/40 !bg-[var(--success-bg)] !text-[#8df0b7]" disabled={saving || applying || (sections.length === 0 && lines.length === 0)} onClick={() => void handleApplyToQuote()} type="button">
                {applying ? "Creating Quote..." : "Save + Create Quote Draft"}
              </button>
              {sections.length === 0 && lines.length === 0 ? (
                <p className="mt-2 text-xs text-[var(--muted)]">Draw or import at least one measured section or line before creating the quote draft.</p>
              ) : null}
              <ExportButtons
                address={address}
                customerName={customerName || ""}
                jobRef={jobRef || "WR-J-TBC"}
                projectName={initialSurvey.project_name}
                surveyDate={new Date(initialSurvey.created_at || Date.now()).toLocaleDateString("en-GB")}
                surveyId={surveyId}
                rows={exportRows}
              />
            </section>

            <ShapeList sections={sections} lines={lines} onDeleteSection={deleteSection} onDeleteLine={deleteLine} />
          </div>
        </aside>

        <div className="relative min-h-[70vh] flex-1">
          {loading ? <div className="absolute inset-0 z-10 grid place-items-center bg-[var(--surface)] text-sm text-[var(--muted)]">Loading satellite map...</div> : null}
          <div className="h-full min-h-[70vh] w-full" ref={mapElRef} />
          <KmzUploadButton mapRef={mapRef} onShapesLoaded={handleKmlShapes} />
          {drawMode !== "none" ? (
            <div className="pointer-events-none absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full border border-[rgba(212,175,55,0.45)] bg-black/80 px-5 py-2 text-xs font-bold text-[var(--gold)]">
              {drawMode === "section" ? "Click around the roof - double-click to finish polygon" : "Click along the run - double-click to finish line"}
            </div>
          ) : null}
          {message ? <Toast tone="success">{message}</Toast> : null}
          {error ? <Toast tone="error">{error}</Toast> : null}
        </div>
      </div>
    </div>
  );
}

function sectionOptions(color: string): google.maps.PolygonOptions {
  return { fillColor: color, fillOpacity: 0.3, strokeColor: color, strokeWeight: 2, editable: true, clickable: true };
}

function lineOptions(type: string): google.maps.PolylineOptions {
  return { strokeColor: LINE_COLOURS[type] || LINE_COLOURS.default, strokeWeight: 3, editable: true, clickable: true };
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function toLatLngPoints(points: SurveyPoint[]) {
  return points.filter((point) => typeof point.lat === "number" && typeof point.lng === "number").map((point) => ({ lat: point.lat as number, lng: point.lng as number }));
}

function serialiseSections(sections: DrawnSection[]) {
  return sections.map((section) => ({
    id: section.id,
    label: section.label,
    type: section.type,
    color: section.color,
    condition: "Fair" as const,
    area_m2: section.area_m2,
    notes: section.notes,
    points: section.polygon
      .getPath()
      .getArray()
      .map((point) => ({ x: point.lng(), y: point.lat(), lat: point.lat(), lng: point.lng() }))
  }));
}

function serialiseLines(lines: DrawnLine[]) {
  return lines.map((line) => ({
    id: line.id,
    label: line.label,
    type: line.type,
    color: line.color,
    length_lm: line.length_lm,
    notes: line.notes,
    points: line.polyline
      .getPath()
      .getArray()
      .map((point) => ({ x: point.lng(), y: point.lat(), lat: point.lat(), lng: point.lng() }))
  }));
}

function buildMapKml(opts: { projectName: string; jobRef: string; address: string; sections: ReturnType<typeof serialiseSections>; lines: ReturnType<typeof serialiseLines> }) {
  const polygonPlacemarks = opts.sections
    .map(
      (section) => `<Placemark><name>${escapeXml(section.label)}</name><description>${escapeXml(`${section.type} - ${section.area_m2.toFixed(1)} m2`)}</description><ExtendedData><Data name="area_m2"><value>${section.area_m2.toFixed(2)}</value></Data></ExtendedData><Polygon><outerBoundaryIs><LinearRing><coordinates>${section.points.map((point) => `${point.lng},${point.lat},0`).join(" ")}</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>`
    )
    .join("");
  const linePlacemarks = opts.lines
    .map(
      (line) => `<Placemark><name>${escapeXml(line.label)}</name><description>${escapeXml(`${line.type} - ${line.length_lm.toFixed(1)} lm`)}</description><ExtendedData><Data name="length_lm"><value>${line.length_lm.toFixed(2)}</value></Data></ExtendedData><LineString><tessellate>1</tessellate><coordinates>${line.points.map((point) => `${point.lng},${point.lat},0`).join(" ")}</coordinates></LineString></Placemark>`
    )
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${escapeXml(opts.projectName)}</name><description>${escapeXml(`${opts.jobRef} - ${opts.address}`)}</description>${polygonPlacemarks}${linePlacemarks}</Document></kml>`;
}

function escapeXml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function downloadText(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function ExportButtons(props: {
  projectName: string;
  jobRef: string;
  address: string;
  customerName: string;
  surveyDate: string;
  surveyId: string;
  rows: { sections: ReturnType<typeof serialiseSections>; lines: ReturnType<typeof serialiseLines> };
}) {
  function makeKml() {
    return buildMapKml({ projectName: props.projectName, jobRef: props.jobRef, address: props.address, sections: props.rows.sections, lines: props.rows.lines });
  }

  function makeCsv() {
    return buildCsv({ projectName: props.projectName, jobRef: props.jobRef, address: props.address, sections: props.rows.sections, lines: props.rows.lines, surveyDate: props.surveyDate });
  }

  return (
    <div className="mt-3 grid grid-cols-2 gap-2">
      <button className="button-ghost !py-2 text-xs" onClick={() => downloadText(makeKml(), `${props.jobRef}-roof-survey.kml`, "application/vnd.google-earth.kml+xml")} type="button">
        KML
      </button>
      <button className="button-ghost !py-2 text-xs" onClick={() => downloadCsv(makeCsv(), `${props.jobRef}-measurements`)} type="button">
        CSV
      </button>
      <button
        className="button-ghost !py-2 text-xs"
        onClick={() =>
          printHtml(
            `<h1>Roof Takeoff - ${escapeXml(props.jobRef)}</h1><p>${escapeXml(props.address)}</p><p>Total sections: ${props.rows.sections.length}</p><p>Total lines: ${props.rows.lines.length}</p><pre>${escapeXml(makeCsv())}</pre>`,
            `${props.jobRef}-roof-takeoff`
          )
        }
        type="button"
      >
        PDF
      </button>
      <button
        className="button-ghost !py-2 text-xs"
        onClick={() =>
          void exportZipPackage({
            projectName: props.projectName,
            jobRef: props.jobRef,
            address: props.address,
            customerName: props.customerName,
            surveyDate: props.surveyDate,
            kmlString: makeKml(),
            csvString: makeCsv(),
            canvasDataUrl: ""
          })
        }
        type="button"
      >
        ZIP
      </button>
    </div>
  );
}

function printHtml(body: string, title: string) {
  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(`<!DOCTYPE html><html><head><title>${escapeXml(title)}</title><style>body{font-family:Arial,sans-serif;padding:32px}pre{white-space:pre-wrap;font-size:11px}</style></head><body>${body}</body></html>`);
  win.document.close();
  win.focus();
  window.setTimeout(() => win.print(), 300);
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
      <p className="text-[0.65rem] uppercase tracking-[0.18em] text-[var(--muted)]">{label}</p>
      <p className="mt-1 text-lg font-bold text-[var(--gold)]">{value}</p>
    </div>
  );
}

function ShapeList({ sections, lines, onDeleteSection, onDeleteLine }: { sections: DrawnSection[]; lines: DrawnLine[]; onDeleteSection: (id: string) => void; onDeleteLine: (id: string) => void }) {
  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
      <p className="label">Measurements</p>
      <div className="mt-3 max-h-80 space-y-2 overflow-y-auto pr-1">
        {sections.map((section) => (
          <ShapeRow color={section.color} key={section.id} label={section.label} metric={`${section.area_m2.toFixed(1)} m2`} onDelete={() => onDeleteSection(section.id)} />
        ))}
        {lines.map((line) => (
          <ShapeRow color={line.color} key={line.id} label={line.label} metric={`${line.length_lm.toFixed(1)} lm`} onDelete={() => onDeleteLine(line.id)} />
        ))}
        {sections.length === 0 && lines.length === 0 ? <p className="text-sm text-[var(--muted)]">Draw a section or line to start measuring.</p> : null}
      </div>
    </section>
  );
}

function ShapeRow({ color, label, metric, onDelete }: { color: string; label: string; metric: string; onDelete: () => void }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-black/20 p-2">
      <span className="h-3 w-3 rounded-sm" style={{ background: color }} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold text-white">{label}</p>
        <p className="text-xs text-[var(--gold)]">{metric}</p>
      </div>
      <button className="text-xs text-[#ff9b9b]" onClick={onDelete} type="button">
        Delete
      </button>
    </div>
  );
}

function Toast({ tone, children }: { tone: "success" | "error"; children: React.ReactNode }) {
  return (
    <div className={`absolute bottom-4 left-4 right-4 rounded-2xl border px-4 py-3 text-sm md:left-auto md:w-[420px] ${tone === "success" ? "border-[#2c7a4b] bg-[#0f2217]/95 text-[#9df0bb]" : "border-[#8f3b3b] bg-[#220f0f]/95 text-[#ffb4b4]"}`}>
      {children}
    </div>
  );
}

function GoogleEarthGuide() {
  return (
    <details className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
      <summary className="cursor-pointer text-sm font-bold text-white">How to import from Google Earth Pro</summary>
      <div className="mt-3 space-y-2 text-xs leading-6 text-[var(--muted)]">
        <p>1. Open Google Earth Pro and search the property address.</p>
        <p>2. Use Add Polygon for roof sections and Add Path for ridges, hips, valleys, eaves, and verges.</p>
        <p>3. Save the place as KML or KMZ.</p>
        <p className="text-[var(--gold)]">4. Upload it here with Import KML / KMZ. The app places it on the satellite map and recalculates real measurements.</p>
      </div>
    </details>
  );
}
