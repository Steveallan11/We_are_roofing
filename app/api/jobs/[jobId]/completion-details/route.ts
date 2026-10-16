import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { canPersistToSupabase } from "@/lib/workflows";

type Props = { params: Promise<{ jobId: string }> };

export async function PATCH(request: Request, { params }: Props) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  const { jobId } = await params;
  const body = (await request.json().catch(() => ({}))) as { works_summary?: string; installed_system?: string; product_details?: string; warranty_years?: number; warranty_details?: string; warranty_conditions?: string; warranty_claim_process?: string; included_variation_ids?: string[] };
  const worksSummary = String(body.works_summary ?? "").trim();
  const installedSystem = String(body.installed_system ?? "").trim();
  const productDetails = String(body.product_details ?? "").trim();
  const warrantyDetails = String(body.warranty_details ?? "").trim();
  const warrantyConditions = String(body.warranty_conditions ?? "").trim();
  const warrantyClaimProcess = String(body.warranty_claim_process ?? "").trim();
  const warrantyYears = Number(body.warranty_years ?? 15);
  const variationIds = [...new Set((body.included_variation_ids ?? []).filter((id): id is string => typeof id === "string"))];
  if (!worksSummary) return NextResponse.json({ ok: false, error: "Enter the work completed for the certificate." }, { status: 400 });
  if (worksSummary.length > 12000) return NextResponse.json({ ok: false, error: "The completion scope must be 12,000 characters or fewer." }, { status: 400 });
  if (installedSystem.length > 2000 || productDetails.length > 6000) return NextResponse.json({ ok: false, error: "System details must be 2,000 characters or fewer and product details 6,000 characters or fewer." }, { status: 400 });
  if (warrantyDetails.length > 6000) return NextResponse.json({ ok: false, error: "Warranty details must be 6,000 characters or fewer." }, { status: 400 });
  if (warrantyConditions.length > 6000 || warrantyClaimProcess.length > 3000) return NextResponse.json({ ok: false, error: "Warranty conditions must be 6,000 characters or fewer and claim instructions 3,000 characters or fewer." }, { status: 400 });
  if (![5, 10, 15, 20, 25].includes(warrantyYears)) return NextResponse.json({ ok: false, error: "Choose a 5, 10, 15, 20 or 25 year warranty." }, { status: 400 });
  if (!canPersistToSupabase()) return NextResponse.json({ ok: true, message: "Completion details preview saved." });

  const supabase = createSupabaseAdminClient();
  const { data: job, error: jobError } = await supabase.from("jobs").select("id,business_id").eq("id", jobId).maybeSingle();
  if (jobError || !job) return NextResponse.json({ ok: false, error: "Job not found." }, { status: 404 });

  if (variationIds.length) {
    const { data: variations, error } = await supabase.from("job_variations").select("id,status").eq("job_id", jobId).in("id", variationIds);
    if (error) return NextResponse.json({ ok: false, error: "Additional work could not be validated." }, { status: 500 });
    const approvedIds = new Set((variations ?? []).filter((item) => ["Accepted", "Invoiced", "Paid"].includes(item.status)).map((item) => item.id));
    if (variationIds.some((id) => !approvedIds.has(id))) return NextResponse.json({ ok: false, error: "Only customer-approved additional work can appear on the completion certificate." }, { status: 400 });
  }

  const { error } = await supabase.from("job_completion_details").upsert({
    job_id: jobId,
    business_id: job.business_id,
    works_summary: worksSummary,
    installed_system: installedSystem || null,
    product_details: productDetails || null,
    warranty_years: warrantyYears,
    warranty_details: warrantyDetails || null,
    warranty_conditions: warrantyConditions || null,
    warranty_claim_process: warrantyClaimProcess || null,
    included_variation_ids: variationIds,
    updated_by: auth.session.user?.id ?? null,
    updated_at: new Date().toISOString()
  }, { onConflict: "job_id" });
  if (error) return NextResponse.json({ ok: false, error: "Completion details could not be saved." }, { status: 500 });
  return NextResponse.json({ ok: true, message: "Completion scope and additional-work selections saved." });
}
