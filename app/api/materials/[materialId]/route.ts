import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { learnPricingFromMaterial } from "@/lib/pricing/learning";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { canPersistToSupabase } from "@/lib/workflows";

type Props = {
  params: Promise<{ materialId: string }>;
};

export async function PATCH(request: Request, { params }: Props) {
  const { materialId } = await params;
  const body = await request.json().catch(() => ({}));

  if (!canPersistToSupabase()) return NextResponse.json({ ok: true });

  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const quantity = body.quantity == null ? undefined : Number(body.quantity || 0);
  const unitCost = body.unit_cost == null ? undefined : Number(body.unit_cost || 0);
  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString()
  };
  for (const key of ["item_name", "category", "unit", "required_status", "notes", "supplier", "estimated_price", "actual_price", "margin_pct"]) {
    if (body[key] !== undefined) payload[key] = body[key];
  }
  if (quantity !== undefined) payload.quantity = quantity;
  if (unitCost !== undefined) payload.unit_cost = unitCost;
  if (quantity !== undefined || unitCost !== undefined) {
    payload.total_cost = (quantity ?? Number(body.current_quantity || 0)) * (unitCost ?? Number(body.current_unit_cost || 0));
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.from("materials").update(payload).eq("id", materialId).select("*").single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  if (data?.unit_cost) {
    const { data: job } = await supabase.from("jobs").select("business_id").eq("id", data.job_id).maybeSingle();
    if (job?.business_id) {
      await learnPricingFromMaterial({
        supabase,
        businessId: String(job.business_id),
        jobId: data.job_id,
        materialId: data.id,
        itemName: data.item_name,
        category: data.category,
        quantity: data.quantity,
        unit: data.unit,
        unitCost: data.unit_cost,
        totalCost: data.total_cost
      });
    }
  }
  return NextResponse.json({ ok: true, material: data });
}

export async function DELETE(_request: Request, { params }: Props) {
  const { materialId } = await params;
  if (!canPersistToSupabase()) return NextResponse.json({ ok: true });

  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("materials").delete().eq("id", materialId);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
