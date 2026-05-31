import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getMessages } from "@/lib/data";
import { sendMessage } from "@/lib/comms/sendMessage";
import { canPersistToSupabase } from "@/lib/workflows";
import type { ConversationChannel } from "@/lib/types";

type Props = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, { params }: Props) {
  const { id } = await params;
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  return NextResponse.json({ ok: true, messages: await getMessages(id) });
}

export async function POST(request: Request, { params }: Props) {
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    channel?: ConversationChannel;
    body?: string;
    subject?: string | null;
    templateType?: string | null;
  };

  if (!body.channel || !body.body?.trim()) {
    return NextResponse.json({ ok: false, error: "Channel and message body are required." }, { status: 400 });
  }

  if (!canPersistToSupabase()) {
    return NextResponse.json({ ok: true, status: "preview" });
  }

  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const supabase = createSupabaseAdminClient();
  const { data: conversation, error } = await supabase
    .from("conversations")
    .select("*, customers(*), jobs(*), quotes(*)")
    .eq("id", id)
    .single();

  if (error || !conversation) {
    return NextResponse.json({ ok: false, error: error?.message ?? "Conversation not found." }, { status: 404 });
  }

  const customer = conversation.customers as { email?: string | null; phone?: string | null; contact_person_email?: string | null; contact_person_phone?: string | null } | null;
  const result = await sendMessage({
    conversationId: id,
    channel: body.channel,
    body: body.body,
    subject: body.subject,
    toEmail: customer?.email || customer?.contact_person_email || null,
    toPhone: customer?.phone || customer?.contact_person_phone || null,
    jobId: typeof conversation.job_id === "string" ? conversation.job_id : null,
    quoteId: typeof conversation.quote_id === "string" ? conversation.quote_id : null,
    templateType: body.templateType || "manual_message"
  });

  const messages = await getMessages(id);
  return NextResponse.json({ ok: true, result, messages });
}
