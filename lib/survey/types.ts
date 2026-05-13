export interface SurveyPoint {
  x: number;
  y: number;
}

export interface RoofSurveySection {
  id?: string;
  label: string;
  type: string;
  condition: "Good" | "Fair" | "Poor" | "Critical";
  color: string;
  points: SurveyPoint[];
  area_m2?: number | null;
  notes: string;
}

export interface RoofSurveyLine {
  id?: string;
  label: string;
  type: string;
  color: string;
  points: SurveyPoint[];
  length_lm?: number | null;
  notes: string;
}

export interface RoofSurveyFeature {
  id?: string;
  label: string;
  type: string;
  color: string;
  point: SurveyPoint;
  notes: string;
}

export interface RoofSurveyRecord {
  id?: string;
  job_id: string;
  project_name: string;
  scale_px_per_m: number | null;
  satellite_image_path: string | null;
  satellite_image_url?: string | null;
  notes: string;
  status: "draft" | "complete";
  sections: RoofSurveySection[];
  lines: RoofSurveyLine[];
  features: RoofSurveyFeature[];
}

export interface BOMItem {
  label: string;
  qty: number;
  unit: "m²" | "lm" | "no.";
  color: string;
  source_type: "section" | "line" | "feature";
}

export type RoofSurveySelection =
  | { kind: "area"; idx: number }
  | { kind: "line"; idx: number }
  | { kind: "feature"; idx: number }
  | null;

export const AREA_COLORS = ["#D4AF37", "#3B82F6", "#10B981", "#F97316", "#8B5CF6", "#EF4444", "#06B6D4", "#F59E0B", "#84CC16", "#EC4899"] as const;

export const SECTION_TYPES = [
  "Flat - EPDM",
  "Flat - GRP",
  "Flat - Felt",
  "Flat - Lead",
  "Pitched - Tile",
  "Pitched - Slate",
  "Pitched - Metal",
  "Hip Roof",
  "Mansard",
  "Other"
] as const;

export const CONDITIONS = ["Good", "Fair", "Poor", "Critical"] as const;

export const LINE_DEFS = [
  { name: "Ridge", color: "#ffffff", dash: [] as number[] },
  { name: "Valley", color: "#60a5fa", dash: [] as number[] },
  { name: "Hip", color: "#D4AF37", dash: [] as number[] },
  { name: "Eaves", color: "#4ade80", dash: [] as number[] },
  { name: "Verge", color: "#a78bfa", dash: [] as number[] },
  { name: "Abutment", color: "#f87171", dash: [6, 3] },
  { name: "Parapet", color: "#fb923c", dash: [6, 3] },
  { name: "Flashing", color: "#f97316", dash: [4, 4] },
  { name: "Gutter", color: "#2dd4bf", dash: [] as number[] },
  { name: "Fascia", color: "#94a3b8", dash: [] as number[] },
  { name: "Soaker", color: "#c084fc", dash: [3, 3] },
  { name: "Other", color: "#888888", dash: [2, 4] }
] as const;

export const FEATURE_DEFS = [
  { name: "Skylight", icon: "◇", color: "#60a5fa" },
  { name: "Rooflight", icon: "□", color: "#60a5fa" },
  { name: "Chimney", icon: "▲", color: "#f87171" },
  { name: "Soil Pipe", icon: "○", color: "#a78bfa" },
  { name: "Vent / Cowl", icon: "⊙", color: "#4ade80" },
  { name: "Access Hatch", icon: "⊞", color: "#D4AF37" },
  { name: "Dormer", icon: "⬡", color: "#fb923c" },
  { name: "Solar Panel", icon: "▪", color: "#fbbf24" },
  { name: "Sat Dish", icon: "◉", color: "#94a3b8" },
  { name: "Extract Fan", icon: "✦", color: "#2dd4bf" },
  { name: "Other", icon: "✕", color: "#888888" }
] as const;
