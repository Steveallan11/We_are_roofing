import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { canPersistToSupabase } from "@/lib/workflows";

export async function GET() {
  if (!canPersistToSupabase()) return NextResponse.json({ ok: true, notes: [] });

  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("sticky_notes")
    .select("*")
    .eq("is_archived", false)
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, notes: data ?? [] });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    content?: string;
    color?: string;
    position_x?: number;
    position_y?: number;
    width?: number;
    height?: number;
    linked_job_id?: string | null;
  };

  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  if (!canPersistToSupabase()) {
    return NextResponse.json({
      ok: true,
      note: {
        id: `note-${Date.now()}`,
        content: body.content ?? "",
        color: body.color ?? "#fde68a",
        position_x: body.position_x ?? 20,
        position_y: body.position_y ?? 20,
        width: body.width ?? 220,
        height: body.height ?? 220,
        z_index: 1,
        linked_job_id: body.linked_job_id ?? null,
        is_archived: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    });
  }

  const supabase = createSupabaseAdminClient();
  const { data: business } = await supabase.from("businesses").select("id").limit(1).maybeSingle();
  const businessId = business?.id ?? process.env.NEXT_PUBLIC_BUSINESS_ID ?? "";

  const { data, error } = await supabase
    .from("sticky_notes")
    .insert({
      business_id: businessId,
      user_id: auth.session.user?.id ?? null,
      content: body.content ?? "",
      color: body.color ?? "#fde68a",
      position_x: body.position_x ?? 20,
      position_y: body.position_y ?? 20,
      width: body.width ?? 220,
      height: body.height ?? 220,
      linked_job_id: body.linked_job_id || null
    })
    .select("*")
    .single();

  if (error || !data) {
    return NextResponse.json({ ok: false, error: error?.message ?? "Unable to create note." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, note: data });
}

export async function PATCH(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    id?: string;
    content?: string;
    color?: string;
    position_x?: number;
    position_y?: number;
    width?: number;
    height?: number;
    linked_job_id?: string | null;
    is_archived?: boolean;
  };

  if (!body.id) {
    return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });
  }

  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  if (!canPersistToSupabase()) {
    return NextResponse.json({ ok: true });
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.content !== undefined) update.content = body.content;
  if (body.color !== undefined) update.color = body.color;
  if (body.position_x !== undefined) update.position_x = body.position_x;
  if (body.position_y !== undefined) update.position_y = body.position_y;
  if (body.width !== undefined) update.width = body.width;
  if (body.height !== undefined) update.height = body.height;
  if (body.linked_job_id !== undefined) update.linked_job_id = body.linked_job_id;
  if (body.is_archived !== undefined) update.is_archived = body.is_archived;

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("sticky_notes")
    .update(update)
    .eq("id", body.id)
    .select("*")
    .single();

  if (error || !data) {
    return NextResponse.json({ ok: false, error: error?.message ?? "Unable to update note." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, note: data });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });
  }

  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  if (!canPersistToSupabase()) {
    return NextResponse.json({ ok: true });
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("sticky_notes").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
