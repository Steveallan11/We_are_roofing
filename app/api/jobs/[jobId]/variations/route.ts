import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { createActivity } from "@/lib/activity/createActivity";
import { getJobBundle } from "@/lib/data";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { calculateVariationTotals, normaliseVariationLineItems } from "@/lib/variations/value";
import { updateJobValueWithVariations } from "@/lib/variations/updateJobValue";
import { canPersistToSupabase } from "@/lib/workflows";

type Props = { params: Promise<{ jobId: string }> };

export async function POST(request: Request, { params }: Props) {
  const { jobId } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    title?: string;
    description?: string;
    line_items?: unknown;
    approval_mode?: "formal" | "verbal";
    approved_by_name?: string;
  };

  const title = body.title?.trim();
  const lineItems = normaliseVariationLineItems(body.line_items);
  if (!title) return NextResponse.json({ ok: false, error: "Enter a title for the additional work." }, { status: 400 });
  if (!lineItems.length) return NextResponse.json({ ok: false, error: "Add at least one priced line item." }, { status: 400 });

  const { subtotal, vatAmount, total } = calculateVariationTotals(lineItems);
  if (total <= 0) return NextResponse.json({ ok: false, error: "The additional work total must be greater than zero." }, { status: 400 });

  if (!canPersistToSupabase()) {
    return NextResponse.json({ ok: true, message: "Additional work preview created." });
  }

  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  const bundle = await getJobBundle(jobId);
  if (!bundle) return NextResponse.json({ ok: false, error: "Job not found." }, { status: 404 });

  const id = randomUUID();
  const isVerbal = body.approval_mode === "verbal";
  const variationRef = buildVariationRef(bundle.job.job_ref, id);
  const now = new Date().toISOString();
  const supabase = createSupabaseAdminClient();
  const insert = await supabase
    .from("job_variations")
    .insert({
      id,
      business_id: bundle.business.id,
      job_id: jobId,
      quote_id: bundle.quote?.id ?? null,
      variation_ref: variationRef,
      title,
      description: body.description?.trim() ?? "",
      line_items: lineItems,
      subtotal,
      vat_amount: vatAmount,
      total,
      approval_required: !isVerbal,
      approval_method: isVerbal ? "verbal" : null,
      status: isVerbal ? "Accepted" : "Draft",
      approved_by_name: isVerbal ? body.approved_by_name?.trim() || bundle.customer.full_name : null,
      accepted_at: isVerbal ? now : null,
      updated_at: now
    })
    .select("*")
    .single();

  if (insert.error || !insert.data) {
    return NextResponse.json({ ok: false, error: insert.error?.message ?? "Additional work could not be saved." }, { status: 500 });
  }

  if (isVerbal) await updateJobValueWithVariations(supabase, jobId);

  await createActivity(supabase, {
    business_id: bundle.business.id,
    job_id: jobId,
    customer_id: bundle.customer.id,
    quote_id: bundle.quote?.id ?? null,
    activity_type: "variation_created",
    message: `${variationRef} created for £${total.toFixed(2)}${isVerbal ? " and recorded as verbally approved" : ""}`,
    actor_type: "user",
    actor_id: auth.session.user?.id ?? null,
    actor_name: auth.session.user?.email ?? null,
    linked_entity_type: "variation",
    linked_entity_id: id,
    details: { variation_ref: variationRef, subtotal, vat_amount: vatAmount, total, approval_mode: body.approval_mode ?? "formal" }
  });

  return NextResponse.json({ ok: true, variation: insert.data, message: `${variationRef} saved.` });
}

function buildVariationRef(jobRef: string | null | undefined, id: string) {
  const base = (jobRef || "WR").replace(/[^a-z0-9-]/gi, "").toUpperCase();
  return `${base}-V-${id.slice(0, 5).toUpperCase()}`;
}
