import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createRoofSurvey, getLatestRoofSurvey } from "@/lib/roof-surveys";
import { canPersistToSupabase } from "@/lib/workflows";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const jobId = url.searchParams.get("jobId");
  if (!jobId) {
    return NextResponse.json({ ok: false, error: "jobId is required." }, { status: 400 });
  }

  const survey = await getLatestRoofSurvey(jobId);
  return NextResponse.json({ ok: true, survey });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { job_id?: string; project_name?: string };
  if (!body.job_id) {
    return NextResponse.json({ ok: false, error: "job_id is required." }, { status: 400 });
  }

  if (!canPersistToSupabase()) {
    return NextResponse.json({
      ok: true,
      survey: {
        id: "draft-roof-survey",
        job_id: body.job_id,
        project_name: body.project_name ?? "New Roof Survey"
      }
    });
  }

  const supabase = createSupabaseAdminClient();
  const { data: job } = await supabase.from("jobs").select("job_title").eq("id", body.job_id).single();
  const survey = await createRoofSurvey(body.job_id, body.project_name ?? job?.job_title ?? "New Roof Survey");
  return NextResponse.json({ ok: true, survey });
}
