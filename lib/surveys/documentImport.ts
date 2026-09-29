import OpenAI from "openai";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { GLOBAL_SURVEY_FIELDS, SURVEY_MODULE_SCHEMA } from "@/lib/surveys/schema";

type Row = Record<string, unknown>;

const SUPPORTED_MIME_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

function compactSchema() {
  return {
    global_fields: Object.fromEntries(Object.entries(GLOBAL_SURVEY_FIELDS).map(([key, field]) => [key, { type: field.type, unit: field.unit, allowed: field.allowed }])),
    modules: Object.fromEntries(Object.entries(SURVEY_MODULE_SCHEMA).map(([key, module]) => [key, { label: module.label, fields: Object.fromEntries(Object.entries(module.fields).map(([fieldKey, field]) => [fieldKey, { type: field.type, unit: field.unit, allowed: field.allowed }])) }]))
  };
}

function fieldJsonSchema(field: { type: string; allowed?: readonly string[] }) {
  if (field.allowed?.length) return { type: field.type === "string_array" ? "array" : "string", ...(field.type === "string_array" ? { items: { type: "string", enum: field.allowed } } : { enum: field.allowed }) };
  if (field.type === "number") return { type: "number" };
  if (field.type === "boolean") return { type: "boolean" };
  if (field.type === "string_array") return { type: "array", items: { type: "string" } };
  return { type: "string" };
}

const responseSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    primary_survey_type: { type: "string", enum: ["Pitched / Tiled", "Flat Roof", "Fascias / Soffits / Gutters", "Chimney / Lead", "Other / Misc"] },
    roof_type: { type: "string", enum: ["Flat", "Pitched", "Slate", "Tile", "Fascia", "Chimney", "Mixed", "Other"] },
    enabled_modules: { type: "array", items: { type: "string", enum: ["pitched_roof", "flat_roof", "fascias", "chimney", "other"] }, uniqueItems: true },
    global_fields: { type: "object", additionalProperties: false, properties: Object.fromEntries(Object.entries(GLOBAL_SURVEY_FIELDS).map(([key, field]) => [key, fieldJsonSchema(field)])) },
    modules: { type: "object", additionalProperties: false, properties: Object.fromEntries(Object.entries(SURVEY_MODULE_SCHEMA).map(([key, module]) => [key, { type: "object", additionalProperties: false, properties: Object.fromEntries(Object.entries(module.fields).map(([fieldKey, field]) => [fieldKey, fieldJsonSchema(field)])) }])) },
    evidence: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          field_path: { type: "string" }, source_page: { type: ["integer", "null"] }, source_excerpt: { type: ["string", "null"] },
          evidence_class: { type: "string", enum: ["CONFIRMED", "SURVEYOR_STATED", "MEASURED", "APPROXIMATE", "INFERRED", "UNKNOWN"] }, confidence: { type: "number", minimum: 0, maximum: 1 }
        },
        required: ["field_path", "source_page", "source_excerpt", "evidence_class", "confidence"]
      }
    },
    import_summary: { type: "string" }
  },
  required: ["primary_survey_type", "roof_type", "enabled_modules", "global_fields", "modules", "evidence", "import_summary"]
} as const;

export async function mapJobDocumentToSurvey({ businessId, jobRef, documentId }: { businessId: string; jobRef: string; documentId: string }) {
  if (!process.env.OPENAI_API_KEY) throw new Error("OpenAI API is not configured for report analysis.");
  const supabase = createSupabaseAdminClient();
  const jobResult = await supabase.from("jobs").select("id,job_ref,job_title,property_address,postcode,roof_type,job_type,customers(full_name)").eq("business_id", businessId).eq("job_ref", jobRef).maybeSingle();
  if (jobResult.error || !jobResult.data) throw new Error(jobResult.error?.message ?? "Job was not found in this workspace.");
  const documentResult = await supabase.from("job_documents").select("id,display_name,mime_type,file_size,storage_bucket,storage_path").eq("id", documentId).eq("job_id", jobResult.data.id).maybeSingle();
  if (documentResult.error || !documentResult.data) throw new Error(documentResult.error?.message ?? "Document was not found on this job.");
  const document = documentResult.data;
  if (!document.mime_type || !SUPPORTED_MIME_TYPES.has(document.mime_type)) throw new Error("Only private PDF, JPEG, PNG or WebP job documents can populate a survey.");
  if (!document.storage_bucket || !document.storage_path) throw new Error("This document does not have a private stored file.");
  if (Number(document.file_size ?? 0) > 25 * 1024 * 1024) throw new Error("The report is larger than the 25 MB analysis limit.");
  const download = await supabase.storage.from(document.storage_bucket).download(document.storage_path);
  if (download.error || !download.data) throw new Error(download.error?.message ?? "The private report could not be read.");
  const bytes = Buffer.from(await download.data.arrayBuffer());
  const fileData = `data:${document.mime_type};base64,${bytes.toString("base64")}`;
  const schema = compactSchema();
  const prompt = `Map this roofing report into the supplied live We Are Roofing survey schema.

Job context (reference only; do not invent facts):
${JSON.stringify(jobResult.data)}

Allowed schema:
${JSON.stringify(schema)}

Rules:
- Return only keys present in the allowed schema.
- Structured facts go into global_fields or the correct specialist module, never into a general notes dump merely because mapping is inconvenient.
- Omit unsupported fields. Never invent roof pitch, dimensions, elevations, product manufacturers, leaks, compliance, concealed defects or conditions.
- Keep approximate measurements as cautious text in global_fields.measurements unless the source explicitly identifies the exact structured field. Mark them APPROXIMATE.
- Do not create a voice transcript from report prose.
- Commercial prices and payment terms do not belong in technical survey fields.
- Use INFERRED only for cautious suggestions; these will not be applied automatically.
- source_excerpt must be short and must not reproduce large passages.
- One job may activate several modules.
- If the report concerns several roof areas, prefer roof_type Mixed.
- Include evidence for every populated field using the exact path global.FIELD or modules.MODULE.FIELD.`;

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const filePart = document.mime_type === "application/pdf"
    ? { type: "input_file", filename: document.display_name || "roof-report.pdf", file_data: fileData, detail: "high" }
    : { type: "input_image", image_url: fileData, detail: "high" };
  const response = await client.responses.create({
    model: "gpt-4.1",
    store: false,
    input: [{ role: "user", content: [
      filePart as any,
      { type: "input_text", text: prompt }
    ] }],
    text: { format: { type: "json_schema", name: "roof_report_survey_mapping", strict: false, schema: responseSchema as any } }
  });
  if (!response.output_text) throw new Error("The report analysis returned no structured mapping.");
  let proposal: Row;
  try { proposal = JSON.parse(response.output_text) as Row; }
  catch { throw new Error("The report analysis did not return valid structured JSON."); }
  return { proposal: { ...proposal, source_document_id: document.id, source_type: "roof_report" }, document: { id: document.id, display_name: document.display_name, mime_type: document.mime_type } };
}
