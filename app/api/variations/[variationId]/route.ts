import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { createActivity } from "@/lib/activity/createActivity";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { JobVariationRecord } from "@/lib/types";
import { updateJobValueWithVariations } from "@/lib/variations/updateJobValue";
import { canPersistToSupabase } from "@/lib/workflows";

type Props = { params: Promise<{ variationId: string }> };

export async function DELETE(request: Request, { params }: Props) {
  const { variationId } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    confirmation?: string;
    delete_group?: boolean;
  };

  if (!canPersistToSupabase()) {
    return NextResponse.json({ ok: true, message: "Additional work delete preview completed." });
  }

  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const supabase = createSupabaseAdminClient();
  const lookup = await supabase.from("job_variations").select("*").eq("id", variationId).single();
  if (lookup.error || !lookup.data) {
    return NextResponse.json({ ok: false, error: lookup.error?.message ?? "Additional work not found." }, { status: 404 });
  }

  const anchor = lookup.data as JobVariationRecord;
  let variations = [anchor];
  if (anchor.approval_group_id) {
    if (!body.delete_group) {
      return NextResponse.json(
        { ok: false, error: "This item belongs to a combined quotation. Delete the complete combined quotation instead." },
        { status: 400 }
      );
    }
    const grouped = await supabase
      .from("job_variations")
      .select("*")
      .eq("job_id", anchor.job_id)
      .eq("approval_group_id", anchor.approval_group_id);
    if (grouped.error || !grouped.data?.length) {
      return NextResponse.json({ ok: false, error: grouped.error?.message ?? "Combined quotation not found." }, { status: 404 });
    }
    variations = grouped.data as JobVariationRecord[];
  }

  const reference = anchor.approval_group_id
    ? anchor.approval_group_ref || anchor.variation_ref
    : anchor.variation_ref;
  if (body.confirmation?.trim() !== reference) {
    return NextResponse.json({ ok: false, error: `Type ${reference} to confirm deletion.` }, { status: 400 });
  }

  if (variations.some((variation) => ["Invoiced", "Paid"].includes(variation.status))) {
    return NextResponse.json(
      { ok: false, error: "Invoiced or paid additional work cannot be deleted. Keep it on the job record for the financial audit trail." },
      { status: 400 }
    );
  }

  const variationIds = variations.map((variation) => variation.id);
  const invoiceCheck = await supabase.from("invoices").select("invoice_ref").in("variation_id", variationIds).limit(1);
  if (invoiceCheck.error) {
    return NextResponse.json({ ok: false, error: invoiceCheck.error.message }, { status: 500 });
  }
  if (invoiceCheck.data?.length) {
    return NextResponse.json(
      { ok: false, error: `Delete or resolve linked invoice ${invoiceCheck.data[0].invoice_ref} before deleting this additional work.` },
      { status: 400 }
    );
  }

  const isGroup = variations.length > 1 || Boolean(anchor.approval_group_id);
  const deleted = await supabase.from("job_variations").delete().in("id", variationIds);
  if (deleted.error) {
    return NextResponse.json({ ok: false, error: deleted.error.message }, { status: 500 });
  }

  await createActivity(supabase, {
    business_id: anchor.business_id,
    job_id: anchor.job_id,
    quote_id: anchor.quote_id ?? null,
    activity_type: "variation_deleted",
    message: `${isGroup ? "Combined additional-works quotation" : "Additional work"} ${reference} deleted`,
    actor_type: "user",
    actor_id: auth.session.user?.id ?? null,
    actor_name: auth.session.user?.email ?? null,
    linked_entity_type: isGroup ? "variation_quote" : "variation",
    linked_entity_id: anchor.approval_group_id || anchor.id,
    details: {
      reference,
      variation_ids: variationIds,
      statuses: variations.map((variation) => variation.status),
      total: variations.reduce((sum, variation) => sum + Number(variation.total ?? 0), 0),
      deleted: true
    }
  });

  await updateJobValueWithVariations(supabase, anchor.job_id);
  return NextResponse.json({
    ok: true,
    message: isGroup
      ? `${reference} and its ${variations.length} additional-work items were deleted.`
      : `${reference} was deleted.`
  });
}
