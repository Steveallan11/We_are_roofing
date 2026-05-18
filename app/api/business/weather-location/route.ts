import { NextResponse } from "next/server";
import { getBusiness } from "@/lib/data";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { canPersistToSupabase } from "@/lib/workflows";

export async function PATCH(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { location?: string };
  const location = body.location?.trim();
  if (!location) return NextResponse.json({ ok: false, error: "Location is required." }, { status: 400 });

  if (!canPersistToSupabase()) return NextResponse.json({ ok: true });

  const business = await getBusiness();
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("businesses").update({ weather_location: location }).eq("id", business.id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
