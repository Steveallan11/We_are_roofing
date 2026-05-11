"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SURVEY_TYPES } from "@/lib/constants";
import type { RoofType, SurveyRecord, SurveyType } from "@/lib/types";

type Props = {
  jobId: string;
  roofType: RoofType;
  surveyType: SurveyType;
  initialSurvey?: SurveyRecord | null;
};

type SectionKey = "core" | "flat" | "pitched" | "fascia" | "chimney";
const CONDITIONS = ["Good", "Fair", "Poor", "Failed", "N/A"] as const;

function FieldLabel({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label className="label" htmlFor={htmlFor}>
      {children}
    </label>
  );
}

function TextField({
  id,
  label,
  defaultValue,
  placeholder,
  multiline,
  hint
}: {
  id: string;
  label: string;
  defaultValue?: string | null;
  placeholder?: string;
  multiline?: boolean;
  hint?: string;
}) {
  return (
    <div>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {multiline ? (
        <textarea className="field min-h-24" defaultValue={defaultValue ?? ""} id={id} name={id} placeholder={placeholder} />
      ) : (
        <input className="field" defaultValue={defaultValue ?? ""} id={id} name={id} placeholder={placeholder} />
      )}
      {hint ? <p className="mt-1 text-xs text-[var(--dim)]">{hint}</p> : null}
    </div>
  );
}

function SelectField({
  id,
  label,
  options,
  defaultValue,
  hint
}: {
  id: string;
  label: string;
  options: readonly string[];
  defaultValue?: string | null;
  hint?: string;
}) {
  return (
    <div>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <select className="field" defaultValue={defaultValue ?? ""} id={id} name={id}>
        <option value="">Select...</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      {hint ? <p className="mt-1 text-xs text-[var(--dim)]">{hint}</p> : null}
    </div>
  );
}

function ToggleField({
  checked,
  hint,
  id,
  label,
  onChange
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  hint?: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-[var(--border)] p-4">
      <button
        aria-pressed={checked}
        className={`mt-0.5 flex h-7 w-12 items-center rounded-full border-2 transition ${
          checked ? "border-[var(--gold)] bg-[var(--gold)]" : "border-[var(--border2)] bg-[var(--card2)]"
        }`}
        onClick={() => onChange(!checked)}
        type="button"
      >
        <span
          className={`block h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-[22px]" : "translate-x-[2px]"}`}
        />
      </button>
      <input name={id} type="hidden" value={checked ? "true" : "false"} />
      <div>
        <p className="text-sm font-semibold text-[var(--text)]">{label}</p>
        {hint ? <p className="text-xs text-[var(--dim)]">{hint}</p> : null}
      </div>
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <p className="section-kicker text-[0.65rem] uppercase">{children}</p>
      <div className="gold-divider mt-2" />
    </div>
  );
}

export function SurveyForm({ jobId, roofType, surveyType, initialSurvey }: Props) {
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [selectedSurveyType, setSelectedSurveyType] = useState<SurveyType>((initialSurvey?.survey_type as SurveyType) ?? surveyType);
  const [scaffoldRequired, setScaffoldRequired] = useState(initialSurvey?.scaffold_required ?? false);
  const [noPhotoConfirmation, setNoPhotoConfirmation] = useState(initialSurvey?.no_photo_confirmation ?? false);
  const [extraSections, setExtraSections] = useState<Set<SectionKey>>(new Set());
  const adaptive = (initialSurvey?.adaptive_sections ?? {}) as Record<string, Record<string, unknown>>;

  const activeSections = useMemo(() => {
    const sections = new Set<SectionKey>(["core"]);
    if (selectedSurveyType === "Flat Roof") sections.add("flat");
    if (selectedSurveyType === "Pitched / Tiled") sections.add("pitched");
    if (selectedSurveyType === "Fascias / Soffits / Gutters") sections.add("fascia");
    if (selectedSurveyType === "Chimney / Lead") sections.add("chimney");
    for (const section of extraSections) {
      sections.add(section);
    }
    return sections;
  }, [extraSections, selectedSurveyType]);

  return (
    <form
      className="stack"
      onSubmit={async (event) => {
        event.preventDefault();
        setError(null);
        setSaved(false);
        const formData = new FormData(event.currentTarget);
        const payload: Record<string, unknown> = {};

        formData.forEach((value, key) => {
          payload[key] = value === "true" ? true : value === "false" ? false : value;
        });

        payload.survey_type = selectedSurveyType;
        payload.roof_type = roofType;
        payload.scaffold_required = scaffoldRequired;
        payload.no_photo_confirmation = noPhotoConfirmation;

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
        <SectionHeader>Survey Type</SectionHeader>
        <div className="grid gap-2 sm:grid-cols-3">
          {SURVEY_TYPES.map((option) => (
            <button
              className={`rounded-2xl border px-3 py-3 text-left text-sm font-semibold transition ${
                selectedSurveyType === option
                  ? "border-[var(--gold)] bg-[rgba(212,175,55,0.14)] text-[var(--gold-l)]"
                  : "border-[var(--border)] bg-[var(--card)] text-[var(--text)]"
              }`}
              key={option}
              onClick={() => {
                setSelectedSurveyType(option);
                setExtraSections(new Set());
              }}
              type="button"
            >
              {option}
            </button>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {([
            ["flat", "Flat"],
            ["pitched", "Pitched"],
            ["fascia", "Fascias"],
            ["chimney", "Chimney"]
          ] as Array<[SectionKey, string]>).map(([section, label]) => (
            <span
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                activeSections.has(section)
                  ? "border-[var(--gold)] bg-[rgba(212,175,55,0.14)] text-[var(--gold-l)]"
                  : "border-[var(--border)] text-[var(--dim)]"
              }`}
              key={section}
              onClick={() =>
                setExtraSections((current) => {
                  const next = new Set(current);
                  if (next.has(section)) next.delete(section);
                  else next.add(section);
                  return next;
                })
              }
            >
              {label}
            </span>
          ))}
        </div>
      </div>

      <div className="card p-5">
        <SectionHeader>Core Survey</SectionHeader>
        <div className="grid gap-4 md:grid-cols-2">
          <TextField defaultValue={initialSurvey?.surveyor_name ?? "Andrew Bailey"} id="surveyor_name" label="Surveyor" />
          <SelectField defaultValue={initialSurvey?.roof_condition ?? ""} id="roof_condition" label="Overall Condition" options={CONDITIONS} />
          <TextField defaultValue={initialSurvey?.problem_observed ?? ""} hint="Main issue the customer called about." id="problem_observed" label="Problem Observed" multiline placeholder="What did you find on site?" />
          <TextField defaultValue={initialSurvey?.suspected_cause ?? ""} id="suspected_cause" label="Suspected Cause" multiline placeholder="What looks to be causing the issue?" />
          <TextField defaultValue={initialSurvey?.recommended_works ?? ""} hint="This feeds directly into the quote engine." id="recommended_works" label="Recommended Works" multiline placeholder="What works do you recommend?" />
          <TextField defaultValue={initialSurvey?.measurements ?? ""} id="measurements" label="Measurements" multiline placeholder="m2, linear metres, outlets, ridge runs..." />
          <TextField defaultValue={initialSurvey?.access_notes ?? ""} id="access_notes" label="Access Notes" multiline placeholder="Scaffold, parking, neighbours, conservatories..." />
          <TextField defaultValue={initialSurvey?.customer_concerns ?? ""} hint="Use the customer's own wording where possible." id="customer_concerns" label="Customer Concerns" multiline placeholder="Anything the customer wants priced or explained?" />
          <TextField defaultValue={initialSurvey?.weather_notes ?? ""} id="weather_notes" label="Weather Notes" multiline placeholder="Conditions during survey." />
          <TextField defaultValue={initialSurvey?.safety_notes ?? ""} id="safety_notes" label="Safety Notes" multiline placeholder="Any hazards or controls needed." />
          <TextField defaultValue={initialSurvey?.voice_note_transcript ?? ""} id="voice_note_transcript" label="Voice Note Transcript" multiline placeholder="Optional dictated notes from site." />
          <TextField defaultValue={initialSurvey?.raw_notes ?? ""} id="raw_notes" label="Other Notes" multiline placeholder="Anything else that should stay on the job file." />
          <TextField defaultValue={initialSurvey?.scaffold_notes ?? ""} id="scaffold_notes" label="Scaffold Notes" multiline placeholder="Front, rear, tower access, edge protection..." />
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <ToggleField checked={scaffoldRequired} hint="Will scaffolding be needed?" id="scaffold_required" label="Scaffold Required" onChange={setScaffoldRequired} />
          <ToggleField
            checked={noPhotoConfirmation}
            hint="Use this only when the survey is complete but photos are not available."
            id="no_photo_confirmation"
            label="Ready For Quote Without Photos"
            onChange={setNoPhotoConfirmation}
          />
        </div>
      </div>

      {activeSections.has("flat") ? (
        <div className="card p-5">
          <SectionHeader>Flat Roof Details</SectionHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <SelectField defaultValue={String(adaptive.flat_roof?.current_surface_type ?? "")} id="flat_current_surface_type" label="Current Surface" options={["Felt", "EPDM Rubber", "GRP Fibreglass", "Lead", "Asphalt", "Liquid Applied", "Unknown"]} />
            <TextField defaultValue={String(adaptive.flat_roof?.approximate_age ?? "")} id="flat_approximate_age" label="Approximate Age" placeholder="e.g. 15 years" />
            <SelectField defaultValue={String(adaptive.flat_roof?.deck_condition ?? "")} id="flat_deck_condition" label="Deck Condition" options={CONDITIONS} />
            <SelectField defaultValue={String(adaptive.flat_roof?.drainage_condition ?? "")} id="flat_drainage_condition" label="Drainage" options={CONDITIONS} />
            <SelectField defaultValue={Boolean(adaptive.flat_roof?.standing_water) ? "Yes" : "No"} id="flat_standing_water" label="Standing Water" options={["Yes", "No"]} />
            <SelectField defaultValue={String(adaptive.flat_roof?.upstands_condition ?? "")} id="flat_upstands_condition" label="Upstands" options={CONDITIONS} />
            <SelectField defaultValue={String(adaptive.flat_roof?.flashings_condition ?? "")} id="flat_flashings_condition" label="Flashings" options={CONDITIONS} />
            <TextField defaultValue={String(adaptive.flat_roof?.rooflights ?? "")} id="flat_rooflights" label="Rooflights" placeholder="Number, type, condition" />
            <SelectField defaultValue={String(adaptive.flat_roof?.recommended_system ?? "")} id="flat_recommended_system" label="Recommended System" options={["Danosa Option 3", "GRP Fibreglass", "EPDM Rubber", "Liquid Applied", "Lead", "Single Ply", "Other"]} />
          </div>
        </div>
      ) : null}

      {activeSections.has("pitched") ? (
        <div className="card p-5">
          <SectionHeader>Pitched / Tiled Details</SectionHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <SelectField defaultValue={String(adaptive.pitched_roof?.tile_type ?? "")} id="p_tile_type" label="Tile Type" options={["Concrete Interlocking", "Plain Clay", "Slate", "Rosemary", "Unknown"]} />
            <SelectField defaultValue={String(adaptive.pitched_roof?.ridge_type ?? "")} id="p_ridge_type" label="Ridge Type" options={["Mortar Bedded", "Dry Ridge", "Half Round", "Angular", "Unknown"]} />
            <SelectField defaultValue={String(adaptive.pitched_roof?.valley_type ?? "")} id="p_valley_type" label="Valley Type" options={["Lead Lined", "GRP Trough", "Mortar", "Tile Valley", "None", "Unknown"]} />
            <TextField defaultValue={String(adaptive.pitched_roof?.missing_tiles ?? "")} id="p_missing_tiles" label="Missing Tiles" placeholder="Count" />
            <SelectField defaultValue={String(adaptive.pitched_roof?.felt_condition ?? "")} id="p_felt_condition" label="Underfelt Condition" options={CONDITIONS} />
            <TextField defaultValue={String(adaptive.pitched_roof?.battens ?? "")} id="p_battens" label="Battens" placeholder="Condition or notes" />
            <TextField defaultValue={String(adaptive.pitched_roof?.verge ?? "")} id="p_verge" label="Verge" placeholder="Mortar or dry verge" />
            <TextField defaultValue={String(adaptive.pitched_roof?.eaves ?? "")} id="p_eaves" label="Eaves" placeholder="Ventilation, trays, support..." />
          </div>
        </div>
      ) : null}

      {activeSections.has("fascia") ? (
        <div className="card p-5">
          <SectionHeader>Fascias / Soffits / Gutters</SectionHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <SelectField defaultValue={String(adaptive.fascias?.current_material ?? "")} id="f_current_material" label="Current Material" options={["uPVC", "Wood", "Composite", "Aluminium", "Unknown"]} />
            <SelectField defaultValue={String(adaptive.fascias?.fascia_condition ?? "")} id="f_fascia_condition" label="Fascia Condition" options={CONDITIONS} />
            <SelectField defaultValue={String(adaptive.fascias?.soffit_condition ?? "")} id="f_soffit_condition" label="Soffit Condition" options={CONDITIONS} />
            <SelectField defaultValue={String(adaptive.fascias?.guttering_condition ?? "")} id="f_guttering_condition" label="Guttering Condition" options={CONDITIONS} />
            <SelectField defaultValue={String(adaptive.fascias?.downpipe_condition ?? "")} id="f_downpipe_condition" label="Downpipe Condition" options={CONDITIONS} />
            <TextField defaultValue={String(adaptive.fascias?.colour_preference ?? "")} id="f_colour_preference" label="Colour Preference" placeholder="White, black, anthracite..." />
            <TextField defaultValue={String(adaptive.fascias?.linear_metres ?? "")} id="f_linear_metres" label="Linear Metres" placeholder="Total run" />
          </div>
        </div>
      ) : null}

      {activeSections.has("chimney") ? (
        <div className="card p-5">
          <SectionHeader>Chimney / Lead</SectionHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <SelectField defaultValue={String(adaptive.chimney?.chimney_condition ?? "")} id="c_chimney_condition" label="Chimney Condition" options={CONDITIONS} />
            <SelectField defaultValue={String(adaptive.chimney?.flaunching_condition ?? "")} id="c_flaunching_condition" label="Flaunching" options={CONDITIONS} />
            <SelectField defaultValue={String(adaptive.chimney?.lead_flashings_condition ?? "")} id="c_lead_flashings_condition" label="Lead Flashings" options={CONDITIONS} />
            <TextField defaultValue={String(adaptive.chimney?.pointing_condition ?? "")} id="c_pointing_condition" label="Pointing" placeholder="Mortar joints..." />
            <TextField defaultValue={String(adaptive.chimney?.chimney_pots ?? "")} id="c_chimney_pots" label="Chimney Pots" placeholder="Number, condition, caps..." />
            <TextField defaultValue={String(adaptive.chimney?.height_access ?? "")} id="c_height_access" label="Height / Access" placeholder="Scaffold needed?" />
            <TextField defaultValue={String(adaptive.chimney?.lead_code ?? "")} id="c_lead_code" label="Lead Code" placeholder="Code 4, Code 5..." />
            <TextField defaultValue={String(adaptive.chimney?.additional_notes ?? "")} id="c_additional_notes" label="Lead Notes" multiline placeholder="Soakers, back gutters, apron detail..." />
          </div>
        </div>
      ) : null}

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
