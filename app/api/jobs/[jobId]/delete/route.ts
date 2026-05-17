import { NextResponse } from "next/server";
import { deleteJobWithCleanup } from "@/lib/jobs/deleteJob";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { canPersistToSupabase } from "@/lib/workflows";

type Props = {
  params: Promise<{ jobId: string }>;
};

export async function POST(request: Request, { params }: Props) {
  const { jobId } = await params;
  const body = (await request.json().catch(() => ({}))) as { confirmation?: string };

  if (!body.confirmation) {
    return NextResponse.json({ ok: false, error: "confirmation is required." }, { status: 400 });
  }

  if (!canPersistToSupabase()) {
    return NextResponse.json({ ok: true, message: "Job deleted in preview mode." });
  }

  const result = await deleteJobWithCleanup(createSupabaseAdminClient(), jobId, body.confirmation);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true, message: result.message });
}
