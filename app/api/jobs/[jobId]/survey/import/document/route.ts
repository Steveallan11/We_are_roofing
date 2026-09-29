import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { executeSurveyTool } from "@/lib/surveys/service";
import { mapJobDocumentToSurvey } from "@/lib/surveys/documentImport";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Props = { params: Promise<{ jobId: string }> };

export const maxDuration = 120;

export async function POST(request: Request, { params }: Props) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  try {
    const { jobId } = await params;
    const body = (await request.json().catch(() => ({}))) as { document_id?: string };
    if (!body.document_id) return NextResponse.json({ ok: false, error: "document_id is required." }, { status: 400 });
    const { data: job, error } = await createSupabaseAdminClient().from("jobs").select("job_ref,business_id").eq("id", jobId).maybeSingle();
    if (error || !job) return NextResponse.json({ ok: false, error: error?.message ?? "Job not found." }, { status: 404 });
    const mapped = await mapJobDocumentToSurvey({ businessId: job.business_id, jobRef: job.job_ref, documentId: body.document_id });
    const preview = await executeSurveyTool("preview_survey_update", { ...mapped.proposal, job_ref: job.job_ref }, { pathname: `/api/jobs/${jobId}/survey/import/document`, businessId: job.business_id, actorId: auth.session.user.id });
    return NextResponse.json({ ...preview, data: { ...(preview.data as Record<string, unknown>), proposal: mapped.proposal, document: mapped.document } }, { status: preview.ok ? 200 : 422 });
  } catch (error) {
    console.error("Structured survey document preview failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "The roof report could not be mapped into the survey." }, { status: 400 });
  }
}
