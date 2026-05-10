"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { RoofType, SurveyRecord, SurveyType } from "@/lib/types";

type Props = {
  jobId: string;
  roofType: RoofType;
  surveyType: SurveyType;
  initialSurvey?: SurveyRecord | null;
};

export function SurveyForm({ jobId, roofType, surveyType, initialSurvey }: Props) {
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [scaffoldRequired, setScaffoldRequired] = useState(initialSurvey?.scaffold_required ?? false);
  const [noPhotoConfirmation, setNoPhotoConfirmation] = useState(initialSurvey?.no_photo_confirmation ?? false);

  return (
    <form
      className="card p-5"
      onSubmit={async (event) => {
        event.preventDefault();
        setError(null);
        const formData = new FormData(event.currentTarget);

        const response = await fetch(`/api/jobs/${jobId}/survey`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            surveyor_name: String(formData.get("surveyor-name") || ""),
            access_notes: String(formData.get("access-notes") || ""),
            scaffold_required: scaffoldRequired,
            scaffold_notes: String(formData.get("scaffold-notes") || ""),
            roof_condition: String(formData.get("roof-condition") || ""),
            problem_observed: String(formData.get("problem-observed") || ""),
            suspected_cause: String(formData.get("suspected-cause") || ""),
            recommended_works: String(formData.get("recommended-works") || ""),
            measurements: String(formData.get("measurements") || ""),
            weather_notes: String(formData.get("weather-notes") || ""),
            safety_notes: String(formData.get("safety-notes") || ""),
            customer_concerns: String(formData.get("customer-concerns") || ""),
            voice_note_transcript: String(formData.get("voice-note-transcript") || ""),
            raw_notes: String(formData.get("raw-notes") || ""),
            survey_type: surveyType,
            roof_type: roofType,
            no_photo_confirmation: noPhotoConfirmation,
            adaptive_sections: initialSurvey?.adaptive_sections ?? {}
          })
        });

        const result = (await response.json().catch(() => null)) as { ok?: boolean } | null;
        if (!response.ok || !result?.ok) {
          setSaved(false);
          setError("Survey could not be saved. Please check the required site details.");
          return;
        }

        setSaved(true);
        startTransition(() => {
          router.refresh();
        });
      }}
    >
      <p className="section-kicker text-[0.65rem] uppercase">Adaptive Survey</p>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <label className="label" htmlFor="surveyor-name">
            Surveyor
          </label>
          <input className="field" defaultValue={initialSurvey?.surveyor_name ?? "Andrew Bailey"} id="surveyor-name" name="surveyor-name" />
        </div>
        <div>
          <label className="label" htmlFor="roof-condition">
            Roof Condition
          </label>
          <select className="field" defaultValue={initialSurvey?.roof_condition ?? ""} id="roof-condition" name="roof-condition">
            <option value="">Select condition</option>
            <option value="Good">Good</option>
            <option value="Fair">Fair</option>
            <option value="Poor">Poor</option>
            <option value="Critical">Critical</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="problem-observed">
            Problem Observed
          </label>
          <textarea
            className="field min-h-28"
            defaultValue={initialSurvey?.problem_observed ?? ""}
            id="problem-observed"
            name="problem-observed"
            placeholder="What did you find on site?"
          />
        </div>
        <div>
          <label className="label" htmlFor="recommended-works">
            Recommended Works
          </label>
          <textarea
            className="field min-h-28"
            defaultValue={initialSurvey?.recommended_works ?? ""}
            id="recommended-works"
            name="recommended-works"
            placeholder="What works do you recommend?"
          />
        </div>
        <div>
          <label className="label" htmlFor="measurements">
            Measurements
          </label>
          <textarea
            className="field min-h-24"
            defaultValue={initialSurvey?.measurements ?? ""}
            id="measurements"
            name="measurements"
            placeholder="Lengths, widths, area, outlets, runs..."
          />
        </div>
        <div>
          <label className="label" htmlFor="access-notes">
            Access Notes
          </label>
          <textarea
            className="field min-h-24"
            defaultValue={initialSurvey?.access_notes ?? ""}
            id="access-notes"
            name="access-notes"
            placeholder="Scaffold, towers, parking, neighbour access..."
          />
        </div>
        <div>
          <label className="label" htmlFor="suspected-cause">
            Suspected Cause
          </label>
          <textarea
            className="field min-h-24"
            defaultValue={initialSurvey?.suspected_cause ?? ""}
            id="suspected-cause"
            name="suspected-cause"
            placeholder="What looks to be causing the issue?"
          />
        </div>
        <div>
          <label className="label" htmlFor="customer-concerns">
            Customer Concerns
          </label>
          <textarea
            className="field min-h-24"
            defaultValue={initialSurvey?.customer_concerns ?? ""}
            id="customer-concerns"
            name="customer-concerns"
            placeholder="Anything the customer specifically wants priced or explained?"
          />
        </div>
        <div>
          <label className="label" htmlFor="scaffold-notes">
            Scaffold Notes
          </label>
          <textarea className="field min-h-24" defaultValue={initialSurvey?.scaffold_notes ?? ""} id="scaffold-notes" name="scaffold-notes" placeholder="Front, rear, tower access, edge protection, or no scaffold needed." />
        </div>
        <div>
          <label className="label" htmlFor="weather-notes">
            Weather Notes
          </label>
          <textarea className="field min-h-24" defaultValue={initialSurvey?.weather_notes ?? ""} id="weather-notes" name="weather-notes" placeholder="Weather conditions during survey." />
        </div>
        <div>
          <label className="label" htmlFor="safety-notes">
            Safety Notes
          </label>
          <textarea className="field min-h-24" defaultValue={initialSurvey?.safety_notes ?? ""} id="safety-notes" name="safety-notes" placeholder="Any hazards, access risks, or controls needed." />
        </div>
        <div>
          <label className="label" htmlFor="voice-note-transcript">
            Voice Note Transcript
          </label>
          <textarea className="field min-h-24" defaultValue={initialSurvey?.voice_note_transcript ?? ""} id="voice-note-transcript" name="voice-note-transcript" placeholder="Optional dictated notes from site." />
        </div>
        <div className="md:col-span-2">
          <label className="label" htmlFor="raw-notes">
            Raw Notes
          </label>
          <textarea className="field min-h-28" defaultValue={initialSurvey?.raw_notes ?? ""} id="raw-notes" name="raw-notes" placeholder="Anything extra that should stay on the job record." />
        </div>
        <div className="rounded-2xl border border-[var(--border)] p-4">
          <label className="flex items-center gap-3 text-sm text-[var(--text)]">
            <input checked={scaffoldRequired} onChange={(event) => setScaffoldRequired(event.target.checked)} type="checkbox" />
            Scaffold required
          </label>
        </div>
        <div className="rounded-2xl border border-[var(--border)] p-4">
          <label className="flex items-center gap-3 text-sm text-[var(--text)]">
            <input checked={noPhotoConfirmation} onChange={(event) => setNoPhotoConfirmation(event.target.checked)} type="checkbox" />
            No photos available yet, but survey is ready for quoting
          </label>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap gap-3">
        <button className="button-primary" disabled={isPending} type="submit">
          {isPending ? "Saving Survey..." : "Save Survey"}
        </button>
      </div>
      {saved ? <p className="mt-4 text-sm text-[#7ce3a6]">Survey saved to the job record.</p> : null}
      {error ? <p className="mt-4 text-sm text-[#ff9a91]">{error}</p> : null}
    </form>
  );
}
