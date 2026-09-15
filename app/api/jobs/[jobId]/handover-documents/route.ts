import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { getJobBundle } from "@/lib/data";
import { persistHandoverDocuments } from "@/lib/job-handover-engine";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { canPersistToSupabase } from "@/lib/workflows";

type Props = { params: Promise<{ jobId: string }> };

export async function POST(_request: Request, { params }: Props) {
  const { jobId } = await params;
  if (!canPersistToSupabase()) return NextResponse.json({ ok: true, message: "Handover document preview completed.", documents: [] });
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  const bundle = await getJobBundle(jobId);
  if (!bundle) return NextResponse.json({ ok: false, error: "Job not found." }, { status: 404 });
  try {
    const documents = await persistHandoverDocuments(createSupabaseAdminClient(), bundle);
    return NextResponse.json({ ok: true, message: "Job completion sheet and workmanship warranty created and filed.", documents });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Documents could not be generated." }, { status: 500 });
  }
}
