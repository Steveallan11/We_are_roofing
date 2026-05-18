import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { canPersistToSupabase } from "@/lib/workflows";

type Props = {
  params: Promise<{ jobId: string }>;
};

export async function POST(request: Request, { params }: Props) {
  const { jobId } = await params;
  const body = await request.json().catch(() => ({}));

  if (!canPersistToSupabase()) return NextResponse.json({ ok: true });

  const supabase = createSupabaseAdminClient();
  const quantity = Number(body.quantity || 1);
  const unitCost = body.unit_cost == null ? null : Number(body.unit_cost || 0);
  const { data, error } = await supabase
    .from("materials")
    .insert({
      job_id: jobId,
      quote_id: body.quote_id || null,
      item_name: body.item_name || "New material",
      category: body.category || "General",
      quantity,
      unit: body.unit || "item",
      required_status: body.required_status || "Check On Site",
      notes: body.notes || "",
      supplier: body.supplier || null,
      estimated_price: body.estimated_price == null ? null : Number(body.estimated_price || 0),
      unit_cost: unitCost,
      total_cost: unitCost == null ? null : quantity * unitCost
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, material: data });
}
