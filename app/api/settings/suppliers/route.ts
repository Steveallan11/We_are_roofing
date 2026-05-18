import { NextResponse } from "next/server";
import { getBusiness } from "@/lib/data";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { canPersistToSupabase } from "@/lib/workflows";

export async function GET() {
  if (!canPersistToSupabase()) return NextResponse.json({ ok: true, suppliers: [] });
  const business = await getBusiness();
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.from("suppliers").select("*").eq("business_id", business.id).order("name", { ascending: true });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, suppliers: data ?? [] });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  if (!body.name?.trim()) {
    return NextResponse.json({ ok: false, error: "Supplier name is required." }, { status: 400 });
  }

  if (!canPersistToSupabase()) return NextResponse.json({ ok: true });

  const business = await getBusiness();
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("suppliers")
    .insert({
      business_id: business.id,
      name: body.name.trim(),
      contact_name: body.contact_name || null,
      phone: body.phone || null,
      email: body.email || null,
      website: body.website || null,
      account_ref: body.account_ref || null,
      notes: body.notes || null,
      categories: Array.isArray(body.categories) ? body.categories : String(body.categories || "").split(",").map((item) => item.trim()).filter(Boolean),
      is_preferred: Boolean(body.is_preferred)
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, supplier: data });
}

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => ({}));
  if (!body.id) return NextResponse.json({ ok: false, error: "Supplier id is required." }, { status: 400 });

  if (!canPersistToSupabase()) return NextResponse.json({ ok: true });

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("suppliers")
    .update({
      name: body.name,
      contact_name: body.contact_name || null,
      phone: body.phone || null,
      email: body.email || null,
      website: body.website || null,
      account_ref: body.account_ref || null,
      notes: body.notes || null,
      categories: Array.isArray(body.categories) ? body.categories : String(body.categories || "").split(",").map((item) => item.trim()).filter(Boolean),
      is_preferred: Boolean(body.is_preferred)
    })
    .eq("id", body.id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, supplier: data });
}
