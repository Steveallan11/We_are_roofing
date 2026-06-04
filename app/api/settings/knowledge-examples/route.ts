import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getBusiness } from "@/lib/data";

export async function POST(request: Request) {
  try {
    const business = await getBusiness();
    const body = await request.json();

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("knowledge_examples")
      .insert({
        business_id: business.id,
        example_type: body.example_type,
        roof_type: body.roof_type || null,
        job_type: body.job_type || null,
        title: body.title,
        content: body.content,
        quality_score: body.quality_score || 3,
        uses_count: 0
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating knowledge example:", error);
      return Response.json({ ok: false, error: error.message }, { status: 400 });
    }

    return Response.json({ ok: true, example: data });
  } catch (err) {
    console.error("Knowledge example API error:", err);
    return Response.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return Response.json({ ok: false, error: "Example ID required" }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const { error } = await supabase
      .from("knowledge_examples")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting example:", error);
      return Response.json({ ok: false, error: error.message }, { status: 400 });
    }

    return Response.json({ ok: true });
  } catch (err) {
    console.error("Knowledge example delete API error:", err);
    return Response.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
