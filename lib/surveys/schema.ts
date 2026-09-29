export const SURVEY_MODULES = ["pitched_roof", "flat_roof", "fascias", "chimney", "other"] as const;
export type SurveyModuleKey = (typeof SURVEY_MODULES)[number];

export type SurveyFieldDefinition = {
  label: string;
  type: "string" | "number" | "boolean" | "string_array" | "enum";
  unit?: string;
  allowed?: readonly string[];
  description?: string;
};

const condition = ["Good", "Fair", "Poor", "Failed", "N/A"] as const;
const text = (label: string, description?: string): SurveyFieldDefinition => ({ label, type: "string", description });
const number = (label: string, unit?: string): SurveyFieldDefinition => ({ label, type: "number", unit });
const boolean = (label: string): SurveyFieldDefinition => ({ label, type: "boolean" });
const enumeration = (label: string, allowed: readonly string[]): SurveyFieldDefinition => ({ label, type: "enum", allowed });

export const GLOBAL_SURVEY_FIELDS: Record<string, SurveyFieldDefinition> = {
  surveyor_name: text("Surveyor"),
  roof_condition: enumeration("Overall Condition", condition),
  problem_observed: text("Problem Observed"),
  suspected_cause: text("Suspected Cause"),
  recommended_works: text("Recommended Works"),
  measurements: text("Manual Measurement Notes", "Keep unallocated or approximate spoken measurements here with their uncertainty."),
  access_notes: text("Access Notes"),
  customer_concerns: text("Customer Concerns"),
  weather_notes: text("Weather Notes"),
  safety_notes: text("Safety Notes"),
  voice_note_transcript: text("Voice Note Transcript", "Only an actual transcript belongs here."),
  raw_notes: text("Other Notes"),
  scaffold_required: boolean("Scaffold Required"),
  scaffold_notes: text("Scaffold Notes"),
  no_photo_confirmation: boolean("Ready For Quote Without Photos")
};

export const SURVEY_MODULE_SCHEMA: Record<SurveyModuleKey, { label: string; fields: Record<string, SurveyFieldDefinition> }> = {
  pitched_roof: {
    label: "Pitched / Tiled",
    fields: {
      roof_style: enumeration("Roof Configuration", ["Standard Up & Over", "Hipped", "Half-Hipped", "Mansard", "Gambrel", "Dormer", "L-Shape", "T-Shape", "Cross-Hipped", "Mono-Pitch", "Valley Roof", "Lean-To"]),
      roof_style_notes: text("Configuration Notes"), tile_type: enumeration("Covering Type", ["Concrete Interlocking", "Plain Clay", "Marley Modern", "Redland 49", "Redland 51", "Natural Slate", "Artificial Slate", "Rosemary", "Cedar Shingle", "Stone Slate", "Double Cambered Clay", "Unknown"]), tile_age: text("Covering Age"),
      tile_condition: enumeration("Covering Condition", condition), tile_issues: { label: "Covering Issues", type: "string_array", allowed: ["Cracked", "Slipped", "Missing", "Nail Fatigue", "Frost Damage", "Porous", "Delaminating", "Patch Repairs", "Colour Fading"] },
      pitch_angle_deg: number("Pitch Angle", "degree"), ridge_length_m: number("Single Ridge Length", "m"), number_of_ridges: number("Number Of Ridges"),
      eaves_length_m: number("Eaves Length", "m"), verge_length_m: number("Verge Length", "m"), rafter_length_m: number("Rafter Length", "m"),
      hip_count: number("Hip Count"), total_hip_metres: number("Total Hip Metres", "m"), valley_count: number("Valley Count"), total_valley_metres: number("Total Valley Metres", "m"),
      roof_area_override_m2: number("Roof Area Override", "m²"),
      ridge_type: enumeration("Ridge Type", ["Mortar Bedded", "Dry Ridge System", "Half Round", "Angular", "Hog Back", "Unknown"]), ridge_condition: enumeration("Ridge Condition", condition),
      hip_type: enumeration("Hip Type", ["Mortar Bedded", "Dry Hip System", "Bonnet Hip", "Unknown"]), hip_condition: enumeration("Hip Condition", condition),
      valley_type: enumeration("Valley Type", ["Lead Lined", "GRP Trough", "Mortar", "Tile Valley", "Dry Valley", "Aluminium", "Unknown"]), valley_condition: enumeration("Valley Condition", condition),
      verge_type: enumeration("Verge Type", ["Mortar", "Dry Verge", "Barge Board", "Flush", "Unknown"]), verge_condition: enumeration("Verge Condition", condition),
      eaves_ventilation: enumeration("Eaves Ventilation", ["Over-Fascia Vent", "Soffit Vents", "Tile Vents", "Ridge Vent", "None", "Unknown"]),
      bird_guard_present: boolean("Bird Guard Present"), membrane_type: enumeration("Membrane Type", ["1F Felt", "Breathable Membrane", "Roofshield", "Tyvek", "None Visible", "Unknown"]),
      felt_condition: enumeration("Felt Condition", condition), batten_condition: enumeration("Batten Condition", condition), batten_notes: text("Batten Notes"),
      chimney_present: boolean("Chimney Present"), chimney_condition: enumeration("Chimney Condition", condition), chimney_flashings_condition: enumeration("Chimney Flashings", condition),
      chimney_flaunching_condition: enumeration("Chimney Flaunching", condition), chimney_pots: text("Chimney Pots"), chimney_cowls: boolean("Chimney Cowls"), chimney_repointing_needed: boolean("Chimney Repointing Needed"),
      solar_panels: boolean("Solar Panels"), solar_panel_count: number("Solar Panel Count"), roof_windows: boolean("Roof Windows"), roof_window_count: number("Roof Window Count"),
      aerial_present: boolean("Aerial Present"), satellite_present: boolean("Satellite Present"), vents_present: boolean("Vents Present"),
      moss_level: enumeration("Moss Coverage", ["None", "Light", "Moderate", "Heavy", "Severe"]), moss_treatment_recommended: boolean("Moss Treatment Recommended"),
      loft_inspected: boolean("Loft Inspected"), loft_daylight_visible: boolean("Daylight Visible In Loft"), loft_damp_patches: boolean("Loft Damp Patches"), loft_condensation: boolean("Loft Condensation"),
      loft_insulation_type: enumeration("Loft Insulation Type", ["Glass Wool", "Mineral Wool", "Spray Foam", "PIR Boards", "Sheep Wool", "None", "Unknown"]), loft_insulation_depth_mm: number("Loft Insulation Depth", "mm"), loft_notes: text("Loft Notes"),
      scaffold_type: enumeration("Scaffold Requirement", ["None", "Tower", "1 Elevation", "2 Elevations", "Full House", "Chimney Access"]), scaffold_elevations: text("Scaffold Elevations"), access_notes: text("Module Access Notes")
    }
  },
  flat_roof: {
    label: "Flat Roof", fields: {
      current_surface_type: enumeration("Current Surface Type", ["Felt", "EPDM", "GRP", "Lead", "Asphalt", "Liquid Applied", "Single Ply", "Unknown"]), approximate_age: text("Approximate Age"),
      length_m: number("Length", "m"), width_m: number("Width", "m"), perimeter_m: number("Perimeter", "m"), roof_area_override_m2: number("Area Override", "m²"),
      deck_condition: enumeration("Deck Condition", condition), drainage_condition: enumeration("Drainage Condition", condition), standing_water: boolean("Standing Water / Ponding"),
      upstands_condition: enumeration("Upstands Condition", condition), flashings_condition: enumeration("Flashings Condition", condition), outlets_count: number("Outlets Count"), rooflights: text("Rooflights / Openings"),
      recommended_system: enumeration("Recommended System", ["Danosa Option 3", "GRP", "EPDM", "Liquid Applied", "Lead", "Single Ply", "Other"])
    }
  },
  fascias: {
    label: "Fascias / Soffits / Gutters", fields: {
      current_material: enumeration("Current Material", ["uPVC White", "uPVC Black", "uPVC Anthracite", "Timber", "Composite", "Aluminium", "Unknown"]),
      fascia_condition: enumeration("Fascia Condition", condition), soffit_condition: enumeration("Soffit Condition", condition), guttering_condition: enumeration("Guttering Condition", condition), downpipe_condition: enumeration("Downpipe Condition", condition),
      colour_preference: text("Colour Preference"), front_run_m: number("Front Run", "m"), rear_run_m: number("Rear Run", "m"), left_run_m: number("Left Run", "m"), right_run_m: number("Right Run", "m"),
      total_linear_metres_override: number("Total Linear Metres Override", "m"), gutter_profile: enumeration("Gutter Profile", ["Half Round", "Square", "Ogee", "Cast Iron", "Unknown"]), cladding_details: text("Cladding / Extras")
    }
  },
  chimney: {
    label: "Chimney / Lead", fields: {
      chimney_count: number("Chimney Count"), chimney_condition: enumeration("Chimney Condition", condition), flaunching_condition: enumeration("Flaunching Condition", condition), lead_flashings_condition: enumeration("Lead Flashings Condition", condition),
      gas_flue_present: boolean("Gas Flue Present"), parapet_or_coping: boolean("Parapet / Coping Detail"), chimney_pots: text("Chimney Pots"), chimney_cowls: boolean("Chimney Cowls"), repointing_needed: boolean("Repointing Needed"),
      lead_code: enumeration("Lead Code", ["Code 3", "Code 4", "Code 5", "Code 6", "Unknown"]), apron_length_m: number("Apron Length", "m"), back_gutter_length_m: number("Back Gutter Length", "m"), step_flashing_length_m: number("Step Flashing Length", "m"),
      total_measured_run_override_m: number("Measured Run Override", "m"), height_or_access_notes: text("Height / Access Notes"), additional_notes: text("Additional Notes")
    }
  },
  other: {
    label: "Other / Misc", fields: {
      survey_focus: text("Survey Focus"), measured_area_m2: number("Measured Area", "m²"), measured_run_m: number("Measured Run", "m"),
      recommended_system: enumeration("Recommended System", ["Repair Only", "Replace Section", "Full Replacement", "Inspection Only", "Other"]),
      issue_tags: { label: "Issue Tags", type: "string_array", allowed: ["Leak", "Storm Damage", "Maintenance", "Access Issue", "Condensation", "Leadwork", "Timber Rot", "Masonry"] }, additional_findings: text("Additional Findings")
    }
  }
};

export const MODULE_LABEL_TO_KEY = Object.fromEntries(Object.entries(SURVEY_MODULE_SCHEMA).map(([key, value]) => [value.label, key])) as Record<string, SurveyModuleKey>;

export function moduleForSurveyType(value: unknown): SurveyModuleKey {
  return MODULE_LABEL_TO_KEY[String(value ?? "")] ?? "other";
}

export function normaliseEnabledModules(value: unknown, primaryType?: unknown): SurveyModuleKey[] {
  const requested = Array.isArray(value) ? value.map(String) : [];
  const valid = requested.filter((item): item is SurveyModuleKey => SURVEY_MODULES.includes(item as SurveyModuleKey));
  const primary = moduleForSurveyType(primaryType);
  return Array.from(new Set([primary, ...valid]));
}

export function validateSurveyField(definition: SurveyFieldDefinition, value: unknown) {
  if (value === null || value === "") return { ok: true as const, value: null };
  if (definition.type === "boolean") return typeof value === "boolean" ? { ok: true as const, value } : { ok: false as const, error: "must be true or false" };
  if (definition.type === "number") return typeof value === "number" && Number.isFinite(value) ? { ok: true as const, value } : { ok: false as const, error: "must be a finite number" };
  if (definition.type === "string_array") {
    if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) return { ok: false as const, error: "must be a list of text values" };
    if (definition.allowed && value.some((item) => !definition.allowed?.includes(item))) return { ok: false as const, error: `contains a value outside: ${definition.allowed.join(", ")}` };
    return { ok: true as const, value };
  }
  if (typeof value !== "string") return { ok: false as const, error: "must be text" };
  if (definition.allowed && !definition.allowed.includes(value)) return { ok: false as const, error: `must be one of: ${definition.allowed.join(", ")}` };
  return { ok: true as const, value: value.trim() };
}
