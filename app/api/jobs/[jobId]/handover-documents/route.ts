import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { getJobBundle } from "@/lib/data";
import { persistHandoverDocuments } from "@/lib/job-handover-engine";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { canPersistToSupabase } from "@/lib/workflows";

type Props = { params: Promise<{ jobId: string }> };

export async function POST(request: Request, { params }: Props) {
  const { jobId } = await params;
  const body = (await request.json().catch(() => ({}))) as { warranty_years?: number };
  const warrantyYears = Number(body.warranty_years ?? 15);
  if (![5, 10, 15, 20, 25].includes(warrantyYears)) return NextResponse.json({ ok: false, error: "Choose a 5, 10, 15, 20 or 25 year warranty." }, { status: 400 });
  if (!canPersistToSupabase()) return NextResponse.json({ ok: true, message: "Handover document preview completed.", documents: [] });
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  const bundle = await getJobBundle(jobId);
  if (!bundle) return NextResponse.json({ ok: false, error: "Job not found." }, { status: 404 });
  try {
    const documents = await persistHandoverDocuments(createSupabaseAdminClient(), bundle, { warrantyYears });
    return NextResponse.json({ ok: true, message: "Job completion sheet and workmanship warranty created and filed.", documents });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Documents could not be generated." }, { status: 500 });
  }
}
