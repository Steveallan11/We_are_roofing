import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { NurtureTemplate } from "@/lib/types";

export async function GET() {
  try {
    const supabase = createSupabaseAdminClient();

    // Get business ID (first business for the user)
    const { data: businesses } = await supabase.from("businesses").select("id").limit(1);
    const businessId = businesses?.[0]?.id;

    if (!businessId) {
      return Response.json({ error: "No business found" }, { status: 404 });
    }

    const { data: templates, error } = await supabase
      .from("nurture_templates")
      .select("*")
      .eq("business_id", businessId)
      .order("day_number", { ascending: true });

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ templates: templates as NurtureTemplate[] });
  } catch (error) {
    console.error("Error fetching nurture templates:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      templateId?: string;
      subject?: string;
      body?: string;
      is_active?: boolean;
    };

    const { templateId, subject, body, is_active } = body;

    if (!templateId) {
      return Response.json({ error: "Missing templateId" }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (subject !== undefined) updates.subject = subject;
    if (body !== undefined) updates.body = body;
    if (is_active !== undefined) updates.is_active = is_active;

    const { data: template, error } = await supabase
      .from("nurture_templates")
      .update(updates)
      .eq("id", templateId)
      .select("*")
      .single();

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ template: template as NurtureTemplate });
  } catch (error) {
    console.error("Error updating nurture template:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
