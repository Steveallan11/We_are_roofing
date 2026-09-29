import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { executeSurveyTool } from "@/lib/surveys/service";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Props = { params: Promise<{ jobId: string }> };

async function contextForJob(jobId: string, actorId: string) {
  const { data: job, error } = await createSupabaseAdminClient().from("jobs").select("job_ref,business_id").eq("id", jobId).maybeSingle();
  if (error || !job) throw new Error(error?.message ?? "Job not found.");
  return { jobRef: job.job_ref as string, routeContext: { pathname: `/api/jobs/${jobId}/survey/import`, businessId: job.business_id as string, actorId } };
}

export async function POST(request: Request, { params }: Props) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  try {
    const { jobId } = await params;
    const { jobRef, routeContext } = await contextForJob(jobId, auth.session.user.id);
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const result = await executeSurveyTool("preview_survey_update", { ...body, job_ref: jobRef }, routeContext);
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Survey import preview failed." }, { status: 400 });
  }
}

export async function PATCH(request: Request, { params }: Props) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  try {
    const { jobId } = await params;
    const { jobRef, routeContext } = await contextForJob(jobId, auth.session.user.id);
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const result = await executeSurveyTool("update_survey", { ...body, job_ref: jobRef }, routeContext);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Survey import could not be applied." }, { status: 400 });
  }
}
