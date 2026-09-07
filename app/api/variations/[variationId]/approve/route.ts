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
  if (variation.approval_group_id) {
    return NextResponse.json({ ok: false, error: `This item belongs to combined quote ${variation.approval_group_ref || ""} and cannot be approved separately.` }, { status: 400 });
  }
  if (["Invoiced", "Paid", "Void", "Declined"].includes(variation.status)) {
    return NextResponse.json({ ok: false, error: `This additional work cannot be approved from ${variation.status}.` }, { status: 400 });
  }
  const bundle = await getJobBundle(variation.job_id);
  const now = new Date().toISOString();
  const update = await supabase
    .from("job_variations")
    .update({
      status: "Accepted",
      approval_method: body.approval_method || "verbal",
      approved_by_name: body.approved_by_name?.trim() || bundle?.customer.full_name || "Customer",
      accepted_at: now,
      updated_at: now
    })
    .eq("id", variation.id)
    .select("*")
    .single();
  if (update.error) return NextResponse.json({ ok: false, error: update.error.message }, { status: 500 });

  await updateJobValueWithVariations(supabase, variation.job_id);

  await createActivity(supabase, {
    business_id: variation.business_id,
    job_id: variation.job_id,
    customer_id: bundle?.customer.id ?? null,
    quote_id: variation.quote_id ?? null,
    activity_type: "variation_accepted",
    message: `${variation.variation_ref} recorded as approved by ${body.approved_by_name?.trim() || bundle?.customer.full_name || "customer"}`,
    actor_type: "user",
    actor_id: auth.session.user?.id ?? null,
    actor_name: auth.session.user?.email ?? null,
    linked_entity_type: "variation",
    linked_entity_id: variation.id,
    details: { approval_method: body.approval_method || "verbal", total: variation.total }
  });
  return NextResponse.json({ ok: true, variation: update.data, message: "Customer approval recorded." });
}
