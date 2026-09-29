import { describe, expect, it } from "vitest";
import { buildSurveyUpdatePreview } from "@/lib/surveys/service";
import { normaliseEnabledModules } from "@/lib/surveys/schema";

const job = { id: "job-1", job_ref: "WR-J-20260921-5515", roof_type: "Pitched" };

describe("structured roof-report survey import", () => {
  it("supports several modules on one job and maps facts into structured fields", () => {
    const preview = buildSurveyUpdatePreview({
      job_ref: job.job_ref,
      primary_survey_type: "Pitched / Tiled",
      enabled_modules: ["pitched_roof", "fascias"],
      global_fields: { problem_observed: "Moss and silt accumulation with failed valley mortar." },
      modules: {
        pitched_roof: { tile_type: "Concrete Interlocking", moss_level: "Heavy", valley_condition: "Poor" },
        fascias: { fascia_condition: "Fair", guttering_condition: "Fair", gutter_profile: "Unknown" }
      }
    }, job, null);

    expect(preview.validation_errors).toEqual([]);
    expect(preview.enabled_modules).toEqual(["pitched_roof", "fascias"]);
    expect(preview.changes.map((change) => change.field_path)).toContain("modules.pitched_roof.tile_type");
    expect(preview.target.adaptive_sections.fascias.fascia_condition).toBe("Fair");
  });

  it("does not silently overwrite an existing manual value", () => {
    const survey = { id: "survey-1", survey_type: "Fascias / Soffits / Gutters", roof_type: "Fascia", enabled_modules: ["fascias"], adaptive_sections: { fascias: { fascia_condition: "Poor" } }, updated_at: "2026-09-28T10:00:00.000Z" };
    const preview = buildSurveyUpdatePreview({ job_ref: job.job_ref, modules: { fascias: { fascia_condition: "Fair" } } }, job, survey);
    expect(preview.conflicts).toHaveLength(1);
    expect(preview.conflicts[0].applied).toBe(false);
    expect(preview.target.adaptive_sections.fascias.fascia_condition).toBe("Poor");
  });

  it("keeps approximate or inferred facts out until their exact paths are approved", () => {
    const input = {
      job_ref: job.job_ref,
      primary_survey_type: "Pitched / Tiled",
      global_fields: { measurements: "Approximate spoken measurement: 19m; elevation not confirmed." },
      evidence: [{ field_path: "global.measurements", evidence_class: "APPROXIMATE", confidence: 0.9 }]
    };
    const approximate = buildSurveyUpdatePreview(input, job, null);
    expect(approximate.changes).toHaveLength(1);
    expect(approximate.changes[0].evidence_class).toBe("APPROXIMATE");

    const inferred = buildSurveyUpdatePreview({ ...input, modules: { pitched_roof: { pitch_angle_deg: 15 } }, evidence: [{ field_path: "modules.pitched_roof.pitch_angle_deg", evidence_class: "INFERRED" }] }, job, null);
    expect(inferred.uncertain[0].applied).toBe(false);
    expect(inferred.target.adaptive_sections.pitched_roof.pitch_angle_deg).toBeUndefined();
  });

  it("rejects invented schema keys and invalid enums", () => {
    const preview = buildSurveyUpdatePreview({ job_ref: job.job_ref, modules: { fascias: { gutter_profile: "Round-ish", invented_measurement: 19 } } }, job, null);
    expect(preview.validation_errors[0].field_path).toBe("modules.fascias.gutter_profile");
    expect(preview.unsupported_fields[0].field_path).toBe("modules.fascias.invented_measurement");
  });

  it("loads old single-type surveys as one active module", () => {
    expect(normaliseEnabledModules(undefined, "Flat Roof")).toEqual(["flat_roof"]);
  });

  it("passes the Sunil golden mapping without inventing measurements", () => {
    const preview = buildSurveyUpdatePreview({
      job_ref: "WR-J-20260921-5515",
      primary_survey_type: "Pitched / Tiled",
      roof_type: "Mixed",
      enabled_modules: ["pitched_roof", "fascias"],
      global_fields: {
        surveyor_name: "Andrew Bailey",
        roof_condition: "Fair",
        problem_observed: "Moss and silt accumulation is present, with deterioration to valley mortar and older hip/ridge bedding.",
        measurements: "Approximate spoken measurements: 19m, 5m, 3m, 4m and 9-14m. Elevations are not confirmed; tape measurement is required.",
        access_notes: "Roof accessed by ladder. Aluminium tower may be used where required.",
        scaffold_required: false
      },
      modules: {
        pitched_roof: {
          tile_type: "Concrete Interlocking",
          tile_condition: "Fair",
          moss_level: "Heavy",
          valley_condition: "Poor",
          ridge_condition: "Poor",
          hip_condition: "Poor"
        },
        fascias: {
          fascia_condition: "Fair",
          soffit_condition: "Fair",
          guttering_condition: "Fair",
          gutter_profile: "Unknown"
        }
      },
      evidence: [{ field_path: "global.measurements", evidence_class: "APPROXIMATE", source_page: 5 }]
    }, { ...job, job_ref: "WR-J-20260921-5515" }, null);

    expect(preview.validation_errors).toEqual([]);
    expect(preview.enabled_modules).toEqual(["pitched_roof", "fascias"]);
    expect(preview.target.adaptive_sections.pitched_roof.pitch_angle_deg).toBeUndefined();
    expect(preview.target.adaptive_sections.fascias.front_run_m).toBeUndefined();
    expect(preview.target.adaptive_sections.fascias.downpipe_condition).toBeUndefined();
    expect(preview.changes.find((change) => change.field_path === "global.measurements")?.evidence_class).toBe("APPROXIMATE");
  });
});
