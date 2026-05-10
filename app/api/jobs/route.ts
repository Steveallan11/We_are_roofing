import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("jobs")
      .select("*, customers:customer_id(*), quotes(*)")
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    const jobs = (data ?? []).map((j: any) => ({
      ...j,
      customer: j.customers || null,
      quote: j.quotes?.[0] || null,
    }));

    return NextResponse.json({ ok: true, data: jobs });
  } catch (err) {
    console.error("Error fetching jobs:", err);
    return NextResponse.json({ ok: false, error: "Failed to fetch jobs" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, status, ...rest } = body;
    if (!id) return NextResponse.json({ ok: false, error: "id is required" }, { status: 400 });

    const supabase = createSupabaseAdminClient();
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (status) updates.status = status;
    Object.assign(updates, rest);

    const { data, error } = await supabase
      .from("jobs")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, job: data });
  } catch (err) {
    console.error("Error updating job:", err);
    return NextResponse.json({ ok: false, error: "Failed to update job" }, { status: 500 });
  }
}
