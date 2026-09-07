import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { createActivity } from "@/lib/activity/createActivity";
import { getJobBundle } from "@/lib/data";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { JobVariationRecord } from "@/lib/types";
import { updateJobValueWithVariations } from "@/lib/variations/updateJobValue";

type Props = { params: Promise<{ variationId: string }> };

export async function POST(request: Request, { params }: Props) {
  const { variationId } = await params;
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  const body = (await request.json().catch(() => ({}))) as { approved_by_name?: string; approval_method?: "verbal" | "email" | "other" };
  const supabase = createSupabaseAdminClient();
  const lookup = await supabase.from("job_variations").select("*").eq("id", variationId).single();
  if (lookup.error || !lookup.data) return NextResponse.json({ ok: false, error: "Additional work not found." }, { status: 404 });
  const variation = lookup.data as JobVariationRecord;
  let variations = [variation];
  if (variation.approval_group_id) {
    const grouped = await supabase
      .from("job_variations")
      .select("*")
      .eq("job_id", variation.job_id)
      .eq("approval_group_id", variation.approval_group_id);
    if (grouped.error || !grouped.data?.length) {
      return NextResponse.json({ ok: false, error: grouped.error?.message ?? "Combined additional-works quotation not found." }, { status: 404 });
    }
    variations = grouped.data as JobVariationRecord[];
  }
  if (variations.every((item) => ["Accepted", "Invoiced", "Paid"].includes(item.status))) {
    return NextResponse.json({ ok: true, variations, message: "Customer approval has already been recorded." });
  }
  const blocked = variations.find((item) => !["Draft", "Sent"].includes(item.status));
  if (blocked) {
    return NextResponse.json({ ok: false, error: `This additional work cannot be approved from ${blocked.status}.` }, { status: 400 });
  }
  const bundle = await getJobBundle(variation.job_id);
  const now = new Date().toISOString();
  let updateQuery = supabase
    .from("job_variations")
    .update({
      status: "Accepted",
      approval_method: body.approval_method || "verbal",
      approved_by_name: body.approved_by_name?.trim() || bundle?.customer.full_name || "Customer",
      accepted_at: now,
      updated_at: now
    })
    .in("status", ["Draft", "Sent"]);
  updateQuery = variation.approval_group_id
    ? updateQuery.eq("job_id", variation.job_id).eq("approval_group_id", variation.approval_group_id)
    : updateQuery.eq("id", variation.id);
  const update = await updateQuery.select("*");
  if (update.error) return NextResponse.json({ ok: false, error: update.error.message }, { status: 500 });
  if (update.data?.length !== variations.length) {
    return NextResponse.json({ ok: false, error: "The quotation changed while approval was being recorded. Refresh and check its status before trying again." }, { status: 409 });
  }

  await updateJobValueWithVariations(supabase, variation.job_id);

  const approvedBy = body.approved_by_name?.trim() || bundle?.customer.full_name || "customer";
  const reference = variation.approval_group_ref || variation.variation_ref;
  const isGroup = Boolean(variation.approval_group_id);
  await createActivity(supabase, {
    business_id: variation.business_id,
    job_id: variation.job_id,
    customer_id: bundle?.customer.id ?? null,
    quote_id: variation.quote_id ?? null,
    activity_type: "variation_accepted",
    message: `${reference} recorded as approved by ${approvedBy}${isGroup ? ` (${variations.length} linked items)` : ""}`,
    actor_type: "user",
    actor_id: auth.session.user?.id ?? null,
    actor_name: auth.session.user?.email ?? null,
    linked_entity_type: isGroup ? "variation_quote" : "variation",
    linked_entity_id: variation.approval_group_id || variation.id,
    details: {
      approval_method: body.approval_method || "verbal",
      variation_ids: variations.map((item) => item.id),
      total: variations.reduce((sum, item) => sum + Number(item.total ?? 0), 0)
    }
  });
  return NextResponse.json({
    ok: true,
    variations: update.data,
    message: isGroup
      ? `${reference} accepted manually. All ${variations.length} items are ready for invoicing.`
      : "Customer approval recorded."
  });
}
