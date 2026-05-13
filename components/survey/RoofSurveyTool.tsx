"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import {
  AREA_COLORS,
  CONDITIONS,
  FEATURE_DEFS,
  LINE_DEFS,
  SECTION_TYPES,
  type BOMItem,
  type RoofSurveyFeature,
  type RoofSurveyLine,
  type RoofSurveyRecord,
  type RoofSurveySection,
  type RoofSurveySelection,
  type SurveyPoint
} from "@/lib/survey/types";
import {
  buildRoofSurveyBom,
  centroid,
  distToSeg,
  getFeatureIcon,
  getLineLength,
  getRoofSurveyTotals,
  getSectionArea,
  lineLen,
  polyArea,
  ptInPoly
} from "@/lib/survey/geometry";
import { useSurveyStore } from "@/components/survey/useSurveyStore";

type Props = {
  jobId: string;
  surveyId: string;
  initialSurvey: RoofSurveyRecord;
  onSave?: (survey: RoofSurveyRecord) => Promise<void>;
  onExportToQuote?: (items: BOMItem[]) => Promise<void>;
};

type ToolMode = "draw" | "calibrate" | "select" | "pan";
type DrawMode = "area" | "line" | "feature";
type SaveState = "idle" | "saving" | "saved" | "error";

type CalibrationLine = {
  start: SurveyPoint;
  end: SurveyPoint | null;
} | null;

function loadCanvasImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Unable to load the survey image."));
    image.src = url;
  });
}

export function RoofSurveyTool({ jobId, surveyId, initialSurvey, onSave, onExportToQuote }: Props) {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSaveRef = useRef(false);
  const lastSavedPayloadRef = useRef("");

  const { survey, setSurvey, updateSurvey, selection, setSelection, setSections, setLines, setFeatures } = useSurveyStore(initialSurvey);

  const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null);
  const [bgOpacity, setBgOpacity] = useState(0.78);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const [toolMode, setToolMode] = useState<ToolMode>("draw");
  const [drawMode, setDrawMode] = useState<DrawMode>("area");
  const [lineType, setLineType] = useState<string>("Ridge");
  const [featureType, setFeatureType] = useState<string>("Skylight");
  const [currentPoints, setCurrentPoints] = useState<SurveyPoint[]>([]);
  const [mousePosition, setMousePosition] = useState<{ x: number; y: number } | null>(null);
  const [snap, setSnap] = useState(true);
  const [tab, setTab] = useState<"areas" | "lines" | "features" | "inventory">("areas");
  const [showPanel, setShowPanel] = useState(true);
  const [calibrationLine, setCalibrationLine] = useState<CalibrationLine>(null);
  const [calibrationInput, setCalibrationInput] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  const toCanvas = useCallback(
    (worldPoint: SurveyPoint) => ({
      x: worldPoint.x * zoom + pan.x,
      y: worldPoint.y * zoom + pan.y
    }),
    [pan.x, pan.y, zoom]
  );

  const toWorld = useCallback(
    (canvasPoint: { x: number; y: number }) => ({
      x: (canvasPoint.x - pan.x) / zoom,
      y: (canvasPoint.y - pan.y) / zoom
    }),
    [pan.x, pan.y, zoom]
  );

  const inventory = useMemo(() => buildRoofSurveyBom(survey), [survey]);
  const totals = useMemo(() => getRoofSurveyTotals(survey), [survey]);

  useEffect(() => {
    setSurvey(initialSurvey);
    lastSavedPayloadRef.current = JSON.stringify(initialSurvey);
  }, [initialSurvey, setSurvey]);

  useEffect(() => {
    if (!survey.satellite_image_url) {
      setBgImage(null);
      return;
    }

    let cancelled = false;
    loadCanvasImage(survey.satellite_image_url)
      .then((image) => {
        if (cancelled) return;
        setBgImage(image);
      })
      .catch(() => {
        if (cancelled) return;
        setError("Unable to load the saved satellite image.");
      });

    return () => {
      cancelled = true;
    };
  }, [survey.satellite_image_url]);

  const getSnappedPoint = useCallback(
    (worldPoint: SurveyPoint) => {
      if (!snap) return worldPoint;
      const maxDistance = 14 / zoom;
      let best: SurveyPoint | null = null;
      let nearest = maxDistance;
      const check = (point: SurveyPoint) => {
        const distance = Math.hypot(point.x - worldPoint.x, point.y - worldPoint.y);
        if (distance < nearest) {
          nearest = distance;
          best = point;
        }
      };

      survey.sections.forEach((section) => section.points.forEach(check));
      survey.lines.forEach((line) => line.points.forEach(check));
      currentPoints.forEach(check);
      return best ?? worldPoint;
    },
    [currentPoints, snap, survey.lines, survey.sections, zoom]
  );

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    context.clearRect(0, 0, canvas.width, canvas.height);

    if (bgImage) {
      context.save();
      context.globalAlpha = bgOpacity;
      context.drawImage(bgImage, pan.x, pan.y, bgImage.width * zoom, bgImage.height * zoom);
      context.restore();
    } else {
      context.save();
      context.strokeStyle = "rgba(212,175,55,0.06)";
      context.lineWidth = 1;
      const grid = 50 * zoom;
      const offsetX = ((pan.x % grid) + grid) % grid;
      const offsetY = ((pan.y % grid) + grid) % grid;
      for (let x = offsetX; x < canvas.width; x += grid) {
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x, canvas.height);
        context.stroke();
      }
      for (let y = offsetY; y < canvas.height; y += grid) {
        context.beginPath();
        context.moveTo(0, y);
        context.lineTo(canvas.width, y);
        context.stroke();
      }
      context.restore();
    }

    survey.sections.forEach((section, index) => {
      if (section.points.length < 2) return;
      const canvasPoints = section.points.map(toCanvas);
      const color = section.color || AREA_COLORS[index % AREA_COLORS.length];
      const isSelected = selection?.kind === "area" && selection.idx === index;
      context.save();
      context.beginPath();
      context.moveTo(canvasPoints[0].x, canvasPoints[0].y);
      canvasPoints.slice(1).forEach((point) => context.lineTo(point.x, point.y));
      context.closePath();
      context.fillStyle = `${color}${isSelected ? "44" : "22"}`;
      context.fill();
      context.strokeStyle = isSelected ? "#ffffff" : color;
      context.lineWidth = isSelected ? 2.5 : 1.8;
      context.stroke();
      canvasPoints.forEach((point) => {
        context.beginPath();
        context.arc(point.x, point.y, isSelected ? 5 : 3, 0, Math.PI * 2);
        context.fillStyle = color;
        context.fill();
      });
      const center = centroid(canvasPoints);
      context.shadowColor = "rgba(0,0,0,0.9)";
      context.shadowBlur = 7;
      context.fillStyle = "#ffffff";
      context.font = `bold ${Math.max(10, 12 * zoom)}px Montserrat, sans-serif`;
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(section.label || `Section ${index + 1}`, center.x, center.y - (survey.scale_px_per_m ? 9 : 0));
      const area = section.area_m2 ?? getSectionArea(section, survey.scale_px_per_m);
      if (area) {
        context.font = `${Math.max(9, 10 * zoom)}px Montserrat, sans-serif`;
        context.fillStyle = color;
        context.fillText(`${area.toFixed(1)} m²`, center.x, center.y + 10);
      }
      context.restore();
    });

    survey.lines.forEach((line, index) => {
      if (line.points.length < 2) return;
      const canvasPoints = line.points.map(toCanvas);
      const lineDef = LINE_DEFS.find((item) => item.name === line.type) ?? LINE_DEFS[LINE_DEFS.length - 1];
      const isSelected = selection?.kind === "line" && selection.idx === index;
      context.save();
      context.beginPath();
      context.moveTo(canvasPoints[0].x, canvasPoints[0].y);
      canvasPoints.slice(1).forEach((point) => context.lineTo(point.x, point.y));
      context.strokeStyle = isSelected ? "#ffffff" : line.color || lineDef.color;
      context.lineWidth = isSelected ? 3 : 2;
      context.setLineDash(lineDef.dash);
      context.stroke();
      canvasPoints.forEach((point) => {
        context.beginPath();
        context.arc(point.x, point.y, 4, 0, Math.PI * 2);
        context.fillStyle = line.color || lineDef.color;
        context.fill();
      });
      const mid = centroid(canvasPoints);
      const length = line.length_lm ?? getLineLength(line, survey.scale_px_per_m);
      context.shadowColor = "rgba(0,0,0,0.9)";
      context.shadowBlur = 7;
      context.setLineDash([]);
      context.fillStyle = line.color || lineDef.color;
      context.font = `bold ${Math.max(9, 10 * zoom)}px Montserrat, sans-serif`;
      context.textAlign = "center";
      context.fillText(line.label || line.type, mid.x, mid.y - 11);
      if (length) {
        context.font = `${Math.max(8, 9 * zoom)}px Montserrat, sans-serif`;
        context.fillStyle = "#dddddd";
        context.fillText(`${length.toFixed(2)} m`, mid.x, mid.y + 4);
      }
      context.restore();
    });

    survey.features.forEach((feature, index) => {
      const point = toCanvas(feature.point);
      const featureDef = FEATURE_DEFS.find((item) => item.name === feature.type) ?? FEATURE_DEFS[FEATURE_DEFS.length - 1];
      const isSelected = selection?.kind === "feature" && selection.idx === index;
      const radius = isSelected ? 18 : 14;
      context.save();
      context.beginPath();
      context.arc(point.x, point.y, radius, 0, Math.PI * 2);
      context.fillStyle = "rgba(0,0,0,0.8)";
      context.fill();
      context.strokeStyle = isSelected ? "#ffffff" : feature.color || featureDef.color;
      context.lineWidth = isSelected ? 2.5 : 1.5;
      context.stroke();
      context.font = `${isSelected ? 16 : 13}px sans-serif`;
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillStyle = feature.color || featureDef.color;
      context.fillText(getFeatureIcon(feature), point.x, point.y);
      context.shadowColor = "rgba(0,0,0,0.95)";
      context.shadowBlur = 6;
      context.font = `bold ${Math.max(9, 10 * zoom)}px Montserrat, sans-serif`;
      context.fillStyle = "#ffffff";
      context.textBaseline = "top";
      context.fillText(feature.label || feature.type, point.x, point.y + radius + 4);
      context.restore();
    });

    if (currentPoints.length > 0 && toolMode === "draw") {
      const canvasPoints = currentPoints.map(toCanvas);
      context.save();
      context.beginPath();
      context.moveTo(canvasPoints[0].x, canvasPoints[0].y);
      canvasPoints.slice(1).forEach((point) => context.lineTo(point.x, point.y));
      if (mousePosition) {
        context.lineTo(mousePosition.x, mousePosition.y);
      }
      const lineDef = LINE_DEFS.find((item) => item.name === lineType) ?? LINE_DEFS[0];
      if (drawMode === "area") {
        context.strokeStyle = "#D4AF37";
        context.lineWidth = 2;
        context.setLineDash([6, 4]);
      } else {
        context.strokeStyle = lineDef.color;
        context.lineWidth = 2;
        context.setLineDash(lineDef.dash.length ? lineDef.dash : [5, 4]);
      }
      context.stroke();

      canvasPoints.forEach((point, index) => {
        context.setLineDash([]);
        context.beginPath();
        context.arc(point.x, point.y, index === 0 ? 8 : 4, 0, Math.PI * 2);
        context.fillStyle = index === 0 ? "#D4AF37" : "rgba(212,175,55,0.5)";
        context.fill();
        if (index === 0) {
          context.strokeStyle = "#ffffff";
          context.lineWidth = 1.5;
          context.stroke();
        }
      });

      if (drawMode === "area" && mousePosition && currentPoints.length > 2) {
        const first = toCanvas(currentPoints[0]);
        if (Math.hypot(first.x - mousePosition.x, first.y - mousePosition.y) < 20) {
          context.setLineDash([3, 3]);
          context.strokeStyle = "#4ade80";
          context.lineWidth = 2;
          context.beginPath();
          context.arc(first.x, first.y, 13, 0, Math.PI * 2);
          context.stroke();
        }
      }

      if (drawMode === "line" && mousePosition) {
        const hint = "Double-click to finish";
        context.setLineDash([]);
        context.font = "10px Montserrat, sans-serif";
        const width = context.measureText(hint).width + 16;
        context.fillStyle = "rgba(0,0,0,0.7)";
        context.fillRect(mousePosition.x + 12, mousePosition.y - 20, width, 16);
        context.fillStyle = "#bbbbbb";
        context.textAlign = "left";
        context.fillText(hint, mousePosition.x + 20, mousePosition.y - 8);
      }
      context.restore();
    }

    if (toolMode === "calibrate" && calibrationLine?.start) {
      const start = toCanvas(calibrationLine.start);
      context.save();
      if (calibrationLine.end) {
        const end = toCanvas(calibrationLine.end);
        context.beginPath();
        context.moveTo(start.x, start.y);
        context.lineTo(end.x, end.y);
        context.strokeStyle = "#F97316";
        context.lineWidth = 2.5;
        context.stroke();
        [start, end].forEach((point) => {
          context.beginPath();
          context.arc(point.x, point.y, 5, 0, Math.PI * 2);
          context.fillStyle = "#F97316";
          context.fill();
        });
      } else if (mousePosition) {
        context.beginPath();
        context.moveTo(start.x, start.y);
        context.lineTo(mousePosition.x, mousePosition.y);
        context.strokeStyle = "#F97316";
        context.lineWidth = 2;
        context.setLineDash([5, 4]);
        context.stroke();
      }
      context.restore();
    }
  }, [bgImage, bgOpacity, calibrationLine, currentPoints, drawMode, lineType, mousePosition, pan.x, pan.y, selection, survey, toCanvas, toolMode, zoom]);

  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      drawCanvas();
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [drawCanvas]);

  const saveSurvey = useCallback(
    async (mode: "manual" | "auto" = "manual") => {
      try {
        setSaveState("saving");
        setError(null);
        const payload = {
          ...survey,
          status: survey.scale_px_per_m && survey.sections.length > 0 ? "complete" : survey.status
        } satisfies RoofSurveyRecord;
        if (onSave) {
          await onSave(payload);
        } else {
          const response = await fetch(`/api/roof-surveys/${surveyId}/save`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ survey: payload })
          });
          const result = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
          if (!response.ok || result?.ok === false) {
            throw new Error(result?.error || "Unable to save the roof survey.");
          }
        }
        lastSavedPayloadRef.current = JSON.stringify(payload);
        setSaveState("saved");
        if (mode === "manual") {
          router.refresh();
        }
      } catch (saveError) {
        setSaveState("error");
        setError(saveError instanceof Error ? saveError.message : "Unable to save the roof survey.");
      }
    },
    [onSave, router, survey, surveyId]
  );

  useEffect(() => {
    const serialized = JSON.stringify(survey);
    if (!lastSavedPayloadRef.current) {
      lastSavedPayloadRef.current = serialized;
      return;
    }
    if (serialized === lastSavedPayloadRef.current) {
      return;
    }
    pendingSaveRef.current = true;
    setSaveState("idle");
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      if (pendingSaveRef.current) {
        pendingSaveRef.current = false;
        void saveSurvey("auto");
      }
    }, 3000);

    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, [saveSurvey, survey]);

  function getCanvasPoint(event: React.MouseEvent<HTMLCanvasElement> | WheelEvent) {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
  }

  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      if (isPanning) return;
      const canvasPoint = getCanvasPoint(event);
      const worldPoint = toWorld(canvasPoint);

      if (toolMode === "calibrate") {
        if (!calibrationLine?.start) {
          setCalibrationLine({ start: worldPoint, end: null });
        } else if (!calibrationLine.end) {
          setCalibrationLine((current) => (current ? { ...current, end: worldPoint } : current));
        }
        return;
      }

      if (toolMode === "select") {
        const areaIndex = survey.sections.findIndex((section) => section.points.length >= 3 && ptInPoly(worldPoint, section.points));
        if (areaIndex >= 0) {
          setSelection({ kind: "area", idx: areaIndex });
          setTab("areas");
          return;
        }
        const lineIndex = survey.lines.findIndex((line) => {
          for (let pointIndex = 0; pointIndex < line.points.length - 1; pointIndex += 1) {
            if (distToSeg(worldPoint, line.points[pointIndex], line.points[pointIndex + 1]) < 10 / zoom) {
              return true;
            }
          }
          return false;
        });
        if (lineIndex >= 0) {
          setSelection({ kind: "line", idx: lineIndex });
          setTab("lines");
          return;
        }
        const featureIndex = survey.features.findIndex((feature) => Math.hypot(feature.point.x - worldPoint.x, feature.point.y - worldPoint.y) < 16 / zoom);
        if (featureIndex >= 0) {
          setSelection({ kind: "feature", idx: featureIndex });
          setTab("features");
          return;
        }
        setSelection(null);
        return;
      }

      if (toolMode === "draw") {
        if (drawMode === "feature") {
          const featureDef = FEATURE_DEFS.find((item) => item.name === featureType) ?? FEATURE_DEFS[0];
          const nextFeature: RoofSurveyFeature = {
            point: worldPoint,
            type: featureType,
            label: featureType,
            notes: "",
            color: featureDef.color
          };
          setFeatures((current) => [...current, nextFeature]);
          setSelection({ kind: "feature", idx: survey.features.length });
          setTab("features");
          return;
        }

        const snapped = getSnappedPoint(worldPoint);
        if (drawMode === "area" && currentPoints.length > 2) {
          const firstPoint = toCanvas(currentPoints[0]);
          if (Math.hypot(firstPoint.x - canvasPoint.x, firstPoint.y - canvasPoint.y) < 18) {
            const color = AREA_COLORS[survey.sections.length % AREA_COLORS.length];
            const newSection: RoofSurveySection = {
              points: currentPoints,
              label: `Section ${survey.sections.length + 1}`,
              type: "Flat - EPDM",
              condition: "Fair",
              color,
              notes: ""
            };
            setSections((current) => [...current, newSection]);
            setCurrentPoints([]);
            setSelection({ kind: "area", idx: survey.sections.length });
            setTab("areas");
            setToolMode("select");
            return;
          }
        }

        setCurrentPoints((current) => [...current, snapped]);
      }
    },
    [calibrationLine, currentPoints, drawMode, featureType, getSnappedPoint, isPanning, setFeatures, setLines, setSections, setSelection, survey.features, survey.lines, survey.sections, toCanvas, toWorld, toolMode, zoom]
  );

  const handleDoubleClick = useCallback(() => {
    if (toolMode === "draw" && drawMode === "line" && currentPoints.length >= 2) {
      const lineDef = LINE_DEFS.find((item) => item.name === lineType) ?? LINE_DEFS[0];
      const newLine: RoofSurveyLine = {
        points: currentPoints,
        type: lineType,
        label: lineType,
        color: lineDef.color,
        notes: ""
      };
      setLines((current) => [...current, newLine]);
      setCurrentPoints([]);
      setSelection({ kind: "line", idx: survey.lines.length });
      setTab("lines");
      setToolMode("select");
    }
  }, [currentPoints, drawMode, lineType, setLines, setSelection, survey.lines.length, toolMode]);

  const handleMouseMove = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      const canvasPoint = getCanvasPoint(event);
      setMousePosition(canvasPoint);
      if (isPanning && panStart) {
        setPan({
          x: panStart.panX + (canvasPoint.x - panStart.x),
          y: panStart.panY + (canvasPoint.y - panStart.y)
        });
      }
    },
    [isPanning, panStart]
  );

  const handleMouseDown = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      if (toolMode === "pan" || event.button === 1 || event.altKey) {
        const canvasPoint = getCanvasPoint(event);
        setIsPanning(true);
        setPanStart({ x: canvasPoint.x, y: canvasPoint.y, panX: pan.x, panY: pan.y });
      }
    },
    [pan.x, pan.y, toolMode]
  );

  const handleWheel = useCallback((event: React.WheelEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    const canvasPoint = getCanvasPoint(event.nativeEvent);
    const factor = event.deltaY < 0 ? 1.12 : 0.89;
    setZoom((currentZoom) => {
      const nextZoom = Math.min(8, Math.max(0.1, currentZoom * factor));
      setPan((currentPan) => ({
        x: canvasPoint.x - (canvasPoint.x - currentPan.x) * (nextZoom / currentZoom),
        y: canvasPoint.y - (canvasPoint.y - currentPan.y) * (nextZoom / currentZoom)
      }));
      return nextZoom;
    });
  }, []);

  function applyCalibration() {
    if (!calibrationLine?.start || !calibrationLine.end || !calibrationInput) return;
    const pixels = Math.hypot(calibrationLine.end.x - calibrationLine.start.x, calibrationLine.end.y - calibrationLine.start.y);
    const metres = Number.parseFloat(calibrationInput);
    if (pixels > 0 && metres > 0) {
      updateSurvey({ scale_px_per_m: pixels / metres });
      setCalibrationLine(null);
      setCalibrationInput("");
      setToolMode("draw");
    }
  }

  async function uploadImage(file: File) {
    setUploadingImage(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("file", file);
      const response = await fetch(`/api/roof-surveys/${surveyId}/image`, {
        method: "POST",
        body: formData
      });
      const result = (await response.json().catch(() => null)) as
        | { ok?: boolean; error?: string; storage_path?: string; signed_url?: string }
        | null;
      if (!response.ok || result?.ok === false || !result?.storage_path || !result?.signed_url) {
        throw new Error(result?.error || "Unable to upload the survey image.");
      }
      updateSurvey({
        satellite_image_path: result.storage_path,
        satellite_image_url: result.signed_url
      });
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Unable to upload the survey image.");
    } finally {
      setUploadingImage(false);
    }
  }

  function updateSection(index: number, updates: Partial<RoofSurveySection>) {
    setSections((current) => current.map((section, currentIndex) => (currentIndex === index ? { ...section, ...updates } : section)));
  }

  function updateLine(index: number, updates: Partial<RoofSurveyLine>) {
    setLines((current) => current.map((line, currentIndex) => (currentIndex === index ? { ...line, ...updates } : line)));
  }

  function updateFeature(index: number, updates: Partial<RoofSurveyFeature>) {
    setFeatures((current) => current.map((feature, currentIndex) => (currentIndex === index ? { ...feature, ...updates } : feature)));
  }

  async function sendToQuote() {
    if (inventory.length === 0) {
      setError("Draw at least one measured section, line, or feature before sending to quote.");
      return;
    }
    setError(null);
    if (onExportToQuote) {
      await onExportToQuote(inventory);
      return;
    }
    const response = await fetch(`/api/roof-surveys/${surveyId}/apply-to-quote`, {
      method: "POST"
    });
    const result = (await response.json().catch(() => null)) as { ok?: boolean; error?: string; quote_url?: string } | null;
    if (!response.ok || result?.ok === false || !result?.quote_url) {
      setError(result?.error || "Unable to send the measured BOM into the quote.");
      return;
    }
    router.push(result.quote_url as Route);
  }

  const saveLabel = saveState === "saving" ? "Saving..." : saveState === "saved" ? "Saved" : saveState === "error" ? "Save failed" : "Idle";

  return (
    <div className="overflow-hidden rounded-[1.5rem] border border-[var(--border)] bg-[var(--surface)]">
      <div className="grid min-h-[78vh] md:grid-cols-[340px_1fr]">
        {showPanel ? (
          <aside className="border-b border-[var(--border)] bg-card2 md:border-b-0 md:border-r">
            <div className="border-b border-[var(--border)] px-5 py-5">
              <p className="section-kicker text-[0.65rem] uppercase">Roof Survey Tool</p>
              <input
                className="mt-3 w-full bg-transparent font-display text-2xl text-[var(--gold-l)] outline-none"
                onChange={(event) => updateSurvey({ project_name: event.target.value })}
                value={survey.project_name}
              />
              <p className="mt-2 text-xs text-[var(--muted)]">Trace the roof, measure the geometry, then push the bill of quantities into the saved quote draft.</p>
            </div>

            <div className="space-y-5 px-5 py-5">
              <section>
                <div
                  className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--card)] p-4 text-center transition hover:border-[var(--gold)]"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    if (event.dataTransfer.files[0]) void uploadImage(event.dataTransfer.files[0]);
                  }}
                >
                  <div className="text-3xl">🛰️</div>
                  <p className="mt-2 text-sm text-white">{uploadingImage ? "Uploading image..." : survey.satellite_image_path ? "Replace satellite image" : "Upload satellite image"}</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">Drop a Google Maps screenshot or tap to choose a file.</p>
                  <input
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => {
                      if (event.target.files?.[0]) void uploadImage(event.target.files[0]);
                    }}
                    ref={fileInputRef}
                    type="file"
                  />
                </div>
                {survey.satellite_image_path ? (
                  <div className="mt-3 flex items-center gap-3 text-xs text-[var(--muted)]">
                    <span>Image opacity</span>
                    <input
                      className="flex-1 accent-[var(--gold)]"
                      max={1}
                      min={0.2}
                      onChange={(event) => setBgOpacity(Number.parseFloat(event.target.value))}
                      step={0.05}
                      type="range"
                      value={bgOpacity}
                    />
                    <span>{Math.round(bgOpacity * 100)}%</span>
                  </div>
                ) : null}
              </section>

              <section>
                <p className="label">Draw Mode</p>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {[
                    ["area", "Area"],
                    ["line", "Line"],
                    ["feature", "Feature"]
                  ].map(([mode, label]) => (
                    <button
                      className={`rounded-xl border px-3 py-2 text-xs font-semibold ${drawMode === mode && toolMode === "draw" ? "border-[var(--gold)] bg-[var(--gold)]/10 text-[var(--gold-l)]" : "border-[var(--border)] text-[var(--muted)]"}`}
                      key={mode}
                      onClick={() => {
                        setDrawMode(mode as DrawMode);
                        setToolMode("draw");
                        setCurrentPoints([]);
                      }}
                      type="button"
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {drawMode === "line" && toolMode === "draw" ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {LINE_DEFS.map((item) => (
                      <button
                        className={`rounded-full border px-3 py-1 text-[0.7rem] ${lineType === item.name ? "text-white" : "text-[var(--muted)]"}`}
                        key={item.name}
                        onClick={() => setLineType(item.name)}
                        style={{ borderColor: lineType === item.name ? item.color : "var(--border)", color: lineType === item.name ? item.color : undefined }}
                        type="button"
                      >
                        {item.name}
                      </button>
                    ))}
                  </div>
                ) : null}
                {drawMode === "feature" && toolMode === "draw" ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {FEATURE_DEFS.map((item) => (
                      <button
                        className={`rounded-full border px-3 py-1 text-[0.7rem] ${featureType === item.name ? "text-white" : "text-[var(--muted)]"}`}
                        key={item.name}
                        onClick={() => setFeatureType(item.name)}
                        style={{ borderColor: featureType === item.name ? item.color : "var(--border)", color: featureType === item.name ? item.color : undefined }}
                        type="button"
                      >
                        {item.icon} {item.name}
                      </button>
                    ))}
                  </div>
                ) : null}
                <div className="mt-4 grid grid-cols-4 gap-2">
                  {[
                    ["select", "Select"],
                    ["pan", "Pan"],
                    ["calibrate", "Scale"],
                    ["snap", snap ? "Snap On" : "Snap Off"]
                  ].map(([mode, label]) => (
                    <button
                      className={`rounded-xl border px-3 py-2 text-xs font-semibold ${
                        (mode === "snap" && snap) || toolMode === mode ? "border-[var(--gold)] bg-[var(--gold)]/10 text-[var(--gold-l)]" : "border-[var(--border)] text-[var(--muted)]"
                      }`}
                      key={mode}
                      onClick={() => {
                        if (mode === "snap") {
                          setSnap((current) => !current);
                          return;
                        }
                        setToolMode(mode as ToolMode);
                        setCurrentPoints([]);
                      }}
                      type="button"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </section>

              {toolMode === "calibrate" ? (
                <section className="rounded-2xl border border-[#F97316] bg-[#140900] p-4">
                  <p className="text-sm font-semibold text-[#F97316]">Set survey scale</p>
                  <p className="mt-2 text-xs text-[var(--muted)]">Click two known points on the image, then enter the real distance in metres.</p>
                  <p className="mt-3 text-xs text-[var(--gold-l)]">
                    {!calibrationLine?.start ? "1. Click the first point" : !calibrationLine.end ? "2. Click the second point" : "3. Enter the real-world distance"}
                  </p>
                  {calibrationLine?.end ? (
                    <div className="mt-3 flex items-center gap-3">
                      <input
                        className="field"
                        onChange={(event) => setCalibrationInput(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") applyCalibration();
                        }}
                        placeholder="e.g. 12.5"
                        type="number"
                        value={calibrationInput}
                      />
                      <span className="text-xs text-[var(--muted)]">m</span>
                      <button className="button-secondary" onClick={applyCalibration} type="button">
                        Apply
                      </button>
                    </div>
                  ) : null}
                  {survey.scale_px_per_m ? <p className="mt-3 text-xs text-[#4ade80]">Scale set at {survey.scale_px_per_m.toFixed(2)} px per metre.</p> : null}
                </section>
              ) : null}

              <section>
                <div className="grid grid-cols-4 gap-1 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-1">
                  {[
                    ["areas", "Areas"],
                    ["lines", "Lines"],
                    ["features", "Features"],
                    ["inventory", "BOM"]
                  ].map(([panel, label]) => (
                    <button
                      className={`rounded-xl px-3 py-2 text-xs font-semibold ${tab === panel ? "bg-[var(--gold)]/10 text-[var(--gold-l)]" : "text-[var(--muted)]"}`}
                      key={panel}
                      onClick={() => setTab(panel as typeof tab)}
                      type="button"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </section>

              <section className="space-y-3">
                {tab === "areas"
                  ? survey.sections.map((section, index) => {
                      const area = section.area_m2 ?? getSectionArea(section, survey.scale_px_per_m);
                      return (
                        <div
                          className={`rounded-2xl border p-3 ${selection?.kind === "area" && selection.idx === index ? "border-[var(--gold)] bg-[var(--gold)]/10" : "border-[var(--border)] bg-[var(--card)]"}`}
                          key={`${section.label}-${index}`}
                          onClick={() => setSelection({ kind: "area", idx: index })}
                        >
                          <div className="flex items-center gap-2">
                            <div className="h-3 w-3 rounded-sm" style={{ backgroundColor: section.color }} />
                            <input className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none" onChange={(event) => updateSection(index, { label: event.target.value })} value={section.label} />
                            <button className="text-sm text-[#ff9b9b]" onClick={() => setSections((current) => current.filter((_, currentIndex) => currentIndex !== index))} type="button">
                              Delete
                            </button>
                          </div>
                          <select className="field mt-3" onChange={(event) => updateSection(index, { type: event.target.value })} value={section.type}>
                            {SECTION_TYPES.map((item) => (
                              <option key={item} value={item}>
                                {item}
                              </option>
                            ))}
                          </select>
                          <select className="field mt-3" onChange={(event) => updateSection(index, { condition: event.target.value as RoofSurveySection["condition"] })} value={section.condition}>
                            {CONDITIONS.map((item) => (
                              <option key={item} value={item}>
                                {item}
                              </option>
                            ))}
                          </select>
                          {area ? <p className="mt-3 text-sm font-semibold text-[var(--gold-l)]">{area.toFixed(2)} m²</p> : null}
                          <textarea className="field mt-3 min-h-20" onChange={(event) => updateSection(index, { notes: event.target.value })} placeholder="Notes..." value={section.notes} />
                        </div>
                      );
                    })
                  : null}

                {tab === "lines"
                  ? survey.lines.map((line, index) => {
                      const length = line.length_lm ?? getLineLength(line, survey.scale_px_per_m);
                      return (
                        <div
                          className={`rounded-2xl border p-3 ${selection?.kind === "line" && selection.idx === index ? "bg-[#0a1220]" : "bg-[var(--card)]"} border-[var(--border)]`}
                          key={`${line.label}-${index}`}
                          onClick={() => setSelection({ kind: "line", idx: index })}
                        >
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-5 rounded-full" style={{ backgroundColor: line.color }} />
                            <input className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none" onChange={(event) => updateLine(index, { label: event.target.value })} value={line.label} />
                            <button className="text-sm text-[#ff9b9b]" onClick={() => setLines((current) => current.filter((_, currentIndex) => currentIndex !== index))} type="button">
                              Delete
                            </button>
                          </div>
                          <select
                            className="field mt-3"
                            onChange={(event) => {
                              const lineDef = LINE_DEFS.find((item) => item.name === event.target.value);
                              updateLine(index, { type: event.target.value, color: lineDef?.color ?? line.color });
                            }}
                            value={line.type}
                          >
                            {LINE_DEFS.map((item) => (
                              <option key={item.name} value={item.name}>
                                {item.name}
                              </option>
                            ))}
                          </select>
                          {length ? <p className="mt-3 text-sm font-semibold text-[var(--gold-l)]">{length.toFixed(2)} lm</p> : null}
                          <textarea className="field mt-3 min-h-20" onChange={(event) => updateLine(index, { notes: event.target.value })} placeholder="Notes..." value={line.notes} />
                        </div>
                      );
                    })
                  : null}

                {tab === "features"
                  ? survey.features.map((feature, index) => (
                      <div
                        className={`rounded-2xl border p-3 ${selection?.kind === "feature" && selection.idx === index ? "bg-[#0d120a]" : "bg-[var(--card)]"} border-[var(--border)]`}
                        key={`${feature.label}-${index}`}
                        onClick={() => setSelection({ kind: "feature", idx: index })}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-lg" style={{ color: feature.color }}>
                            {getFeatureIcon(feature)}
                          </span>
                          <input className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none" onChange={(event) => updateFeature(index, { label: event.target.value })} value={feature.label} />
                          <button className="text-sm text-[#ff9b9b]" onClick={() => setFeatures((current) => current.filter((_, currentIndex) => currentIndex !== index))} type="button">
                            Delete
                          </button>
                        </div>
                        <select
                          className="field mt-3"
                          onChange={(event) => {
                            const featureDef = FEATURE_DEFS.find((item) => item.name === event.target.value);
                            updateFeature(index, { type: event.target.value, color: featureDef?.color ?? feature.color });
                          }}
                          value={feature.type}
                        >
                          {FEATURE_DEFS.map((item) => (
                            <option key={item.name} value={item.name}>
                              {item.icon} {item.name}
                            </option>
                          ))}
                        </select>
                        <textarea className="field mt-3 min-h-20" onChange={(event) => updateFeature(index, { notes: event.target.value })} placeholder="Notes..." value={feature.notes} />
                      </div>
                    ))
                  : null}

                {tab === "inventory" ? (
                  <div className="space-y-3">
                    {inventory.length === 0 ? <p className="text-sm text-[var(--muted)]">Calibrate the image and draw some roof data to build the bill of quantities.</p> : null}
                    {inventory.map((item) => (
                      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3" key={`${item.unit}-${item.label}`}>
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-white">{item.label}</p>
                            <p className="text-xs text-[var(--muted)]">{item.source_type === "section" ? "Measured area" : item.source_type === "line" ? "Measured run" : "Counted feature"}</p>
                          </div>
                          <p className="font-display text-2xl" style={{ color: item.color }}>
                            {item.qty.toFixed(item.unit === "no." ? 0 : 2)} {item.unit}
                          </p>
                        </div>
                      </div>
                    ))}
                    {inventory.length > 0 ? (
                      <div className="rounded-2xl border border-[var(--gold)]/30 bg-[var(--gold)]/5 p-4">
                        <p className="text-xs uppercase tracking-[0.25em] text-[var(--gold)]">Totals</p>
                        <div className="mt-3 space-y-1 text-sm text-[var(--text)]">
                          <p>Total measured area: {totals.totalAreaM2.toFixed(2)} m²</p>
                          <p>Total measured runs: {totals.totalLinesLm.toFixed(2)} lm</p>
                          <p>Total roof features: {totals.totalFeatures}</p>
                        </div>
                        <button className="button-primary mt-4 w-full" onClick={() => void sendToQuote()} type="button">
                          Send to Quote Draft
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {tab !== "inventory" && currentPoints.length > 0 ? (
                  <button className="button-ghost w-full" onClick={() => setCurrentPoints([])} type="button">
                    Cancel In-Progress Drawing
                  </button>
                ) : null}
              </section>

              <section>
                <label className="label" htmlFor="roof-survey-notes">
                  Survey Notes
                </label>
                <textarea className="field mt-2 min-h-24" id="roof-survey-notes" onChange={(event) => updateSurvey({ notes: event.target.value })} value={survey.notes} />
              </section>
            </div>
          </aside>
        ) : null}

        <div className="relative min-h-[78vh] bg-[var(--obsidian)]">
          <div className="absolute left-0 right-0 top-0 z-10 flex flex-wrap items-center gap-3 border-b border-[var(--border)] bg-black/75 px-4 py-3 backdrop-blur">
            <button className="button-ghost" onClick={() => setShowPanel((current) => !current)} type="button">
              {showPanel ? "Hide Panel" : "Show Panel"}
            </button>
            <div className="text-xs uppercase tracking-[0.28em] text-[var(--gold)]">{survey.project_name}</div>
            <div className="text-xs text-[var(--muted)]">
              {toolMode === "draw" && drawMode === "area"
                ? "Click to place polygon points, then click the first point to close the roof section."
                : toolMode === "draw" && drawMode === "line"
                  ? "Click to add line points, then double-click to finish the measured run."
                  : toolMode === "draw" && drawMode === "feature"
                    ? "Click anywhere on the roof image to place the selected feature."
                    : toolMode === "calibrate"
                      ? "Click two reference points, then enter the real-world distance."
                      : "Select a shape to edit it or use Pan mode to move around the image."}
            </div>
            <div className="ml-auto flex items-center gap-2">
              <span className={`text-xs ${saveState === "error" ? "text-[#ff9b9b]" : "text-[var(--muted)]"}`}>{saveLabel}</span>
              <button className="button-secondary" onClick={() => void saveSurvey("manual")} type="button">
                Save
              </button>
              <button className="button-ghost" onClick={() => setZoom((current) => Math.min(8, current * 1.2))} type="button">
                +
              </button>
              <button
                className="button-ghost"
                onClick={() => {
                  setZoom(1);
                  setPan({ x: 0, y: 0 });
                }}
                type="button"
              >
                {Math.round(zoom * 100)}%
              </button>
              <button className="button-ghost" onClick={() => setZoom((current) => Math.max(0.1, current / 1.2))} type="button">
                -
              </button>
            </div>
          </div>

          <canvas
            className="block h-full min-h-[78vh] w-full"
            onClick={handleClick}
            onDoubleClick={handleDoubleClick}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={() => {
              setIsPanning(false);
              setPanStart(null);
            }}
            onWheel={handleWheel}
            ref={canvasRef}
            style={{ cursor: toolMode === "pan" || isPanning ? "grab" : toolMode === "draw" ? "crosshair" : "default" }}
          />

          {!bgImage && survey.sections.length === 0 && survey.lines.length === 0 && survey.features.length === 0 ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6">
              <div className="max-w-xl text-left">
                <div className="text-5xl opacity-15">🏠</div>
                <p className="mt-4 font-display text-3xl text-[var(--gold-l)]">Roof Survey Tool</p>
                <div className="mt-6 space-y-3 text-sm text-[var(--muted)]">
                  <p>1. Upload a satellite screenshot from Google Maps.</p>
                  <p>2. Calibrate the scale using a known measurement or scale bar.</p>
                  <p>3. Trace roof sections as polygons and add lines like ridges, valleys, hips, eaves, and verges.</p>
                  <p>4. Place features such as chimneys, skylights, and vents.</p>
                  <p>5. Review the live bill of quantities and send it into the quote draft.</p>
                </div>
              </div>
            </div>
          ) : null}

          {error ? (
            <div className="absolute bottom-4 left-4 right-4 rounded-2xl border border-[#8f3b3b] bg-[#220f0f]/95 px-4 py-3 text-sm text-[#ffb4b4] md:left-auto md:right-4 md:w-[420px]">
              {error}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
