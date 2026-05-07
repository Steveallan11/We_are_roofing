"use client";

import { useState } from "react";
import type { SurveyRecord } from "@/lib/types";

type Props = {
  initialSurvey?: SurveyRecord | null;
};

export function SurveyForm({ initialSurvey }: Props) {
  const [saved, setSaved] = useState(false);

  return (
    <form
      className="card p-5"
      onSubmit={(event) => {
        event.preventDefault();
        setSaved(true);
      }}
    >
      <p className="section-kicker text-[0.65rem] uppercase">Adaptive Survey</p>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <label className="label" htmlFor="surveyor-name">
            Surveyor
          </label>
          <input className="field" defaultValue={initialSurvey?.surveyor_name ?? "Andrew Bailey"} id="surveyor-name" />
        </div>
        <div>
          <label className="label" htmlFor="roof-condition">
            Roof Condition
          </label>
          <select className="field" defaultValue={initialSurvey?.roof_condition ?? ""} id="roof-condition">
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
            placeholder="Anything the customer specifically wants priced or explained?"
          />
        </div>
      </div>
      <div className="mt-5 flex flex-wrap gap-3">
        <button className="button-primary" type="submit">
          Save Survey
        </button>
        <span className="button-secondary">Save to CRM + quote workflow</span>
        {saved ? <p className="self-center text-sm text-[#7ce3a6]">Survey draft saved locally in this preview.</p> : null}
      </div>
    </form>
  );
}
