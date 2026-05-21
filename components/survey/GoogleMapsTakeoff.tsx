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

type DrawnFeature = {
  id: string;
  label: string;
  type: string;
  marker: google.maps.Marker;
  point: { lat: number; lng: number };
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

const LINE_TYPES = ["Ridge", "Hip", "Valley", "Eaves", "Verge", "Abutment", "Flashing", "Gutter", "Fascia", "Soaker", "Parapet", "Other"];
const SECTION_TYPES = ["Pitched - Tile", "Pitched - Slate", "Pitched - Metal", "Flat - EPDM", "Flat - GRP", "Flat - Felt", "Flat - Lead", "Hip Roof", "Mansard", "Other"];
const ROOF_FEATURES = [
  { type: "Chimney", color: "#f87171" },
  { type: "Skylight", color: "#60a5fa" },
  { type: "Rooflight", color: "#60a5fa" },
  { type: "Soil Pipe", color: "#a78bfa" },
  { type: "Stack Pipe", color: "#a78bfa" },
  { type: "Vent / Cowl", color: "#4ade80" },
  { type: "Dormer", color: "#fb923c" },
  { type: "Solar Panel", color: "#fbbf24" },
  { type: "Satellite Dish", color: "#94a3b8" },
  { type: "Extract Fan", color: "#2dd4bf" },
  { type: "Access Hatch", color: "#D4AF37" },
  { type: "Other", color: "#888888" }
];
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
  Fascia: "#94a3b8",
  Soaker: "#c084fc",
  Parapet: "#ec4899",
  default: "#888888"
};

export function GoogleMapsTakeoff({ surveyId, jobId, address, jobRef, customerName, customerEmail, initialSurvey }: Props) {
  const router = useRouter();
  const mapElRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const drawingRef = useRef<google.maps.drawing.DrawingManager | null>(null);
  const featureClickRef = useRef<google.maps.MapsEventListener | null>(null);
  const loadedExistingRef = useRef(false);

  const [sections, setSections] = useState<DrawnSection[]>([]);
  const [lines, setLines] = useState<DrawnLine[]>([]);
  const [features, setFeatures] = useState<DrawnFeature[]>([]);
  const [drawMode, setDrawMode] = useState<"none" | "section" | "line" | "feature">("none");
  const [sectionType, setSectionType] = useState("Pitched - Tile");
  const [lineType, setLineType] = useState("Ridge");
  const [featureType, setFeatureType] = useState("Chimney");
  const [sectionColor, setSectionColor] = useState("#D4AF37");
  const [searchAddr, setSearchAddr] = useState(address);
  const [surveyNotes, setSurveyNotes] = useState(initialSurvey.notes ?? "");
  const [selectedShape, setSelectedShape] = useState<{ kind: "section" | "line" | "feature"; id: string } | null>(null);
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

  const addFeatureOverlay = useCallback((opts: { id?: string; label: string; type: string; color: string; point: { lat: number; lng: number }; notes?: string }) => {
    if (!mapRef.current) return null;
    const id = opts.id || crypto.randomUUID();
    const marker = new google.maps.Marker({
      position: opts.point,
      map: mapRef.current,
      title: opts.label,
      label: { text: featureMarkerLabel(opts.type), color: "#000", fontSize: "10px", fontWeight: "700" },
      icon: featureMarkerIcon(opts.color, false),
      draggable: true,
      zIndex: 10
    });
    const feature = { id, label: opts.label, type: opts.type, marker, point: opts.point, color: opts.color, notes: opts.notes || "" };
    marker.addListener("dragend", () => {
      const position = marker.getPosition();
      if (!position) return;
      setFeatures((current) => current.map((item) => (item.id === id ? { ...item, point: { lat: position.lat(), lng: position.lng() } } : item)));
    });
    marker.addListener("click", () => setSelectedShape({ kind: "feature", id }));
    setFeatures((current) => [...current, feature]);
    return feature;
  }, []);

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

    initialSurvey.features.forEach((feature) => {
      if (typeof feature.point.lat !== "number" || typeof feature.point.lng !== "number") return;
      const point = { lat: feature.point.lat, lng: feature.point.lng };
      addFeatureOverlay({
        id: feature.id,
        label: feature.label,
        type: feature.type,
        color: feature.color,
        notes: feature.notes,
        point
      });
      bounds.extend(point);
    });

    if (!bounds.isEmpty()) mapRef.current.fitBounds(bounds);
  }, [addFeatureOverlay, addLineOverlay, addSectionOverlay, initialSurvey.features, initialSurvey.lines, initialSurvey.sections]);

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
    featureClickRef.current?.remove();
    featureClickRef.current = null;
    drawingRef.current.setOptions({ polygonOptions: sectionOptions(sectionColor) });
    drawingRef.current.setDrawingMode(google.maps.drawing.OverlayType.POLYGON);
    setDrawMode("section");
  }

  function startDrawLine() {
    if (!drawingRef.current) return;
    featureClickRef.current?.remove();
    featureClickRef.current = null;
    drawingRef.current.setOptions({ polylineOptions: lineOptions(lineType) });
    drawingRef.current.setDrawingMode(google.maps.drawing.OverlayType.POLYLINE);
    setDrawMode("line");
  }

  function startAddFeature() {
    if (!mapRef.current) return;
    drawingRef.current?.setDrawingMode(null);
    featureClickRef.current?.remove();
    setDrawMode("feature");
    featureClickRef.current = google.maps.event.addListenerOnce(mapRef.current, "click", (event: google.maps.MapMouseEvent) => {
      if (!event.latLng) return;
      const featureDef = ROOF_FEATURES.find((item) => item.type === featureType) ?? ROOF_FEATURES[0];
      addFeatureOverlay({
        label: `${featureType} ${features.length + 1}`,
        type: featureType,
        color: featureDef.color,
        point: { lat: event.latLng.lat(), lng: event.latLng.lng() },
        notes: ""
      });
      featureClickRef.current = null;
      setDrawMode("none");
    });
  }

  function cancelDraw() {
    drawingRef.current?.setDrawingMode(null);
    featureClickRef.current?.remove();
    featureClickRef.current = null;
    setDrawMode("none");
  }

  function deleteSection(id: string) {
    setSections((current) => {
      current.find((section) => section.id === id)?.polygon.setMap(null);
      return current.filter((section) => section.id !== id);
    });
    if (selectedShape?.kind === "section" && selectedShape.id === id) setSelectedShape(null);
  }

  function deleteLine(id: string) {
    setLines((current) => {
      current.find((line) => line.id === id)?.polyline.setMap(null);
      return current.filter((line) => line.id !== id);
    });
    if (selectedShape?.kind === "line" && selectedShape.id === id) setSelectedShape(null);
  }

  function deleteFeature(id: string) {
    setFeatures((current) => {
      current.find((feature) => feature.id === id)?.marker.setMap(null);
      return current.filter((feature) => feature.id !== id);
    });
    if (selectedShape?.kind === "feature" && selectedShape.id === id) setSelectedShape(null);
  }

  function updateSection(id: string, updates: Partial<Pick<DrawnSection, "label" | "type" | "notes">>) {
    setSections((current) => current.map((section) => (section.id === id ? { ...section, ...updates } : section)));
  }

  function updateLine(id: string, updates: Partial<Pick<DrawnLine, "label" | "type" | "notes">>) {
    setLines((current) =>
      current.map((line) => {
        if (line.id !== id) return line;
        const nextColor = updates.type ? LINE_COLOURS[updates.type] || LINE_COLOURS.default : line.color;
        line.polyline.setOptions({ strokeColor: nextColor });
        return { ...line, ...updates, color: nextColor };
      })
    );
  }

  function updateFeature(id: string, updates: Partial<Pick<DrawnFeature, "label" | "type" | "notes">>) {
    setFeatures((current) =>
      current.map((feature) => {
        if (feature.id !== id) return feature;
        const nextType = updates.type ?? feature.type;
        const nextColor = updates.type ? ROOF_FEATURES.find((item) => item.type === updates.type)?.color ?? feature.color : feature.color;
        const nextLabel = updates.label ?? feature.label;
        feature.marker.setTitle(nextLabel);
        feature.marker.setLabel({ text: featureMarkerLabel(nextType), color: "#000", fontSize: "10px", fontWeight: "700" });
        feature.marker.setIcon(featureMarkerIcon(nextColor, selectedShape?.kind === "feature" && selectedShape.id === id));
        return { ...feature, ...updates, type: nextType, color: nextColor, label: nextLabel };
      })
    );
  }

  function focusSection(id: string) {
    const section = sections.find((item) => item.id === id);
    if (!section || !mapRef.current) return;
    const bounds = new google.maps.LatLngBounds();
    section.polygon
      .getPath()
      .getArray()
      .forEach((point) => bounds.extend(point));
    mapRef.current.fitBounds(bounds);
    setSelectedShape({ kind: "section", id });
  }

  function focusLine(id: string) {
    const line = lines.find((item) => item.id === id);
    if (!line || !mapRef.current) return;
    const bounds = new google.maps.LatLngBounds();
    line.polyline
      .getPath()
      .getArray()
      .forEach((point) => bounds.extend(point));
    mapRef.current.fitBounds(bounds);
    setSelectedShape({ kind: "line", id });
  }

  function focusFeature(id: string) {
    const feature = features.find((item) => item.id === id);
    if (!feature || !mapRef.current) return;
    mapRef.current.panTo(feature.point);
    mapRef.current.setZoom(Math.max(mapRef.current.getZoom() ?? 20, 20));
    setSelectedShape({ kind: "feature", id });
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
        body: JSON.stringify({ surveyId, jobId, notes: surveyNotes, sections: serialiseSections(sections), lines: serialiseLines(lines), features: serialiseFeatures(features) })
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
  const exportRows = useMemo(() => ({ sections: serialiseSections(sections), lines: serialiseLines(lines), features: serialiseFeatures(features) }), [features, lines, sections]);
  useEffect(() => {
    sections.forEach((section) => {
      const selected = selectedShape?.kind === "section" && selectedShape.id === section.id;
      section.polygon.setOptions({ strokeWeight: selected ? 5 : 2, fillOpacity: selected ? 0.42 : 0.3, zIndex: selected ? 20 : 1 });
    });
    lines.forEach((line) => {
      const selected = selectedShape?.kind === "line" && selectedShape.id === line.id;
      line.polyline.setOptions({ strokeWeight: selected ? 6 : 3, zIndex: selected ? 20 : 1 });
    });
    features.forEach((feature) => {
      const selected = selectedShape?.kind === "feature" && selectedShape.id === feature.id;
      feature.marker.setIcon(featureMarkerIcon(feature.color, selected));
      feature.marker.setZIndex(selected ? 30 : 10);
    });
  }, [features, lines, sections, selectedShape]);

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

            <section className="rounded-2xl border border-[var(--gold)]/30 bg-[var(--gold)]/5 p-4">
              <p className="label text-[var(--gold)]">Quote Context Notes</p>
              <p className="mt-2 text-xs leading-5 text-[var(--muted)]">Write what the quote needs to understand: access, customer priorities, repair vs replacement, material preference, awkward details, and anything not obvious from the drawing.</p>
              <textarea
                className="field mt-3 min-h-32 leading-6"
                onChange={(event) => setSurveyNotes(event.target.value)}
                placeholder="Example: Customer wants best-value repair if possible. Rear extension flat roof is leaking around left abutment. Include scaffold allowance for rear access..."
                value={surveyNotes}
              />
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

            <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
              <p className="label">Add Roof Item</p>
              <p className="mt-2 text-xs leading-5 text-[var(--muted)]">Mark features that affect the quote: chimneys, skylights, soil pipes, vents, dormers, solar panels and similar roof details.</p>
              <select className="field mt-3" onChange={(event) => setFeatureType(event.target.value)} value={featureType}>
                {ROOF_FEATURES.map((feature) => (
                  <option key={feature.type}>{feature.type}</option>
                ))}
              </select>
              <button className={`mt-3 w-full ${drawMode === "feature" ? "button-secondary" : "button-primary"}`} onClick={drawMode === "feature" ? cancelDraw : startAddFeature} type="button">
                {drawMode === "feature" ? "Cancel item marker" : "Add Item Marker"}
              </button>
              {drawMode === "feature" ? <p className="mt-2 text-xs text-[var(--gold)]">Click the roof where this item sits.</p> : null}
            </section>

            <section className="rounded-2xl border border-[var(--border)] bg-black/20 p-4">
              <p className="label">Totals</p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <Metric label="Area" value={`${totalArea.toFixed(1)} m2`} />
                <Metric label="Linear" value={`${totalLength.toFixed(1)} lm`} />
                <Metric label="Items" value={`${features.length} no.`} />
              </div>
              <button className="button-primary mt-4 w-full" disabled={saving} onClick={() => void handleSave()} type="button">
                {saving ? "Saving..." : "Save Survey"}
              </button>
              <button className="button-secondary mt-2 w-full !border-[var(--success)]/40 !bg-[var(--success-bg)] !text-[#8df0b7]" disabled={saving || applying || (sections.length === 0 && lines.length === 0 && features.length === 0)} onClick={() => void handleApplyToQuote()} type="button">
                {applying ? "Creating Quote..." : "Save + Create Quote Draft"}
              </button>
              {sections.length === 0 && lines.length === 0 && features.length === 0 ? (
                <p className="mt-2 text-xs text-[var(--muted)]">Draw or import at least one measured section, line, or item before creating the quote draft.</p>
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

            <ShapeList
              lineTypes={LINE_TYPES}
              onDeleteLine={deleteLine}
              onDeleteSection={deleteSection}
              onDeleteFeature={deleteFeature}
              onFocusFeature={focusFeature}
              onFocusLine={focusLine}
              onFocusSection={focusSection}
              onUpdateFeature={updateFeature}
              onUpdateLine={updateLine}
              onUpdateSection={updateSection}
              featureTypes={ROOF_FEATURES.map((feature) => feature.type)}
              sectionTypes={SECTION_TYPES}
              selectedShape={selectedShape}
              sections={sections}
              lines={lines}
              features={features}
            />
          </div>
        </aside>

        <div className="relative min-h-[70vh] flex-1">
          {loading ? <div className="absolute inset-0 z-10 grid place-items-center bg-[var(--surface)] text-sm text-[var(--muted)]">Loading satellite map...</div> : null}
          <div className="h-full min-h-[70vh] w-full" ref={mapElRef} />
          <KmzUploadButton mapRef={mapRef} onShapesLoaded={handleKmlShapes} />
          {drawMode !== "none" ? (
            <div className="pointer-events-none absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full border border-[rgba(212,175,55,0.45)] bg-black/80 px-5 py-2 text-xs font-bold text-[var(--gold)]">
              {drawMode === "section" ? "Click around the roof - double-click to finish polygon" : drawMode === "line" ? "Click along the run - double-click to finish line" : "Click the roof to place this item"}
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

function featureMarkerIcon(color: string, selected: boolean): google.maps.Symbol {
  return {
    path: google.maps.SymbolPath.CIRCLE,
    scale: selected ? 13 : 10,
    fillColor: color,
    fillOpacity: 1,
    strokeColor: selected ? "#ffffff" : "#111111",
    strokeWeight: selected ? 3 : 2
  };
}

function featureMarkerLabel(type: string) {
  return type
    .split(/\s+|\/+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
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

function serialiseFeatures(features: DrawnFeature[]) {
  return features.map((feature) => ({
    id: feature.id,
    label: feature.label,
    type: feature.type,
    color: feature.color,
    notes: feature.notes,
    point: { x: feature.point.lng, y: feature.point.lat, lat: feature.point.lat, lng: feature.point.lng }
  }));
}

function buildMapKml(opts: { projectName: string; jobRef: string; address: string; sections: ReturnType<typeof serialiseSections>; lines: ReturnType<typeof serialiseLines>; features: ReturnType<typeof serialiseFeatures> }) {
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
  const featurePlacemarks = opts.features
    .map(
      (feature) => `<Placemark><name>${escapeXml(feature.label)}</name><description>${escapeXml(`${feature.type}${feature.notes ? ` - ${feature.notes}` : ""}`)}</description><ExtendedData><Data name="type"><value>${escapeXml(feature.type)}</value></Data></ExtendedData><Point><coordinates>${feature.point.lng},${feature.point.lat},0</coordinates></Point></Placemark>`
    )
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${escapeXml(opts.projectName)}</name><description>${escapeXml(`${opts.jobRef} - ${opts.address}`)}</description>${polygonPlacemarks}${linePlacemarks}${featurePlacemarks}</Document></kml>`;
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
  rows: { sections: ReturnType<typeof serialiseSections>; lines: ReturnType<typeof serialiseLines>; features: ReturnType<typeof serialiseFeatures> };
}) {
  function makeKml() {
    return buildMapKml({ projectName: props.projectName, jobRef: props.jobRef, address: props.address, sections: props.rows.sections, lines: props.rows.lines, features: props.rows.features });
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

function ShapeList({
  sections,
  lines,
  features,
  sectionTypes,
  lineTypes,
  featureTypes,
  selectedShape,
  onDeleteSection,
  onDeleteLine,
  onDeleteFeature,
  onFocusSection,
  onFocusLine,
  onFocusFeature,
  onUpdateSection,
  onUpdateLine,
  onUpdateFeature
}: {
  sections: DrawnSection[];
  lines: DrawnLine[];
  features: DrawnFeature[];
  sectionTypes: string[];
  lineTypes: string[];
  featureTypes: string[];
  selectedShape: { kind: "section" | "line" | "feature"; id: string } | null;
  onDeleteSection: (id: string) => void;
  onDeleteLine: (id: string) => void;
  onDeleteFeature: (id: string) => void;
  onFocusSection: (id: string) => void;
  onFocusLine: (id: string) => void;
  onFocusFeature: (id: string) => void;
  onUpdateSection: (id: string, updates: Partial<Pick<DrawnSection, "label" | "type" | "notes">>) => void;
  onUpdateLine: (id: string, updates: Partial<Pick<DrawnLine, "label" | "type" | "notes">>) => void;
  onUpdateFeature: (id: string, updates: Partial<Pick<DrawnFeature, "label" | "type" | "notes">>) => void;
}) {
  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
      <p className="label">Individual Measurements</p>
      <p className="mt-2 text-xs leading-5 text-[var(--muted)]">Name each area or run clearly. Click Focus to jump the map to that exact measurement before pricing.</p>
      <div className="mt-3 max-h-[32rem] space-y-3 overflow-y-auto pr-1">
        {sections.map((section) => (
          <ShapeRow
            color={section.color}
            key={section.id}
            label={section.label}
            metric={`${section.area_m2.toFixed(1)} m2`}
            notes={section.notes}
            onDelete={() => onDeleteSection(section.id)}
            onFocus={() => onFocusSection(section.id)}
            onLabelChange={(label) => onUpdateSection(section.id, { label })}
            onNotesChange={(notes) => onUpdateSection(section.id, { notes })}
            onTypeChange={(type) => onUpdateSection(section.id, { type })}
            selected={selectedShape?.kind === "section" && selectedShape.id === section.id}
            type={section.type}
            typeOptions={sectionTypes}
          />
        ))}
        {lines.map((line) => (
          <ShapeRow
            color={line.color}
            key={line.id}
            label={line.label}
            metric={`${line.length_lm.toFixed(1)} lm`}
            notes={line.notes}
            onDelete={() => onDeleteLine(line.id)}
            onFocus={() => onFocusLine(line.id)}
            onLabelChange={(label) => onUpdateLine(line.id, { label })}
            onNotesChange={(notes) => onUpdateLine(line.id, { notes })}
            onTypeChange={(type) => onUpdateLine(line.id, { type })}
            selected={selectedShape?.kind === "line" && selectedShape.id === line.id}
            type={line.type}
            typeOptions={lineTypes}
          />
        ))}
        {features.map((feature) => (
          <ShapeRow
            color={feature.color}
            key={feature.id}
            label={feature.label}
            metric="1 no."
            notes={feature.notes}
            onDelete={() => onDeleteFeature(feature.id)}
            onFocus={() => onFocusFeature(feature.id)}
            onLabelChange={(label) => onUpdateFeature(feature.id, { label })}
            onNotesChange={(notes) => onUpdateFeature(feature.id, { notes })}
            onTypeChange={(type) => onUpdateFeature(feature.id, { type })}
            selected={selectedShape?.kind === "feature" && selectedShape.id === feature.id}
            type={feature.type}
            typeOptions={featureTypes}
          />
        ))}
        {sections.length === 0 && lines.length === 0 && features.length === 0 ? <p className="text-sm text-[var(--muted)]">Draw a section, line, or roof item to start measuring.</p> : null}
      </div>
    </section>
  );
}

function ShapeRow({
  color,
  label,
  type,
  metric,
  notes,
  selected,
  typeOptions,
  onDelete,
  onFocus,
  onLabelChange,
  onTypeChange,
  onNotesChange
}: {
  color: string;
  label: string;
  type: string;
  metric: string;
  notes: string;
  selected: boolean;
  typeOptions: string[];
  onDelete: () => void;
  onFocus: () => void;
  onLabelChange: (label: string) => void;
  onTypeChange: (type: string) => void;
  onNotesChange: (notes: string) => void;
}) {
  return (
    <div className={`rounded-xl border bg-black/20 p-3 ${selected ? "border-[var(--gold)] shadow-[0_0_0_1px_rgba(212,175,55,0.28)]" : "border-[var(--border)]"}`}>
      <div className="flex items-center gap-2">
        <span className="h-3 w-3 rounded-sm" style={{ background: color }} />
        <p className="flex-1 text-xs font-bold text-[var(--gold)]">{metric}</p>
        <button className="rounded-lg border border-[var(--gold)]/30 px-2 py-1 text-xs font-semibold text-[var(--gold)]" onClick={onFocus} type="button">
          Focus
        </button>
        <button className="rounded-lg border border-[#ff9b9b]/30 px-2 py-1 text-xs text-[#ff9b9b]" onClick={onDelete} type="button">
          Delete
        </button>
      </div>
      <label className="mt-3 block">
        <span className="label">Name</span>
        <input className="field" onChange={(event) => onLabelChange(event.target.value)} value={label} />
      </label>
      <label className="mt-2 block">
        <span className="label">Type / Rate Match</span>
        <select className="field" onChange={(event) => onTypeChange(event.target.value)} value={type}>
          {typeOptions.includes(type) ? null : <option>{type}</option>}
          {typeOptions.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
      </label>
      <label className="mt-2 block">
        <span className="label">Measurement Notes</span>
        <textarea className="field min-h-20" onChange={(event) => onNotesChange(event.target.value)} placeholder="Waste, access, repair detail, material note..." value={notes} />
      </label>
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
