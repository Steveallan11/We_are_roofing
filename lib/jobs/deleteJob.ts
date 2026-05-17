import { JOB_DOCUMENTS_BUCKET, SURVEY_IMAGES_BUCKET } from "@/lib/storage";
import type { createSupabaseAdminClient } from "@/lib/supabase/admin";

type SupabaseAdmin = ReturnType<typeof createSupabaseAdminClient>;

type DeleteJobResult =
  | {
      ok: true;
      message: string;
    }
  | {
      ok: false;
      status: number;
      error: string;
    };

export async function deleteJobWithCleanup(supabase: SupabaseAdmin, jobId: string, confirmation: string): Promise<DeleteJobResult> {
  const { data: job, error: jobError } = await supabase.from("jobs").select("id, job_ref, job_title").eq("id", jobId).single();

  if (jobError || !job) {
    return { ok: false, status: 404, error: jobError?.message ?? "Job not found." };
  }

  const expected = String(job.job_ref || job.job_title || "DELETE").trim();
  if (confirmation.trim() !== expected && confirmation.trim().toUpperCase() !== "DELETE") {
    return { ok: false, status: 400, error: `Type ${expected} to confirm deletion.` };
  }

  const [photoResult, documentResult, roofSurveyResult, quoteResult, invoiceResult] = await Promise.all([
    supabase.from("job_photos").select("storage_path").eq("job_id", jobId),
    supabase.from("job_documents").select("id, storage_bucket, storage_path").eq("job_id", jobId),
    supabase.from("roof_surveys").select("id, satellite_image_path").eq("job_id", jobId),
    supabase.from("quotes").select("id").eq("job_id", jobId),
    supabase.from("invoices").select("id").eq("job_id", jobId)
  ]);

  const quoteIds = ((quoteResult.data as Array<{ id: string }> | null) ?? []).map((item) => item.id);
  const invoiceIds = ((invoiceResult.data as Array<{ id: string }> | null) ?? []).map((item) => item.id);
  const documentIds = ((documentResult.data as Array<{ id: string }> | null) ?? []).map((item) => item.id);
  const roofSurveyIds = ((roofSurveyResult.data as Array<{ id: string }> | null) ?? []).map((item) => item.id);

  const photoPaths = ((photoResult.data as Array<{ storage_path?: string | null }> | null) ?? [])
    .map((item) => item.storage_path)
    .filter((path): path is string => Boolean(path));
  const documentPaths = ((documentResult.data as Array<{ storage_bucket?: string | null; storage_path?: string | null }> | null) ?? [])
    .filter((item) => item.storage_bucket === JOB_DOCUMENTS_BUCKET && item.storage_path)
    .map((item) => item.storage_path as string);
  const surveyImagePaths = ((roofSurveyResult.data as Array<{ satellite_image_path?: string | null }> | null) ?? [])
    .map((item) => item.satellite_image_path)
    .filter((path): path is string => Boolean(path));

  await Promise.allSettled([
    photoPaths.length > 0 ? supabase.storage.from("job-photos").remove(photoPaths) : Promise.resolve(),
    documentPaths.length > 0 ? supabase.storage.from(JOB_DOCUMENTS_BUCKET).remove(documentPaths) : Promise.resolve(),
    surveyImagePaths.length > 0 ? supabase.storage.from(SURVEY_IMAGES_BUCKET).remove(surveyImagePaths) : Promise.resolve()
  ]);

  // Explicitly remove child records first so old schemas with imperfect cascades do not block test-job deletion.
  await Promise.allSettled([
    quoteIds.length > 0 ? supabase.from("quote_attachments").delete().in("quote_id", quoteIds) : Promise.resolve(),
    documentIds.length > 0 ? supabase.from("quote_attachments").delete().in("job_document_id", documentIds) : Promise.resolve(),
    invoiceIds.length > 0 ? supabase.from("invoice_payments").delete().in("invoice_id", invoiceIds) : Promise.resolve(),
    roofSurveyIds.length > 0 ? supabase.from("roof_survey_sections").delete().in("survey_id", roofSurveyIds) : Promise.resolve(),
    roofSurveyIds.length > 0 ? supabase.from("roof_survey_lines").delete().in("survey_id", roofSurveyIds) : Promise.resolve(),
    roofSurveyIds.length > 0 ? supabase.from("roof_survey_features").delete().in("survey_id", roofSurveyIds) : Promise.resolve()
  ]);

  await Promise.allSettled([
    supabase.from("materials").delete().eq("job_id", jobId),
    supabase.from("email_logs").delete().eq("job_id", jobId),
    supabase.from("job_documents").delete().eq("job_id", jobId),
    supabase.from("job_photos").delete().eq("job_id", jobId),
    supabase.from("surveys").delete().eq("job_id", jobId),
    supabase.from("roof_surveys").delete().eq("job_id", jobId),
    supabase.from("invoices").delete().eq("job_id", jobId),
    supabase.from("quotes").delete().eq("job_id", jobId)
  ]);

  const { error } = await supabase.from("jobs").delete().eq("id", jobId);
  if (error) {
    return { ok: false, status: 500, error: error.message };
  }

  return {
    ok: true,
    message: `${job.job_ref ?? "Job"} deleted.`
  };
}
