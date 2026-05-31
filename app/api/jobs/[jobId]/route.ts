import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { canPersistToSupabase } from "@/lib/workflows";

type Props = {
  params: Promise<{ jobId: string }>;
};

export async function PATCH(request: Request, { params }: Props) {
  const { jobId } = await params;
  const body = (await request.json().catch(() => ({}))) as { job_title?: unknown };
  const jobTitle = String(body.job_title || "").trim();

  if (!jobTitle) {
    return NextResponse.json({ ok: false, error: "Job title is required." }, { status: 400 });
  }

  if (jobTitle.length > 160) {
    return NextResponse.json({ ok: false, error: "Job title must be 160 characters or fewer." }, { status: 400 });
  }

  if (!canPersistToSupabase()) {
    return NextResponse.json({ ok: true, message: "Job title updated in preview mode." });
  }

  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("jobs")
    .update({
      job_title: jobTitle,
      updated_at: new Date().toISOString()
    })
    .eq("id", jobId)
    .select("*")
    .single();

  if (error || !data) {
    return NextResponse.json({ ok: false, error: error?.message ?? "Unable to update job title." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    message: "Job title updated.",
    job: data
  });
}
