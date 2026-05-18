import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getMessages } from "@/lib/data";
import { canPersistToSupabase } from "@/lib/workflows";
import type { ConversationStatus } from "@/lib/types";

type Props = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, { params }: Props) {
  const { id } = await params;
  if (!canPersistToSupabase()) return NextResponse.json({ ok: true, conversation: null, messages: [] });

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("conversations")
    .select("*, customers(*), jobs(*), quotes(*)")
    .eq("id", id)
    .single();

  if (error || !data) {
    return NextResponse.json({ ok: false, error: error?.message ?? "Conversation not found." }, { status: 404 });
  }

  const messages = await getMessages(id);
  return NextResponse.json({ ok: true, conversation: data, messages });
}

export async function PATCH(request: Request, { params }: Props) {
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    status?: ConversationStatus;
    unread_count?: number;
    snoozed_until?: string | null;
  };

  if (!canPersistToSupabase()) return NextResponse.json({ ok: true });

  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString()
  };

  if (body.status) payload.status = body.status;
  if (typeof body.unread_count === "number") payload.unread_count = body.unread_count;
  if ("snoozed_until" in body) payload.snoozed_until = body.snoozed_until;

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.from("conversations").update(payload).eq("id", id).select("*").single();

  if (error || !data) {
    return NextResponse.json({ ok: false, error: error?.message ?? "Unable to update conversation." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, conversation: data });
}
