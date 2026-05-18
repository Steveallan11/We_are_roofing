import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { canPersistToSupabase } from "@/lib/workflows";

type Props = {
  params: Promise<{ materialId: string }>;
};

export async function PATCH(request: Request, { params }: Props) {
  const { materialId } = await params;
  const body = await request.json().catch(() => ({}));

  if (!canPersistToSupabase()) return NextResponse.json({ ok: true });

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
  return NextResponse.json({ ok: true, material: data });
}

export async function DELETE(_request: Request, { params }: Props) {
  const { materialId } = await params;
  if (!canPersistToSupabase()) return NextResponse.json({ ok: true });

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("materials").delete().eq("id", materialId);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
