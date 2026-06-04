import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getBusiness } from "@/lib/data";

export async function PATCH(request: Request) {
  try {
    const business = await getBusiness();
    const body = await request.json();

    const supabase = createSupabaseAdminClient();
    const { error } = await supabase
      .from("businesses")
      .update({
        guarantee_text: body.guarantee_text,
        default_exclusions: body.default_exclusions,
        default_terms: body.default_terms
      })
      .eq("id", business.id);

    if (error) {
      console.error("Error updating business settings:", error);
      return Response.json({ ok: false, error: error.message }, { status: 400 });
    }

    return Response.json({ ok: true, message: "Settings updated" });
  } catch (err) {
    console.error("Business settings API error:", err);
    return Response.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
