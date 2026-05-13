"use client";

import { useState } from "react";
import type {
  RoofSurveyFeature,
  RoofSurveyLine,
  RoofSurveyRecord,
  RoofSurveySection,
  RoofSurveySelection
} from "@/lib/survey/types";

export function createEmptyRoofSurvey(jobId: string, projectName?: string): RoofSurveyRecord {
  return {
    job_id: jobId,
    project_name: projectName ?? "New Roof Survey",
    scale_px_per_m: null,
    satellite_image_path: null,
    satellite_image_url: null,
    notes: "",
    status: "draft",
    sections: [],
    lines: [],
    features: []
  };
}

export function useSurveyStore(initialSurvey: RoofSurveyRecord) {
  const [survey, setSurvey] = useState<RoofSurveyRecord>(initialSurvey);
  const [selection, setSelection] = useState<RoofSurveySelection>(null);

  function updateSurvey(updates: Partial<RoofSurveyRecord>) {
    setSurvey((current) => ({ ...current, ...updates }));
  }

  function setSections(update: RoofSurveySection[] | ((current: RoofSurveySection[]) => RoofSurveySection[])) {
    setSurvey((current) => ({
      ...current,
      sections: typeof update === "function" ? update(current.sections) : update
    }));
  }

  function setLines(update: RoofSurveyLine[] | ((current: RoofSurveyLine[]) => RoofSurveyLine[])) {
    setSurvey((current) => ({
      ...current,
      lines: typeof update === "function" ? update(current.lines) : update
    }));
  }

  function setFeatures(update: RoofSurveyFeature[] | ((current: RoofSurveyFeature[]) => RoofSurveyFeature[])) {
    setSurvey((current) => ({
      ...current,
      features: typeof update === "function" ? update(current.features) : update
    }));
  }

  return {
    survey,
    setSurvey,
    updateSurvey,
    selection,
    setSelection,
    setSections,
    setLines,
    setFeatures
  };
}
