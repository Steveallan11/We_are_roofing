"use client";

import type { ReactNode } from "react";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ROOF_TYPES, SURVEY_TYPES } from "@/lib/constants";
import type {
  ChimneyDetails,
  FasciaDetails,
  FlatRoofDetails,
  OtherSurveyDetails,
  PitchedRoofDetails,
  RoofType,
  SurveyAdaptiveSections,
  SurveyRecord,
  SurveyType
} from "@/lib/types";
import {
  calculateChimneyMetrics,
  calculateFasciaMetrics,
  calculateFlatMetrics,
  calculatePitchedMetrics
} from "@/lib/survey-utils";

type Props = {
  jobId: string;
  roofType: RoofType;
  surveyType: SurveyType;
  initialSurvey?: SurveyRecord | null;
};

const CONDITION_OPTIONS = ["Good", "Fair", "Poor", "Failed", "N/A"] as const;

const SURVEY_META: Array<{
  type: SurveyType;
  roofType: RoofType;
  icon: string;
  description: string;
}> = [
  { type: "Pitched / Tiled", roofType: "Pitched", icon: "Roof", description: "Tiles, ridges, valleys, loft checks and measured roof runs." },
  { type: "Flat Roof", roofType: "Flat", icon: "Deck", description: "Surface, deck, drainage, outlets, rooflights and system choice." },
  { type: "Fascias / Soffits / Gutters", roofType: "Fascia", icon: "Trim", description: "Runs, colours, gutter profiles and access details." },
  { type: "Chimney / Lead", roofType: "Chimney", icon: "Stack", description: "Flashings, flaunching, lead runs, pots and repointing." },
  { type: "Other / Misc", roofType: "Other", icon: "Other", description: "General inspections, defects and one-off roofing work." }
];

function toNumber(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toInput(value: string | number | boolean | null | undefined) {
  if (typeof value === "boolean") return value ? "true" : "false";
  return value == null ? "" : String(value);
}

function numberInput(value: number | null | undefined) {
  return value == null ? "" : String(value);
}

function FieldLabel({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label className="label" htmlFor={htmlFor}>
      {children}
    </label>
  );
}

function TextField({
  id,
  label,
  value,
  onChange,
  placeholder,
  multiline,
  hint
}: {
  id?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  hint?: string;
}) {
  return (
    <div>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {multiline ? (
        <textarea className="field min-h-24" id={id} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} value={value} />
      ) : (
        <input className="field" id={id} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} value={value} />
      )}
      {hint ? <p className="mt-1 text-xs text-[var(--dim)]">{hint}</p> : null}
    </div>
  );
}

function NumberField({
  id,
  label,
  value,
  onChange,
  unit,
  placeholder,
  hint
}: {
  id?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  unit?: string;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <div>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div className="flex items-center gap-2">
        <input
          className="field flex-1"
          id={id}
          inputMode="decimal"
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          step="0.1"
          type="number"
          value={value}
        />
        {unit ? <span className="w-10 shrink-0 text-xs text-[var(--dim)]">{unit}</span> : null}
      </div>
      {hint ? <p className="mt-1 text-xs text-[var(--dim)]">{hint}</p> : null}
    </div>
  );
}

function ToggleField({
  checked,
  hint,
  label,
  onChange
}: {
  checked: boolean;
  label: string;
  onChange: (value: boolean) => void;
  hint?: string;
}) {
  return (
    <button
      aria-pressed={checked}
      className={`flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition ${
        checked ? "border-[var(--gold)] bg-[rgba(212,175,55,0.14)]" : "border-[var(--border)] bg-[var(--card)]"
      }`}
      onClick={() => onChange(!checked)}
      type="button"
    >
      <span className={`mt-0.5 flex h-7 w-12 items-center rounded-full transition ${checked ? "bg-[var(--gold)]" : "bg-[var(--card2)]"}`}>
        <span className={`block h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-[22px]" : "translate-x-[2px]"}`} />
      </span>
      <span>
        <span className={`block text-sm font-semibold ${checked ? "text-[var(--gold-l)]" : "text-[var(--text)]"}`}>{label}</span>
        {hint ? <span className="mt-1 block text-xs text-[var(--dim)]">{hint}</span> : null}
      </span>
    </button>
  );
}

function ChipSelect({
  label,
  value,
  options,
  onChange,
  hint,
  multi
}: {
  label: string;
  value: string | string[];
  options: readonly string[];
  onChange: (value: string | string[]) => void;
  hint?: string;
  multi?: boolean;
}) {
  const selected = Array.isArray(value) ? value : [value];

  return (
    <div>
      <p className="label">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const active = selected.includes(option);
          return (
            <button
              className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                active
                  ? "border-[var(--gold)] bg-[rgba(212,175,55,0.14)] text-[var(--gold-l)]"
                  : "border-[var(--border)] bg-[var(--card)] text-[var(--dim)]"
              }`}
              key={option}
              onClick={() => {
                if (multi) {
                  const current = Array.isArray(value) ? value : [];
                  onChange(active ? current.filter((item) => item !== option) : [...current, option]);
                } else {
                  onChange(active ? "" : option);
                }
              }}
              type="button"
            >
              {option}
            </button>
          );
        })}
      </div>
      {hint ? <p className="mt-1 text-xs text-[var(--dim)]">{hint}</p> : null}
    </div>
  );
}

function ConditionButtons({
  label,
  value,
  onChange,
  hint
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
}) {
  const styles: Record<string, string> = {
    Good: "border-emerald-500 bg-emerald-600 text-white",
    Fair: "border-yellow-500 bg-yellow-600 text-white",
    Poor: "border-orange-500 bg-orange-600 text-white",
    Failed: "border-red-500 bg-red-600 text-white",
    "N/A": "border-zinc-600 bg-zinc-700 text-white"
  };

  return (
    <div>
      <p className="label">{label}</p>
      <div className="grid grid-cols-5 gap-2">
        {CONDITION_OPTIONS.map((option) => {
          const active = value === option;
          return (
            <button
              className={`rounded-xl border px-2 py-2 text-xs font-bold transition ${active ? styles[option] : "border-[var(--border)] bg-[var(--card)] text-[var(--dim)]"}`}
              key={option}
              onClick={() => onChange(active ? "" : option)}
              type="button"
            >
              {option}
            </button>
          );
        })}
      </div>
      {hint ? <p className="mt-1 text-xs text-[var(--dim)]">{hint}</p> : null}
    </div>
  );
}

function SurveySection({
  title,
  subtitle,
  isOpen,
  onToggle,
  children
}: {
  title: string;
  subtitle?: string;
  isOpen: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="card overflow-hidden">
      <button className="w-full px-5 py-4 text-left" onClick={onToggle} type="button">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="section-kicker text-[0.65rem] uppercase">{title}</p>
            {subtitle ? <p className="mt-2 text-sm text-[var(--muted)]">{subtitle}</p> : null}
          </div>
          <span className={`text-sm text-[var(--gold-l)] transition-transform ${isOpen ? "rotate-180" : ""}`}>▼</span>
        </div>
      </button>
      {isOpen ? (
        <>
          <div className="gold-divider mx-5" />
          <div className="p-5">{children}</div>
        </>
      ) : null}
    </div>
  );
}

function MetricCard({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
      <p className="label">{label}</p>
      <p className="mt-2 text-lg font-semibold text-[var(--gold-l)]">{value}</p>
      {note ? <p className="mt-1 text-xs text-[var(--dim)]">{note}</p> : null}
    </div>
  );
}

function SpecialistSectionPitched({
  value,
  onChange
}: {
  value: PitchedRoofDetails;
  onChange: (value: PitchedRoofDetails) => void;
}) {
  const [open, setOpen] = useState(new Set(["config", "covering", "measurements", "assessment"]));
  const metrics = useMemo(() => calculatePitchedMetrics(value), [value]);

  function patch(updates: Partial<PitchedRoofDetails>) {
    onChange({ ...value, ...updates });
  }

  function isOpen(key: string) {
    return open.has(key);
  }

  function toggle(key: string) {
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <div className="stack">
      <SurveySection isOpen={isOpen("config")} onToggle={() => toggle("config")} subtitle="Roof shape and configuration affect area estimates, scaffold, and scope." title="Roof Configuration">
        <div className="grid gap-4">
          <ChipSelect
            label="Roof Style"
            onChange={(next) => patch({ roof_style: String(next) })}
            options={["Standard Up & Over", "Hipped", "Half-Hipped", "Mansard", "Gambrel", "Dormer", "L-Shape", "T-Shape", "Cross-Hipped", "Mono-Pitch", "Valley Roof", "Lean-To"]}
            value={value.roof_style ?? ""}
          />
          <TextField label="Configuration Notes" multiline onChange={(next) => patch({ roof_style_notes: next })} placeholder="Rear dormer, lower extension roofs, split levels..." value={value.roof_style_notes ?? ""} />
        </div>
      </SurveySection>

      <SurveySection isOpen={isOpen("covering")} onToggle={() => toggle("covering")} subtitle="Covering type, age, and common defects feed directly into quote wording." title="Roof Covering">
        <div className="grid gap-4 md:grid-cols-2">
          <ChipSelect
            label="Covering Type"
            onChange={(next) => patch({ tile_type: String(next) })}
            options={["Concrete Interlocking", "Plain Clay", "Marley Modern", "Redland 49", "Redland 51", "Natural Slate", "Artificial Slate", "Rosemary", "Cedar Shingle", "Stone Slate", "Double Cambered Clay", "Unknown"]}
            value={value.tile_type ?? ""}
          />
          <TextField label="Approximate Age" onChange={(next) => patch({ tile_age: next })} placeholder="e.g. original to house, 25+ years" value={value.tile_age ?? ""} />
          <div className="md:col-span-2">
            <ConditionButtons label="Covering Condition" onChange={(next) => patch({ tile_condition: next })} value={value.tile_condition ?? ""} />
          </div>
          <div className="md:col-span-2">
            <ChipSelect
              hint="Use for repeated issues across the roof."
              label="Issues Found"
              multi
              onChange={(next) => patch({ tile_issues: next as string[] })}
              options={["Cracked", "Slipped", "Missing", "Nail Fatigue", "Frost Damage", "Porous", "Delaminating", "Patch Repairs", "Colour Fading"]}
              value={value.tile_issues ?? []}
            />
          </div>
        </div>
      </SurveySection>

      <SurveySection isOpen={isOpen("measurements")} onToggle={() => toggle("measurements")} subtitle="Enter the simple runs you measure on site. The app calculates the working summary and you can override it." title="Measurements">
        <div className="grid gap-4 md:grid-cols-2">
          <NumberField label="Pitch Angle" onChange={(next) => patch({ pitch_angle_deg: toNumber(next) })} unit="°" value={numberInput(value.pitch_angle_deg)} />
          <NumberField label="Single Ridge Length" onChange={(next) => patch({ ridge_length_m: toNumber(next) })} unit="m" value={numberInput(value.ridge_length_m)} />
          <NumberField label="Number of Ridges" onChange={(next) => patch({ number_of_ridges: toNumber(next) })} value={numberInput(value.number_of_ridges)} />
          <NumberField label="Eaves Length" onChange={(next) => patch({ eaves_length_m: toNumber(next) })} unit="m" value={numberInput(value.eaves_length_m)} />
          <NumberField label="Verge Length" onChange={(next) => patch({ verge_length_m: toNumber(next) })} unit="m" value={numberInput(value.verge_length_m)} />
          <NumberField label="Rafter Length" onChange={(next) => patch({ rafter_length_m: toNumber(next) })} unit="m" value={numberInput(value.rafter_length_m)} />
          <NumberField label="Hip Count" onChange={(next) => patch({ hip_count: toNumber(next) })} value={numberInput(value.hip_count)} />
          <NumberField label="Total Hip Metres" onChange={(next) => patch({ total_hip_metres: toNumber(next) })} unit="m" value={numberInput(value.total_hip_metres)} />
          <NumberField label="Valley Count" onChange={(next) => patch({ valley_count: toNumber(next) })} value={numberInput(value.valley_count)} />
          <NumberField label="Total Valley Metres" onChange={(next) => patch({ total_valley_metres: toNumber(next) })} unit="m" value={numberInput(value.total_valley_metres)} />
          <div className="md:col-span-2">
            <NumberField
              hint="Leave blank to use the calculated estimate."
              label="Manual Roof Area Override"
              onChange={(next) => patch({ roof_area_override_m2: toNumber(next) })}
              unit="m2"
              value={numberInput(value.roof_area_override_m2)}
            />
          </div>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <MetricCard label="Roof Area Estimate" note="Calculated from rafter, eaves, roof shape, and pitch." value={metrics.roofAreaEstimate ? `${metrics.roofAreaEstimate}m2` : "Waiting for measurements"} />
          <MetricCard label="Total Ridge Metres" value={metrics.totalRidgeMetres ? `${metrics.totalRidgeMetres}m` : "Not set"} />
          <MetricCard label="Total Hip Metres" value={metrics.totalHipMetres ? `${metrics.totalHipMetres}m` : "Not set"} />
          <MetricCard label="Total Valley Metres" value={metrics.totalValleyMetres ? `${metrics.totalValleyMetres}m` : "Not set"} />
          <MetricCard label="Total Eaves Metres" value={metrics.totalEavesMetres ? `${metrics.totalEavesMetres}m` : "Not set"} />
          <MetricCard label="Total Verge Metres" value={metrics.totalVergeMetres ? `${metrics.totalVergeMetres}m` : "Not set"} />
        </div>
      </SurveySection>

      <SurveySection isOpen={isOpen("ridge")} onToggle={() => toggle("ridge")} title="Ridge">
        <div className="grid gap-4 md:grid-cols-2">
          <ChipSelect label="Ridge Type" onChange={(next) => patch({ ridge_type: String(next) })} options={["Mortar Bedded", "Dry Ridge System", "Half Round", "Angular", "Hog Back", "Unknown"]} value={value.ridge_type ?? ""} />
          <ConditionButtons hint="Check for rocking, open joints, and slipped ridge tiles." label="Ridge Condition" onChange={(next) => patch({ ridge_condition: next })} value={value.ridge_condition ?? ""} />
        </div>
      </SurveySection>

      <SurveySection isOpen={isOpen("hips")} onToggle={() => toggle("hips")} title="Hips">
        <div className="grid gap-4 md:grid-cols-2">
          <ChipSelect label="Hip Type" onChange={(next) => patch({ hip_type: String(next) })} options={["Mortar Bedded", "Dry Hip System", "Bonnet Hip", "Unknown"]} value={value.hip_type ?? ""} />
          <ConditionButtons label="Hip Condition" onChange={(next) => patch({ hip_condition: next })} value={value.hip_condition ?? ""} />
        </div>
      </SurveySection>

      <SurveySection isOpen={isOpen("valleys")} onToggle={() => toggle("valleys")} title="Valleys">
        <div className="grid gap-4 md:grid-cols-2">
          <ChipSelect label="Valley Type" onChange={(next) => patch({ valley_type: String(next) })} options={["Lead Lined", "GRP Trough", "Mortar", "Tile Valley", "Dry Valley", "Aluminium", "Unknown"]} value={value.valley_type ?? ""} />
          <ConditionButtons hint="Check for splits, mortar loss, debris, and overflow marks." label="Valley Condition" onChange={(next) => patch({ valley_condition: next })} value={value.valley_condition ?? ""} />
        </div>
      </SurveySection>

      <SurveySection isOpen={isOpen("eaves")} onToggle={() => toggle("eaves")} title="Verges, Eaves, Felt & Battens">
        <div className="grid gap-4 md:grid-cols-2">
          <ChipSelect label="Verge Type" onChange={(next) => patch({ verge_type: String(next) })} options={["Mortar", "Dry Verge", "Barge Board", "Flush", "Unknown"]} value={value.verge_type ?? ""} />
          <ConditionButtons label="Verge Condition" onChange={(next) => patch({ verge_condition: next })} value={value.verge_condition ?? ""} />
          <ChipSelect label="Eaves Ventilation" onChange={(next) => patch({ eaves_ventilation: String(next) })} options={["Over-Fascia Vent", "Soffit Vents", "Tile Vents", "Ridge Vent", "None", "Unknown"]} value={value.eaves_ventilation ?? ""} />
          <ChipSelect label="Membrane Type" onChange={(next) => patch({ membrane_type: String(next) })} options={["1F Felt", "Breathable Membrane", "Roofshield", "Tyvek", "None Visible", "Unknown"]} value={value.membrane_type ?? ""} />
          <ConditionButtons label="Felt Condition" onChange={(next) => patch({ felt_condition: next })} value={value.felt_condition ?? ""} />
          <ConditionButtons label="Batten Condition" onChange={(next) => patch({ batten_condition: next })} value={value.batten_condition ?? ""} />
          <div className="md:col-span-2">
            <ToggleField checked={Boolean(value.bird_guard_present)} hint="Bird comb or eaves guard present." label="Bird Guard Present" onChange={(next) => patch({ bird_guard_present: next })} />
          </div>
          <div className="md:col-span-2">
            <TextField label="Batten Notes" multiline onChange={(next) => patch({ batten_notes: next })} placeholder="Visible splits, rot, replacement needs, spacing issues..." value={value.batten_notes ?? ""} />
          </div>
        </div>
      </SurveySection>

      <SurveySection isOpen={isOpen("chimney")} onToggle={() => toggle("chimney")} title="Chimney & Roof Furniture">
        <div className="grid gap-4 md:grid-cols-2">
          <ToggleField checked={Boolean(value.chimney_present)} label="Chimney Present" onChange={(next) => patch({ chimney_present: next })} />
          <ConditionButtons label="Chimney Condition" onChange={(next) => patch({ chimney_condition: next })} value={value.chimney_condition ?? ""} />
          <ConditionButtons label="Lead Flashings" onChange={(next) => patch({ chimney_flashings_condition: next })} value={value.chimney_flashings_condition ?? ""} />
          <ConditionButtons label="Flaunching" onChange={(next) => patch({ chimney_flaunching_condition: next })} value={value.chimney_flaunching_condition ?? ""} />
          <TextField label="Pots / Terminals" onChange={(next) => patch({ chimney_pots: next })} placeholder="Number, condition, caps, cowls..." value={value.chimney_pots ?? ""} />
          <div className="grid gap-3 md:col-span-2 md:grid-cols-2">
            <ToggleField checked={Boolean(value.chimney_cowls)} label="Cowls Fitted" onChange={(next) => patch({ chimney_cowls: next })} />
            <ToggleField checked={Boolean(value.chimney_repointing_needed)} label="Repointing Needed" onChange={(next) => patch({ chimney_repointing_needed: next })} />
          </div>
          <div className="md:col-span-2 grid gap-3 md:grid-cols-3">
            <ToggleField checked={Boolean(value.solar_panels)} label="Solar Panels" onChange={(next) => patch({ solar_panels: next })} />
            <ToggleField checked={Boolean(value.roof_windows)} label="Roof Windows / Velux" onChange={(next) => patch({ roof_windows: next })} />
            <ToggleField checked={Boolean(value.vents_present)} label="Roof Vents Present" onChange={(next) => patch({ vents_present: next })} />
            <ToggleField checked={Boolean(value.aerial_present)} label="Aerial Present" onChange={(next) => patch({ aerial_present: next })} />
            <ToggleField checked={Boolean(value.satellite_present)} label="Satellite Dish Present" onChange={(next) => patch({ satellite_present: next })} />
          </div>
          {value.solar_panels ? <NumberField label="Solar Panel Count" onChange={(next) => patch({ solar_panel_count: toNumber(next) })} value={numberInput(value.solar_panel_count)} /> : null}
          {value.roof_windows ? <NumberField label="Roof Window Count" onChange={(next) => patch({ roof_window_count: toNumber(next) })} value={numberInput(value.roof_window_count)} /> : null}
        </div>
      </SurveySection>

      <SurveySection isOpen={isOpen("loft")} onToggle={() => toggle("loft")} title="Loft, Moss & Access">
        <div className="grid gap-4 md:grid-cols-2">
          <ChipSelect label="Moss & Algae Coverage" onChange={(next) => patch({ moss_level: String(next) })} options={["None", "Light", "Moderate", "Heavy", "Severe"]} value={value.moss_level ?? ""} />
          <ToggleField checked={Boolean(value.moss_treatment_recommended)} label="Moss Treatment Recommended" onChange={(next) => patch({ moss_treatment_recommended: next })} />
          <ToggleField checked={Boolean(value.loft_inspected)} label="Loft Inspected" onChange={(next) => patch({ loft_inspected: next })} />
          <ChipSelect label="Scaffold Requirement" onChange={(next) => patch({ scaffold_type: String(next) })} options={["None", "Tower", "1 Elevation", "2 Elevations", "Full House", "Chimney Access"]} value={value.scaffold_type ?? ""} />
          <TextField label="Scaffold Elevations / Notes" multiline onChange={(next) => patch({ scaffold_elevations: next })} placeholder="Front only, rear plus chimney, full wrap..." value={value.scaffold_elevations ?? ""} />
          <TextField label="Access Notes" multiline onChange={(next) => patch({ access_notes: next })} placeholder="Neighbours, conservatory, parking, overhead cables..." value={value.access_notes ?? ""} />
        </div>
        {value.loft_inspected ? (
          <div className="mt-4 stack">
            <div className="grid gap-3 md:grid-cols-3">
              <ToggleField checked={Boolean(value.loft_daylight_visible)} label="Daylight Visible" onChange={(next) => patch({ loft_daylight_visible: next })} />
              <ToggleField checked={Boolean(value.loft_damp_patches)} label="Damp Patches" onChange={(next) => patch({ loft_damp_patches: next })} />
              <ToggleField checked={Boolean(value.loft_condensation)} label="Condensation" onChange={(next) => patch({ loft_condensation: next })} />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <ChipSelect label="Insulation Type" onChange={(next) => patch({ loft_insulation_type: String(next) })} options={["Glass Wool", "Mineral Wool", "Spray Foam", "PIR Boards", "Sheep Wool", "None", "Unknown"]} value={value.loft_insulation_type ?? ""} />
              <NumberField label="Insulation Depth" onChange={(next) => patch({ loft_insulation_depth_mm: toNumber(next) })} unit="mm" value={numberInput(value.loft_insulation_depth_mm)} />
              <div className="md:col-span-2">
                <TextField label="Loft Notes" multiline onChange={(next) => patch({ loft_notes: next })} placeholder="Visible daylight at ridge, staining near valley, condensation on felt..." value={value.loft_notes ?? ""} />
              </div>
            </div>
          </div>
        ) : null}
      </SurveySection>
    </div>
  );
}

function SpecialistSectionFlat({ value, onChange }: { value: FlatRoofDetails; onChange: (value: FlatRoofDetails) => void }) {
  const metrics = useMemo(() => calculateFlatMetrics(value), [value]);
  function patch(updates: Partial<FlatRoofDetails>) {
    onChange({ ...value, ...updates });
  }
  return (
    <div className="stack">
      <SurveySection isOpen onToggle={() => undefined} subtitle="Record surface, age, size, drainage, and the system you would recommend." title="Flat Roof Details">
        <div className="grid gap-4 md:grid-cols-2">
          <ChipSelect label="Current Surface Type" onChange={(next) => patch({ current_surface_type: String(next) })} options={["Felt", "EPDM", "GRP", "Lead", "Asphalt", "Liquid Applied", "Single Ply", "Unknown"]} value={value.current_surface_type ?? ""} />
          <TextField label="Approximate Age" onChange={(next) => patch({ approximate_age: next })} placeholder="e.g. 12 years" value={value.approximate_age ?? ""} />
          <NumberField label="Length" onChange={(next) => patch({ length_m: toNumber(next) })} unit="m" value={numberInput(value.length_m)} />
          <NumberField label="Width" onChange={(next) => patch({ width_m: toNumber(next) })} unit="m" value={numberInput(value.width_m)} />
          <NumberField label="Perimeter" onChange={(next) => patch({ perimeter_m: toNumber(next) })} unit="m" value={numberInput(value.perimeter_m)} />
          <NumberField label="Area Override" onChange={(next) => patch({ roof_area_override_m2: toNumber(next) })} unit="m2" value={numberInput(value.roof_area_override_m2)} />
          <ConditionButtons label="Deck Condition" onChange={(next) => patch({ deck_condition: next })} value={value.deck_condition ?? ""} />
          <ConditionButtons label="Drainage Condition" onChange={(next) => patch({ drainage_condition: next })} value={value.drainage_condition ?? ""} />
          <ConditionButtons label="Upstands Condition" onChange={(next) => patch({ upstands_condition: next })} value={value.upstands_condition ?? ""} />
          <ConditionButtons label="Flashings Condition" onChange={(next) => patch({ flashings_condition: next })} value={value.flashings_condition ?? ""} />
          <ToggleField checked={Boolean(value.standing_water)} label="Standing Water / Ponding" onChange={(next) => patch({ standing_water: next })} />
          <NumberField label="Outlets Count" onChange={(next) => patch({ outlets_count: toNumber(next) })} value={numberInput(value.outlets_count)} />
          <TextField label="Rooflights / Openings" onChange={(next) => patch({ rooflights: next })} placeholder="Lantern, dome, opening vent..." value={value.rooflights ?? ""} />
          <ChipSelect label="Recommended System" onChange={(next) => patch({ recommended_system: String(next) })} options={["Danosa Option 3", "GRP", "EPDM", "Liquid Applied", "Lead", "Single Ply", "Other"]} value={value.recommended_system ?? ""} />
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <MetricCard label="Roof Area Estimate" value={metrics.roofAreaEstimate ? `${metrics.roofAreaEstimate}m2` : "Waiting for size"} />
          <MetricCard label="Perimeter" value={metrics.perimeterMetres ? `${metrics.perimeterMetres}m` : "Waiting for size"} />
        </div>
      </SurveySection>
    </div>
  );
}

function SpecialistSectionFascia({ value, onChange }: { value: FasciaDetails; onChange: (value: FasciaDetails) => void }) {
  const metrics = useMemo(() => calculateFasciaMetrics(value), [value]);
  function patch(updates: Partial<FasciaDetails>) {
    onChange({ ...value, ...updates });
  }
  return (
    <div className="stack">
      <SurveySection isOpen onToggle={() => undefined} subtitle="Capture current trim, condition, gutter profile, and total measured run." title="Fascias / Soffits / Gutters">
        <div className="grid gap-4 md:grid-cols-2">
          <ChipSelect label="Current Material" onChange={(next) => patch({ current_material: String(next) })} options={["uPVC White", "uPVC Black", "uPVC Anthracite", "Timber", "Composite", "Aluminium", "Unknown"]} value={value.current_material ?? ""} />
          <TextField label="Colour Preference" onChange={(next) => patch({ colour_preference: next })} placeholder="White, black, anthracite..." value={value.colour_preference ?? ""} />
          <ConditionButtons label="Fascia Condition" onChange={(next) => patch({ fascia_condition: next })} value={value.fascia_condition ?? ""} />
          <ConditionButtons label="Soffit Condition" onChange={(next) => patch({ soffit_condition: next })} value={value.soffit_condition ?? ""} />
          <ConditionButtons label="Guttering Condition" onChange={(next) => patch({ guttering_condition: next })} value={value.guttering_condition ?? ""} />
          <ConditionButtons label="Downpipe Condition" onChange={(next) => patch({ downpipe_condition: next })} value={value.downpipe_condition ?? ""} />
          <ChipSelect label="Gutter Profile" onChange={(next) => patch({ gutter_profile: String(next) })} options={["Half Round", "Square", "Ogee", "Cast Iron", "Unknown"]} value={value.gutter_profile ?? ""} />
          <TextField label="Cladding / Extras" onChange={(next) => patch({ cladding_details: next })} placeholder="Barge boards, cladding, trims..." value={value.cladding_details ?? ""} />
          <NumberField label="Front Run" onChange={(next) => patch({ front_run_m: toNumber(next) })} unit="m" value={numberInput(value.front_run_m)} />
          <NumberField label="Rear Run" onChange={(next) => patch({ rear_run_m: toNumber(next) })} unit="m" value={numberInput(value.rear_run_m)} />
          <NumberField label="Left Run" onChange={(next) => patch({ left_run_m: toNumber(next) })} unit="m" value={numberInput(value.left_run_m)} />
          <NumberField label="Right Run" onChange={(next) => patch({ right_run_m: toNumber(next) })} unit="m" value={numberInput(value.right_run_m)} />
          <div className="md:col-span-2">
            <NumberField label="Manual Total Linear Metres Override" onChange={(next) => patch({ total_linear_metres_override: toNumber(next) })} unit="m" value={numberInput(value.total_linear_metres_override)} />
          </div>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-1">
          <MetricCard label="Total Linear Metres" value={metrics.totalLinearMetres ? `${metrics.totalLinearMetres}m` : "Waiting for measured runs"} />
        </div>
      </SurveySection>
    </div>
  );
}

function SpecialistSectionChimney({ value, onChange }: { value: ChimneyDetails; onChange: (value: ChimneyDetails) => void }) {
  const metrics = useMemo(() => calculateChimneyMetrics(value), [value]);
  function patch(updates: Partial<ChimneyDetails>) {
    onChange({ ...value, ...updates });
  }
  return (
    <div className="stack">
      <SurveySection isOpen onToggle={() => undefined} subtitle="Capture stack condition, flashings, lead runs, and specialist access needs." title="Chimney / Lead">
        <div className="grid gap-4 md:grid-cols-2">
          <NumberField label="Chimney Count" onChange={(next) => patch({ chimney_count: toNumber(next) })} value={numberInput(value.chimney_count)} />
          <ChipSelect label="Lead Code" onChange={(next) => patch({ lead_code: String(next) })} options={["Code 3", "Code 4", "Code 5", "Code 6", "Unknown"]} value={value.lead_code ?? ""} />
          <ConditionButtons label="Chimney Condition" onChange={(next) => patch({ chimney_condition: next })} value={value.chimney_condition ?? ""} />
          <ConditionButtons label="Lead Flashings" onChange={(next) => patch({ lead_flashings_condition: next })} value={value.lead_flashings_condition ?? ""} />
          <ConditionButtons label="Flaunching" onChange={(next) => patch({ flaunching_condition: next })} value={value.flaunching_condition ?? ""} />
          <TextField label="Pots / Terminals" onChange={(next) => patch({ chimney_pots: next })} placeholder="Pots, caps, disused flues..." value={value.chimney_pots ?? ""} />
          <div className="grid gap-3 md:col-span-2 md:grid-cols-3">
            <ToggleField checked={Boolean(value.chimney_cowls)} label="Cowls Fitted" onChange={(next) => patch({ chimney_cowls: next })} />
            <ToggleField checked={Boolean(value.repointing_needed)} label="Repointing Needed" onChange={(next) => patch({ repointing_needed: next })} />
            <ToggleField checked={Boolean(value.parapet_or_coping)} label="Parapet / Coping Detail" onChange={(next) => patch({ parapet_or_coping: next })} />
          </div>
          <NumberField label="Apron Length" onChange={(next) => patch({ apron_length_m: toNumber(next) })} unit="m" value={numberInput(value.apron_length_m)} />
          <NumberField label="Back Gutter Length" onChange={(next) => patch({ back_gutter_length_m: toNumber(next) })} unit="m" value={numberInput(value.back_gutter_length_m)} />
          <NumberField label="Step Flashing Length" onChange={(next) => patch({ step_flashing_length_m: toNumber(next) })} unit="m" value={numberInput(value.step_flashing_length_m)} />
          <NumberField label="Manual Measured Run Override" onChange={(next) => patch({ total_measured_run_override_m: toNumber(next) })} unit="m" value={numberInput(value.total_measured_run_override_m)} />
          <div className="md:col-span-2">
            <TextField label="Height / Access Notes" multiline onChange={(next) => patch({ height_or_access_notes: next })} placeholder="Height, scaffold, neighbour access, fragile roof..." value={value.height_or_access_notes ?? ""} />
          </div>
          <div className="md:col-span-2">
            <TextField label="Additional Notes" multiline onChange={(next) => patch({ additional_notes: next })} placeholder="Lead soakers, trays, repairs, defects..." value={value.additional_notes ?? ""} />
          </div>
        </div>
        <div className="mt-5">
          <MetricCard label="Total Measured Lead Run" value={metrics.totalMeasuredRun ? `${metrics.totalMeasuredRun}m` : "Waiting for measured runs"} />
        </div>
      </SurveySection>
    </div>
  );
}

function SpecialistSectionOther({ value, onChange }: { value: OtherSurveyDetails; onChange: (value: OtherSurveyDetails) => void }) {
  function patch(updates: Partial<OtherSurveyDetails>) {
    onChange({ ...value, ...updates });
  }
  return (
    <div className="stack">
      <SurveySection isOpen onToggle={() => undefined} subtitle="Use for one-off inspections, mixed issues, and roofing work that does not fit the specialist templates." title="Other / Misc Survey">
        <div className="grid gap-4 md:grid-cols-2">
          <TextField label="Survey Focus" onChange={(next) => patch({ survey_focus: next })} placeholder="Leak investigation, insurance inspection, mixed defects..." value={value.survey_focus ?? ""} />
          <ChipSelect label="Recommended System" onChange={(next) => patch({ recommended_system: String(next) })} options={["Repair Only", "Replace Section", "Full Replacement", "Inspection Only", "Other"]} value={value.recommended_system ?? ""} />
          <NumberField label="Measured Area" onChange={(next) => patch({ measured_area_m2: toNumber(next) })} unit="m2" value={numberInput(value.measured_area_m2)} />
          <NumberField label="Measured Run" onChange={(next) => patch({ measured_run_m: toNumber(next) })} unit="m" value={numberInput(value.measured_run_m)} />
          <div className="md:col-span-2">
            <ChipSelect label="Issue Tags" multi onChange={(next) => patch({ issue_tags: next as string[] })} options={["Leak", "Storm Damage", "Maintenance", "Access Issue", "Condensation", "Leadwork", "Timber Rot", "Masonry"]} value={value.issue_tags ?? []} />
          </div>
          <div className="md:col-span-2">
            <TextField label="Additional Findings" multiline onChange={(next) => patch({ additional_findings: next })} placeholder="Anything unusual or mixed that the quote should explain clearly." value={value.additional_findings ?? ""} />
          </div>
        </div>
      </SurveySection>
    </div>
  );
}

function defaultAdaptiveSections(initialSurvey?: SurveyRecord | null): SurveyAdaptiveSections {
  return {
    flat_roof: initialSurvey?.adaptive_sections?.flat_roof ?? {},
    pitched_roof: initialSurvey?.adaptive_sections?.pitched_roof ?? {},
    fascias: initialSurvey?.adaptive_sections?.fascias ?? {},
    chimney: initialSurvey?.adaptive_sections?.chimney ?? {},
    other: initialSurvey?.adaptive_sections?.other ?? {}
  };
}

function SpecialistSurveyBody({
  selectedSurveyType,
  adaptiveSections,
  onChange
}: {
  selectedSurveyType: SurveyType;
  adaptiveSections: SurveyAdaptiveSections;
  onChange: (next: SurveyAdaptiveSections) => void;
}) {
  if (selectedSurveyType === "Pitched / Tiled") {
    return <SpecialistSectionPitched onChange={(next) => onChange({ ...adaptiveSections, pitched_roof: next })} value={adaptiveSections.pitched_roof ?? {}} />;
  }
  if (selectedSurveyType === "Flat Roof") {
    return <SpecialistSectionFlat onChange={(next) => onChange({ ...adaptiveSections, flat_roof: next })} value={adaptiveSections.flat_roof ?? {}} />;
  }
  if (selectedSurveyType === "Fascias / Soffits / Gutters") {
    return <SpecialistSectionFascia onChange={(next) => onChange({ ...adaptiveSections, fascias: next })} value={adaptiveSections.fascias ?? {}} />;
  }
  if (selectedSurveyType === "Chimney / Lead") {
    return <SpecialistSectionChimney onChange={(next) => onChange({ ...adaptiveSections, chimney: next })} value={adaptiveSections.chimney ?? {}} />;
  }
  return <SpecialistSectionOther onChange={(next) => onChange({ ...adaptiveSections, other: next })} value={adaptiveSections.other ?? {}} />;
}

export function SurveyForm({ jobId, roofType, surveyType, initialSurvey }: Props) {
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [selectedSurveyType, setSelectedSurveyType] = useState<SurveyType>((initialSurvey?.survey_type as SurveyType) ?? surveyType);
  const [selectedRoofType, setSelectedRoofType] = useState<RoofType>((initialSurvey?.roof_type as RoofType) ?? roofType);
  const [scaffoldRequired, setScaffoldRequired] = useState(initialSurvey?.scaffold_required ?? false);
  const [noPhotoConfirmation, setNoPhotoConfirmation] = useState(initialSurvey?.no_photo_confirmation ?? false);
  const [formState, setFormState] = useState({
    surveyor_name: initialSurvey?.surveyor_name ?? "Andrew Bailey",
    roof_condition: initialSurvey?.roof_condition ?? "",
    problem_observed: initialSurvey?.problem_observed ?? "",
    suspected_cause: initialSurvey?.suspected_cause ?? "",
    recommended_works: initialSurvey?.recommended_works ?? "",
    measurements: initialSurvey?.measurements ?? "",
    access_notes: initialSurvey?.access_notes ?? "",
    customer_concerns: initialSurvey?.customer_concerns ?? "",
    weather_notes: initialSurvey?.weather_notes ?? "",
    safety_notes: initialSurvey?.safety_notes ?? "",
    voice_note_transcript: initialSurvey?.voice_note_transcript ?? "",
    raw_notes: initialSurvey?.raw_notes ?? "",
    scaffold_notes: initialSurvey?.scaffold_notes ?? ""
  });
  const [adaptiveSections, setAdaptiveSections] = useState<SurveyAdaptiveSections>(defaultAdaptiveSections(initialSurvey));

  const measurementsSummary = useMemo(() => {
    if (selectedSurveyType === "Pitched / Tiled") {
      const metrics = calculatePitchedMetrics(adaptiveSections.pitched_roof);
      return [
        metrics.roofAreaEstimate ? `${metrics.roofAreaEstimate}m2 roof area` : null,
        metrics.totalRidgeMetres ? `${metrics.totalRidgeMetres}m ridge` : null,
        metrics.totalHipMetres ? `${metrics.totalHipMetres}m hips` : null,
        metrics.totalValleyMetres ? `${metrics.totalValleyMetres}m valleys` : null
      ].filter(Boolean).join(" | ");
    }
    if (selectedSurveyType === "Flat Roof") {
      const metrics = calculateFlatMetrics(adaptiveSections.flat_roof);
      return [metrics.roofAreaEstimate ? `${metrics.roofAreaEstimate}m2 area` : null, metrics.perimeterMetres ? `${metrics.perimeterMetres}m perimeter` : null]
        .filter(Boolean)
        .join(" | ");
    }
    if (selectedSurveyType === "Fascias / Soffits / Gutters") {
      const metrics = calculateFasciaMetrics(adaptiveSections.fascias);
      return metrics.totalLinearMetres ? `${metrics.totalLinearMetres}m total run` : "";
    }
    if (selectedSurveyType === "Chimney / Lead") {
      const metrics = calculateChimneyMetrics(adaptiveSections.chimney);
      return metrics.totalMeasuredRun ? `${metrics.totalMeasuredRun}m measured lead run` : "";
    }

    const other = adaptiveSections.other;
    return [other?.measured_area_m2 ? `${other.measured_area_m2}m2 area` : null, other?.measured_run_m ? `${other.measured_run_m}m measured run` : null]
      .filter(Boolean)
      .join(" | ");
  }, [adaptiveSections, selectedSurveyType]);

  const surveyMeta = SURVEY_META.find((item) => item.type === selectedSurveyType);

  return (
    <form
      className="stack"
      onSubmit={async (event) => {
        event.preventDefault();
        setError(null);
        setSaved(false);

        const payload = {
          surveyor_name: formState.surveyor_name.trim(),
          access_notes: formState.access_notes.trim(),
          scaffold_required: scaffoldRequired,
          scaffold_notes: formState.scaffold_notes.trim(),
          roof_condition: formState.roof_condition,
          problem_observed: formState.problem_observed.trim(),
          suspected_cause: formState.suspected_cause.trim(),
          recommended_works: formState.recommended_works.trim(),
          measurements: measurementsSummary || formState.measurements.trim(),
          weather_notes: formState.weather_notes.trim(),
          safety_notes: formState.safety_notes.trim(),
          customer_concerns: formState.customer_concerns.trim(),
          voice_note_transcript: formState.voice_note_transcript.trim(),
          raw_notes: formState.raw_notes.trim(),
          survey_type: selectedSurveyType,
          roof_type: selectedRoofType,
          no_photo_confirmation: noPhotoConfirmation,
          adaptive_sections: adaptiveSections
        };

        const response = await fetch(`/api/jobs/${jobId}/survey`, {
          method: initialSurvey ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        const result = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
        if (!response.ok || !result?.ok) {
          setError(result?.error || "Survey could not be saved. Please check the required site details.");
          return;
        }

        setSaved(true);
        startTransition(() => {
          router.refresh();
        });
      }}
    >
      <div className="card p-5">
        <p className="section-kicker text-[0.65rem] uppercase">Survey Type</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {SURVEY_META.map((item) => (
            <button
              className={`rounded-2xl border p-4 text-left transition ${
                selectedSurveyType === item.type
                  ? "border-[var(--gold)] bg-[rgba(212,175,55,0.14)]"
                  : "border-[var(--border)] bg-[var(--card)]"
              }`}
              key={item.type}
              onClick={() => {
                setSelectedSurveyType(item.type);
                setSelectedRoofType(item.roofType);
              }}
              type="button"
            >
              <p className="section-kicker text-[0.58rem] uppercase">{item.icon}</p>
              <p className="mt-2 text-sm font-semibold text-[var(--text)]">{item.type}</p>
              <p className="mt-1 text-xs text-[var(--muted)]">{item.description}</p>
            </button>
          ))}
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <FieldLabel htmlFor="roof-type">Roof Type</FieldLabel>
            <select className="field" id="roof-type" onChange={(event) => setSelectedRoofType(event.target.value as RoofType)} value={selectedRoofType}>
              {ROOF_TYPES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
            <p className="label">Measurement Summary</p>
            <p className="mt-2 text-sm text-[var(--text)]">{measurementsSummary || "The app will build a measured summary as you fill out the specialist section."}</p>
          </div>
        </div>
      </div>

      <div className="card p-5">
        <p className="section-kicker text-[0.65rem] uppercase">Core Survey</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <TextField label="Surveyor" onChange={(next) => setFormState((current) => ({ ...current, surveyor_name: next }))} value={formState.surveyor_name} />
          <ConditionButtons label="Overall Condition" onChange={(next) => setFormState((current) => ({ ...current, roof_condition: next }))} value={formState.roof_condition} />
          <TextField hint="Main issue the customer called about." label="Problem Observed" multiline onChange={(next) => setFormState((current) => ({ ...current, problem_observed: next }))} placeholder="What did you find on site?" value={formState.problem_observed} />
          <TextField label="Suspected Cause" multiline onChange={(next) => setFormState((current) => ({ ...current, suspected_cause: next }))} placeholder="What looks to be causing the issue?" value={formState.suspected_cause} />
          <TextField hint="This feeds directly into the quote engine." label="Recommended Works" multiline onChange={(next) => setFormState((current) => ({ ...current, recommended_works: next }))} placeholder="What works do you recommend?" value={formState.recommended_works} />
          <TextField hint="Used only if you need to add your own manual summary." label="Manual Measurement Notes" multiline onChange={(next) => setFormState((current) => ({ ...current, measurements: next }))} placeholder="Any extra measurements or note corrections..." value={formState.measurements} />
          <TextField label="Access Notes" multiline onChange={(next) => setFormState((current) => ({ ...current, access_notes: next }))} placeholder="Parking, neighbours, conservatories, ladders..." value={formState.access_notes} />
          <TextField hint="Use the customer's own wording where possible." label="Customer Concerns" multiline onChange={(next) => setFormState((current) => ({ ...current, customer_concerns: next }))} placeholder="Anything the customer wants priced or explained?" value={formState.customer_concerns} />
          <TextField label="Weather Notes" multiline onChange={(next) => setFormState((current) => ({ ...current, weather_notes: next }))} placeholder="Conditions during survey." value={formState.weather_notes} />
          <TextField label="Safety Notes" multiline onChange={(next) => setFormState((current) => ({ ...current, safety_notes: next }))} placeholder="Any hazards or controls needed." value={formState.safety_notes} />
          <TextField label="Voice Note Transcript" multiline onChange={(next) => setFormState((current) => ({ ...current, voice_note_transcript: next }))} placeholder="Optional dictated notes from site." value={formState.voice_note_transcript} />
          <TextField label="Other Notes" multiline onChange={(next) => setFormState((current) => ({ ...current, raw_notes: next }))} placeholder="Anything else that should stay on the job file." value={formState.raw_notes} />
          <TextField label="Scaffold Notes" multiline onChange={(next) => setFormState((current) => ({ ...current, scaffold_notes: next }))} placeholder="Front, rear, tower access, edge protection..." value={formState.scaffold_notes} />
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <ToggleField checked={scaffoldRequired} hint="Will scaffolding be needed?" label="Scaffold Required" onChange={setScaffoldRequired} />
          <ToggleField checked={noPhotoConfirmation} hint="Use this only when the survey is complete but photos are not available." label="Ready For Quote Without Photos" onChange={setNoPhotoConfirmation} />
        </div>
      </div>

      <div className="card p-5">
        <p className="section-kicker text-[0.65rem] uppercase">Specialist Survey</p>
        <p className="mt-3 text-sm text-[var(--muted)]">{surveyMeta?.description}</p>
      </div>

      <SpecialistSurveyBody adaptiveSections={adaptiveSections} onChange={setAdaptiveSections} selectedSurveyType={selectedSurveyType} />

      <div className="card sticky bottom-4 z-10 p-5">
        <div className="flex flex-wrap items-center gap-3">
          <button className="button-primary" disabled={isPending} type="submit">
            {isPending ? "Saving Survey..." : initialSurvey ? "Update Survey" : "Save Survey"}
          </button>
          {saved ? <p className="text-sm text-[#7ce3a6]">Survey saved to the job record.</p> : null}
          {error ? <p className="text-sm text-[#ff9a91]">{error}</p> : null}
        </div>
      </div>
    </form>
  );
}
