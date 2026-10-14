import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildSurveyUpdatePreview, executeSurveyTool } from "@/lib/surveys/service";
import { normaliseEnabledModules } from "@/lib/surveys/schema";

const { createSupabaseAdminClient } = vi.hoisted(() => ({ createSupabaseAdminClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient }));

const job = { id: "job-1", job_ref: "WR-J-20260921-5515", roof_type: "Pitched" };

describe("structured roof-report survey import", () => {
  beforeEach(() => createSupabaseAdminClient.mockReset());

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

  it("preserves unknown scaffold and photo-readiness values when other fields change", () => {
    const survey = {
      id: "survey-unknown",
      survey_type: "Other / Misc",
      roof_type: "Other",
      scaffold_required: null,
      no_photo_confirmation: null,
      enabled_modules: ["other"],
      adaptive_sections: { other: { survey_focus: "Unconfirmed access" } },
      updated_at: "2026-10-07T10:00:00.000Z"
    };
    const preview = buildSurveyUpdatePreview({
      job_ref: job.job_ref,
      global_fields: { problem_observed: "Water ingress reported; not yet inspected." }
    }, job, survey);

    expect(preview.target.scaffold_required).toBeNull();
    expect(preview.target.no_photo_confirmation).toBeNull();
    expect(preview.target.adaptive_sections.other.survey_focus).toBe("Unconfirmed access");
  });

  it("requires an explicit value before replacing an unknown boolean", () => {
    const survey = {
      id: "survey-unknown",
      survey_type: "Other / Misc",
      enabled_modules: ["other"],
      scaffold_required: null,
      adaptive_sections: { other: {} },
      updated_at: "2026-10-07T10:00:00.000Z"
    };
    const preview = buildSurveyUpdatePreview({ job_ref: job.job_ref }, job, survey);
    expect(preview.target.scaffold_required).toBeNull();
    expect(preview.changes.some((change) => change.field_path === "global.scaffold_required")).toBe(false);
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

  it("shows an explicit reclassification and active-module change in the preview", () => {
    const survey = {
      id: "survey-1",
      survey_type: "Other / Misc",
      roof_type: "Other",
      enabled_modules: ["other"],
      adaptive_sections: { other: { survey_focus: "Investigate leak" } },
      updated_at: "2026-10-07T10:00:00.000Z"
    };
    const preview = buildSurveyUpdatePreview({
      job_ref: job.job_ref,
      primary_survey_type: "Pitched / Tiled",
      roof_type: "Pitched",
      enabled_modules: ["pitched_roof"],
      modules: { pitched_roof: { tile_type: "Redland 49" } }
    }, job, survey);

    expect(preview.validation_errors).toEqual([]);
    expect(preview.changes.map((change) => change.field_path)).toEqual(expect.arrayContaining(["survey_type", "roof_type", "enabled_modules", "modules.pitched_roof.tile_type"]));
    expect(preview.target.adaptive_sections.other.survey_focus).toBe("Investigate leak");
    expect(preview.target.enabled_modules).toEqual(["pitched_roof"]);
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

  it("requires confirmation before even loading an update target", async () => {
    await expect(executeSurveyTool("update_survey", { confirmed: false }, { businessId: "business-1" } as never))
      .rejects.toThrow("confirmed must be true");
    expect(createSupabaseAdminClient).not.toHaveBeenCalled();
  });

  it("rejects a stale timestamp or changed preview hash without writing", async () => {
    const survey = { id: "survey-1", survey_type: "Other / Misc", enabled_modules: ["other"], adaptive_sections: { other: {} }, updated_at: "2026-10-07T10:00:00.000Z" };
    const jobsQuery = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: job, error: null }) };
    const surveysQuery = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: survey, error: null }) };
    const rpc = vi.fn();
    createSupabaseAdminClient.mockReturnValue({ from: (table: string) => table === "jobs" ? jobsQuery : surveysQuery, rpc });

    await expect(executeSurveyTool("update_survey", {
      job_ref: job.job_ref, confirmed: true, expected_updated_at: "2026-10-07T09:59:00.000Z", update_hash: "x".repeat(64),
      global_fields: { problem_observed: "New observation" }
    }, { businessId: "business-1" } as never)).rejects.toThrow("changed after preview");
    expect(rpc).not.toHaveBeenCalled();

    await expect(executeSurveyTool("update_survey", {
      job_ref: job.job_ref, confirmed: true, expected_updated_at: survey.updated_at, update_hash: "x".repeat(64),
      global_fields: { problem_observed: "New observation" }
    }, { businessId: "business-1" } as never)).rejects.toThrow("do not match the preview");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("applies only a confirmed preview to the existing survey in the authenticated workspace", async () => {
    const survey = {
      id: "survey-1", survey_type: "Other / Misc", enabled_modules: ["other"],
      scaffold_required: null, no_photo_confirmation: null,
      adaptive_sections: { other: { survey_focus: "Keep this note" } }, updated_at: "2026-10-07T10:00:00.000Z"
    };
    const jobFilters: unknown[][] = [];
    const jobsQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn((...args: unknown[]) => { jobFilters.push(args); return jobsQuery; }),
      maybeSingle: vi.fn().mockResolvedValue({ data: job, error: null })
    };
    const surveysQuery = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: survey, error: null }) };
    const rpc = vi.fn().mockResolvedValue({ data: { survey_id: survey.id, updated_at: "2026-10-07T10:01:00.000Z" }, error: null });
    createSupabaseAdminClient.mockReturnValue({ from: (table: string) => table === "jobs" ? jobsQuery : surveysQuery, rpc });
    const proposed = { job_ref: job.job_ref, global_fields: { problem_observed: "Water ingress reported; not yet inspected." } };
    const preview = buildSurveyUpdatePreview(proposed, job, survey);

    const result = await executeSurveyTool("update_survey", {
      ...proposed, confirmed: true, expected_updated_at: survey.updated_at, update_hash: preview.update_hash
    }, { businessId: "business-1", actorId: "operator-1" } as never);

    expect(result.ok).toBe(true);
    expect(jobFilters).toContainEqual(["business_id", "business-1"]);
    expect(rpc).toHaveBeenCalledOnce();
    const [, rpcInput] = rpc.mock.calls[0];
    expect(rpcInput.p_target.scaffold_required).toBeNull();
    expect(rpcInput.p_target.no_photo_confirmation).toBeNull();
    expect(rpcInput.p_target.adaptive_sections.other.survey_focus).toBe("Keep this note");
    expect(rpcInput.p_actor_id).toBe("operator-1");
  });

  it("never creates a survey when the previewed survey is missing", async () => {
    const jobsQuery = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: job, error: null }) };
    const surveysQuery = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) };
    const rpc = vi.fn();
    createSupabaseAdminClient.mockReturnValue({ from: (table: string) => table === "jobs" ? jobsQuery : surveysQuery, rpc });

    await expect(executeSurveyTool("update_survey", {
      job_ref: job.job_ref, confirmed: true, expected_updated_at: null, update_hash: "x".repeat(64)
    }, { businessId: "business-1" } as never)).rejects.toThrow("no existing survey");
    expect(rpc).not.toHaveBeenCalled();
  });
});
