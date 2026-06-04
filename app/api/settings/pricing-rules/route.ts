import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getBusiness } from "@/lib/data";

export async function GET() {
  try {
    const business = await getBusiness();
    const supabase = createSupabaseAdminClient();

    const { data, error } = await supabase
      .from("pricing_rules")
      .select("*")
      .eq("business_id", business.id)
      .order("item_category");

    if (error) {
      console.error("Error fetching pricing rules:", error);
      return Response.json({ ok: false, error: error.message }, { status: 400 });
    }

    return Response.json({ ok: true, rules: data });
  } catch (err) {
    console.error("Pricing rule GET API error:", err);
    return Response.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const business = await getBusiness();
    const body = await request.json();

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("pricing_rules")
      .insert({
        business_id: business.id,
        item_category: body.item_category,
        roof_type: body.roof_type || null,
        job_type: body.job_type || null,
        minimum_price: body.minimum_price || null,
        maximum_price: body.maximum_price || null,
        unit_type: body.unit_type || "total",
        notes: body.notes || null,
        active: body.active !== false
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating pricing rule:", error);
      return Response.json({ ok: false, error: error.message }, { status: 400 });
    }

    return Response.json({ ok: true, rule: data });
  } catch (err) {
    console.error("Pricing rule API error:", err);
    return Response.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return Response.json({ ok: false, error: "Rule ID required" }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const { error } = await supabase
      .from("pricing_rules")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting rule:", error);
      return Response.json({ ok: false, error: error.message }, { status: 400 });
    }

    return Response.json({ ok: true });
  } catch (err) {
    console.error("Pricing rule delete API error:", err);
    return Response.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
