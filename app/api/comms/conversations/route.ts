import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getConversations, getUnreadConversationCount } from "@/lib/data";
import { findOrCreateConversation } from "@/lib/comms/findOrCreateConversation";
import { canPersistToSupabase } from "@/lib/workflows";
import type { ConversationChannel } from "@/lib/types";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const summaryOnly = url.searchParams.get("summary") === "1";
  const conversations = await getConversations();
  const unreadCount = conversations.reduce((sum, conversation) => sum + Number(conversation.unread_count ?? 0), 0);

  if (summaryOnly) {
    return NextResponse.json({ ok: true, unreadCount, conversations: conversations.slice(0, 20) });
  }

  return NextResponse.json({ ok: true, conversations, unreadCount });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    customerEmail?: string | null;
    customerPhone?: string | null;
    channel?: ConversationChannel;
    subject?: string | null;
    jobId?: string | null;
    quoteId?: string | null;
  };

  if (!body.channel) {
    return NextResponse.json({ ok: false, error: "Channel is required." }, { status: 400 });
  }

  if (!canPersistToSupabase()) {
    return NextResponse.json({ ok: true, conversation: null });
  }

  const conversation = await findOrCreateConversation({
    customerEmail: body.customerEmail,
    customerPhone: body.customerPhone,
    channel: body.channel,
    subject: body.subject,
    jobId: body.jobId,
    quoteId: body.quoteId
  });

  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("conversations")
    .select("*, customers(*), jobs(*), quotes(*)")
    .eq("id", conversation.id)
    .single();

  return NextResponse.json({ ok: true, conversation: data ?? conversation, unreadCount: await getUnreadConversationCount() });
}
