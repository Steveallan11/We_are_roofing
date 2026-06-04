import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getBusiness } from "@/lib/data";

export async function POST(request: Request) {
  try {
    const business = await getBusiness();
    const body = await request.json();

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("quote_templates")
      .insert({
        business_id: business.id,
        roof_type: body.roof_type,
        job_type: body.job_type || null,
        template_name: body.template_name,
        roof_report_template: body.roof_report_template || null,
        scope_of_works_template: body.scope_of_works_template || null,
        guarantee_override: body.guarantee_override || null,
        exclusions_override: body.exclusions_override || null,
        terms_override: body.terms_override || null
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating template:", error);
      return Response.json({ ok: false, error: error.message }, { status: 400 });
    }

    return Response.json({ ok: true, template: data });
  } catch (err) {
    console.error("Quote template API error:", err);
    return Response.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return Response.json({ ok: false, error: "Template ID required" }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const { error } = await supabase
      .from("quote_templates")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting template:", error);
      return Response.json({ ok: false, error: error.message }, { status: 400 });
    }

    return Response.json({ ok: true });
  } catch (err) {
    console.error("Quote template delete API error:", err);
    return Response.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
