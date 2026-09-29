import { createHash } from "node:crypto";
import type { AssistantRouteContext, ToolExecutionResult } from "@/lib/assistant/types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  GLOBAL_SURVEY_FIELDS,
  MODULE_LABEL_TO_KEY,
  SURVEY_MODULES,
  SURVEY_MODULE_SCHEMA,
  moduleForSurveyType,
  normaliseEnabledModules,
  validateSurveyField,
  type SurveyModuleKey
} from "@/lib/surveys/schema";
import { mapJobDocumentToSurvey } from "@/lib/surveys/documentImport";

type Row = Record<string, any>;
type Input = Record<string, any>;
const EVIDENCE_CLASSES = ["CONFIRMED", "SURVEYOR_STATED", "MEASURED", "APPROXIMATE", "INFERRED", "UNKNOWN"];

function requireContext(context?: AssistantRouteContext) {
  if (!context?.businessId) throw new Error("Authenticated workspace context is required.");
  return { businessId: context.businessId, actorId: context.actorId ?? null };
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value as Row).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`).join(",")}}`;
  return JSON.stringify(value);
}

function hashPreview(value: unknown) {
  return createHash("sha256").update(stable(value)).digest("hex");
}

async function loadJobSurvey(jobRef: string, businessId: string) {
  const supabase = createSupabaseAdminClient();
  const jobResult = await supabase.from("jobs").select("*,customers(full_name,email,phone)").eq("business_id", businessId).eq("job_ref", jobRef).maybeSingle();
  if (jobResult.error || !jobResult.data) throw new Error(jobResult.error?.message ?? `Job ${jobRef} was not found in this workspace.`);
  const surveyResult = await supabase.from("surveys").select("*").eq("job_id", jobResult.data.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (surveyResult.error) throw new Error(surveyResult.error.message);
  return { supabase, job: jobResult.data as Row, survey: surveyResult.data as Row | null };
}

function isBlank(value: unknown) {
  return value == null || value === "" || (Array.isArray(value) && value.length === 0);
}

function evidenceMap(input: Input) {
  const items = Array.isArray(input.evidence) ? input.evidence as Row[] : [];
  return new Map(items.map((item) => [String(item.field_path ?? ""), item]));
}

export function buildSurveyUpdatePreview(input: Input, job: Row, survey: Row | null) {
  const primaryType = String(input.primary_survey_type ?? survey?.survey_type ?? "Other / Misc");
  if (!MODULE_LABEL_TO_KEY[primaryType]) throw new Error("primary_survey_type is not a supported survey type.");
  const requestedModules = input.enabled_modules ?? survey?.enabled_modules;
  const enabledModules = normaliseEnabledModules(requestedModules, primaryType);
  const globalInput = (input.global_fields ?? input.global ?? {}) as Row;
  const modulesInput = (input.modules ?? {}) as Row;
  const approvedConflicts = new Set(Array.isArray(input.approved_conflicts) ? input.approved_conflicts.map(String) : []);
  const approvedUncertain = new Set(Array.isArray(input.approved_uncertain) ? input.approved_uncertain.map(String) : []);
  const evidence = evidenceMap(input);
  const changes: Row[] = [];
  const conflicts: Row[] = [];
  const unsupported: Row[] = [];
  const validationErrors: Row[] = [];
  const uncertain: Row[] = [];
  const target: Row = {
    surveyor_name: survey?.surveyor_name ?? null, access_notes: survey?.access_notes ?? null,
    scaffold_required: survey?.scaffold_required ?? false, scaffold_notes: survey?.scaffold_notes ?? null,
    roof_condition: survey?.roof_condition ?? null, problem_observed: survey?.problem_observed ?? null,
    suspected_cause: survey?.suspected_cause ?? null, recommended_works: survey?.recommended_works ?? null,
    measurements: survey?.measurements ?? null, weather_notes: survey?.weather_notes ?? null,
    safety_notes: survey?.safety_notes ?? null, customer_concerns: survey?.customer_concerns ?? null,
    voice_note_transcript: survey?.voice_note_transcript ?? null, raw_notes: survey?.raw_notes ?? null,
    no_photo_confirmation: survey?.no_photo_confirmation ?? false, survey_type: primaryType,
    roof_type: String(input.roof_type ?? survey?.roof_type ?? job.roof_type ?? "Other"),
    enabled_modules: enabledModules,
    adaptive_sections: structuredClone((survey?.adaptive_sections ?? {}) as Row)
  };

  const consider = (path: string, current: unknown, proposed: unknown, definition: Parameters<typeof validateSurveyField>[0], applyValue: (value: unknown) => void) => {
    const checked = validateSurveyField(definition, proposed);
    if (!checked.ok) { validationErrors.push({ field_path: path, proposed, error: checked.error }); return; }
    const itemEvidence = evidence.get(path) ?? {};
    const evidenceClass = String(itemEvidence.evidence_class ?? "CONFIRMED").toUpperCase();
    if (!EVIDENCE_CLASSES.includes(evidenceClass)) { validationErrors.push({ field_path: path, error: "Invalid evidence_class." }); return; }
    const isUncertain = evidenceClass === "INFERRED" || evidenceClass === "UNKNOWN" || (itemEvidence.confidence != null && Number(itemEvidence.confidence) < 0.7);
    const conflict = !isBlank(current) && stable(current) !== stable(checked.value);
    const applied = (!conflict || approvedConflicts.has(path)) && (!isUncertain || approvedUncertain.has(path));
    const row = { field_path: path, existing: current ?? null, proposed: checked.value, applied, evidence_class: evidenceClass, confidence: itemEvidence.confidence ?? null, source_page: itemEvidence.source_page ?? null };
    if (conflict) conflicts.push(row);
    if (isUncertain) uncertain.push(row);
    if (applied && stable(current) !== stable(checked.value)) { changes.push(row); applyValue(checked.value); }
  };

  for (const [key, value] of Object.entries(globalInput)) {
    const definition = GLOBAL_SURVEY_FIELDS[key];
    if (!definition) { unsupported.push({ field_path: `global.${key}`, value }); continue; }
    consider(`global.${key}`, target[key], value, definition, (next) => { target[key] = next; });
  }

  for (const [rawModule, rawFields] of Object.entries(modulesInput)) {
    const moduleKey = (SURVEY_MODULES.includes(rawModule as SurveyModuleKey) ? rawModule : MODULE_LABEL_TO_KEY[rawModule]) as SurveyModuleKey | undefined;
    if (!moduleKey || !rawFields || typeof rawFields !== "object" || Array.isArray(rawFields)) { unsupported.push({ field_path: `modules.${rawModule}`, value: rawFields }); continue; }
    if (!enabledModules.includes(moduleKey)) enabledModules.push(moduleKey);
    const existingModule = (target.adaptive_sections[moduleKey] ?? {}) as Row;
    const nextModule = { ...existingModule };
    for (const [key, value] of Object.entries(rawFields as Row)) {
      const definition = SURVEY_MODULE_SCHEMA[moduleKey].fields[key];
      const path = `modules.${moduleKey}.${key}`;
      if (!definition) { unsupported.push({ field_path: path, value }); continue; }
      consider(path, existingModule[key], value, definition, (next) => { nextModule[key] = next; });
    }
    target.adaptive_sections[moduleKey] = nextModule;
  }

  target.enabled_modules = Array.from(new Set(enabledModules));
  const proposalIdentity = { job_ref: job.job_ref, expected_updated_at: survey?.updated_at ?? null, target, applied_paths: changes.map((item) => item.field_path) };
  const populatedPaths = new Set([...Object.keys(globalInput).map((key) => `global.${key}`), ...Object.entries(modulesInput).flatMap(([module, fields]) => Object.keys((fields as Row) ?? {}).map((key) => `modules.${module}.${key}`))]);
  const blankFieldCount = Object.keys(GLOBAL_SURVEY_FIELDS).filter((key) => isBlank(target[key]) && !populatedPaths.has(`global.${key}`)).length
    + enabledModules.reduce((sum, module) => sum + Object.keys(SURVEY_MODULE_SCHEMA[module].fields).filter((key) => isBlank(target.adaptive_sections[module]?.[key])).length, 0);
  return { job_ref: job.job_ref, survey_id: survey?.id ?? null, expected_updated_at: survey?.updated_at ?? null, primary_survey_type: primaryType, enabled_modules: target.enabled_modules, changes, conflicts, uncertain, unsupported_fields: unsupported, validation_errors: validationErrors, fields_left_blank: blankFieldCount, target, update_hash: hashPreview(proposalIdentity) };
}

async function getSurveySchema(input: Input, context?: AssistantRouteContext): Promise<ToolExecutionResult> {
  const requested: string[] = Array.isArray(input.module_types) ? input.module_types.map(String) : [...SURVEY_MODULES];
  const modules = Object.fromEntries(Object.entries(SURVEY_MODULE_SCHEMA).filter(([key]) => requested.includes(key) || requested.includes(SURVEY_MODULE_SCHEMA[key as SurveyModuleKey].label)));
  return { ok: true, summary: `Loaded the current survey schema with ${Object.keys(modules).length} specialist module${Object.keys(modules).length === 1 ? "" : "s"}.`, data: { global_fields: GLOBAL_SURVEY_FIELDS, modules, rules: { unknown_values: "Leave unsupported facts blank. Do not infer measurements.", approximate_measurements: "Keep the value approximate and provide evidence_class APPROXIMATE.", manual_conflicts: "Existing values are preserved unless their exact field paths are explicitly approved." } } };
}

async function getJobSurvey(input: Input, context?: AssistantRouteContext): Promise<ToolExecutionResult> {
  const { businessId } = requireContext(context);
  const { supabase, job, survey } = await loadJobSurvey(String(input.job_ref ?? ""), businessId);
  const evidenceResult = survey ? await supabase.from("survey_field_evidence").select("field_path,value,source_type,source_page,evidence_class,confidence,verified,created_at").eq("business_id", businessId).eq("survey_id", survey.id).order("created_at", { ascending: false }) : { data: [], error: null };
  if (evidenceResult.error) throw new Error(evidenceResult.error.message);
  const modules = survey ? normaliseEnabledModules(survey.enabled_modules, survey.survey_type) : [];
  return { ok: true, summary: survey ? `Loaded the structured survey for ${job.job_ref} with ${modules.length} active section${modules.length === 1 ? "" : "s"}.` : `${job.job_ref} does not have a survey yet.`, data: { job: { job_ref: job.job_ref, job_title: job.job_title, property_address: job.property_address, postcode: job.postcode, customer: job.customers }, survey: survey ? { ...survey, enabled_modules: modules } : null, field_evidence: evidenceResult.data ?? [] } };
}

async function previewSurveyUpdate(input: Input, context?: AssistantRouteContext): Promise<ToolExecutionResult> {
  const { businessId } = requireContext(context);
  const { job, survey } = await loadJobSurvey(String(input.job_ref ?? ""), businessId);
  const preview = buildSurveyUpdatePreview(input, job, survey);
  return { ok: preview.validation_errors.length === 0, summary: `Previewed ${preview.changes.length} structured field change${preview.changes.length === 1 ? "" : "s"}; ${preview.conflicts.length} conflict${preview.conflicts.length === 1 ? "" : "s"}, ${preview.uncertain.length} uncertain value${preview.uncertain.length === 1 ? "" : "s"}, and ${preview.unsupported_fields.length} unsupported field${preview.unsupported_fields.length === 1 ? "" : "s"}. Nothing was saved.`, data: { ...preview, target: undefined, saved: false } };
}

async function previewSurveyFromDocument(input: Input, context?: AssistantRouteContext): Promise<ToolExecutionResult> {
  const { businessId } = requireContext(context);
  const jobRef = String(input.job_ref ?? "");
  const documentId = String(input.document_id ?? "");
  const mapped = await mapJobDocumentToSurvey({ businessId, jobRef, documentId });
  const { job, survey } = await loadJobSurvey(jobRef, businessId);
  const preview = buildSurveyUpdatePreview(mapped.proposal, job, survey);
  return {
    ok: preview.validation_errors.length === 0,
    summary: `Read ${mapped.document.display_name} and previewed ${preview.changes.length} structured survey change${preview.changes.length === 1 ? "" : "s"}; nothing was saved.`,
    data: { ...preview, target: undefined, saved: false, proposal: mapped.proposal, document: mapped.document }
  };
}

async function updateSurvey(input: Input, context?: AssistantRouteContext): Promise<ToolExecutionResult> {
  if (input.confirmed !== true) throw new Error("confirmed must be true after the user reviews the survey preview.");
  const { businessId, actorId } = requireContext(context);
  const { supabase, job, survey } = await loadJobSurvey(String(input.job_ref ?? ""), businessId);
  if ((input.expected_updated_at ?? null) !== (survey?.updated_at ?? null)) throw new Error("The survey changed after preview. Refresh and preview again.");
  const preview = buildSurveyUpdatePreview(input, job, survey);
  if (preview.validation_errors.length) throw new Error("The proposed survey contains validation errors. Preview and correct them first.");
  if (String(input.update_hash ?? "") !== preview.update_hash) throw new Error("The confirmed survey changes do not match the preview. Preview this exact update again.");
  const sourceDocumentId = input.source_document_id ? String(input.source_document_id) : null;
  if (sourceDocumentId) {
    const documentResult = await supabase.from("job_documents").select("id").eq("id", sourceDocumentId).eq("job_id", job.id).maybeSingle();
    if (documentResult.error || !documentResult.data) throw new Error("The source document was not found on this job.");
  }
  const inputEvidence = evidenceMap(input);
  const appliedEvidence = preview.changes.map((change) => {
    const item = inputEvidence.get(change.field_path) ?? {};
    return { field_path: change.field_path, value: change.proposed, source_page: item.source_page ?? null, source_excerpt: item.source_excerpt ?? null, evidence_class: change.evidence_class, confidence: change.confidence, verified: false };
  });
  const result = await supabase.rpc("apply_structured_survey_import", { p_business_id: businessId, p_job_ref: job.job_ref, p_expected_updated_at: preview.expected_updated_at, p_target: preview.target, p_evidence: appliedEvidence, p_source_document_id: sourceDocumentId, p_source_type: String(input.source_type ?? "roof_report"), p_summary: String(input.import_summary ?? `Applied ${preview.changes.length} structured survey fields.`), p_actor_id: actorId });
  if (result.error) throw new Error(result.error.message);
  return { ok: true, summary: `Updated ${job.job_ref}: applied ${preview.changes.length} structured field change${preview.changes.length === 1 ? "" : "s"} across ${preview.enabled_modules.length} survey section${preview.enabled_modules.length === 1 ? "" : "s"}. Unsupported and unapproved conflicting or uncertain values were not saved.`, navigation: { path: `/jobs/${job.id}/survey` }, data: { ...result.data, applied_fields: preview.changes.map((item) => item.field_path), preserved_conflicts: preview.conflicts.filter((item) => !item.applied).map((item) => item.field_path), omitted_uncertain: preview.uncertain.filter((item) => !item.applied).map((item) => item.field_path), enabled_modules: preview.enabled_modules } };
}

export async function executeSurveyTool(toolName: string, input: Input, context?: AssistantRouteContext): Promise<ToolExecutionResult> {
  switch (toolName) {
    case "get_survey_schema": return getSurveySchema(input, context);
    case "get_job_survey": return getJobSurvey(input, context);
    case "preview_survey_update": return previewSurveyUpdate(input, context);
    case "preview_survey_from_document": return previewSurveyFromDocument(input, context);
    case "update_survey": return updateSurvey(input, context);
    case "set_survey_modules": return previewSurveyUpdate(input, context);
    default: throw new Error(`Unknown survey tool: ${toolName}`);
  }
}
