import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { getLatestConversationDraft, saveCommunicationDraft } from "@/lib/comms/communicationDrafts";
import type { ConversationChannel } from "@/lib/types";

export async function GET(request: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  const conversationId = new URL(request.url).searchParams.get("conversationId");
  if (!conversationId) return NextResponse.json({ ok: false, error: "conversationId is required." }, { status: 400 });
  try {
    return NextResponse.json({ ok: true, draft: await getLatestConversationDraft(conversationId) });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Draft could not be loaded." }, { status: 400 });
  }
}

export async function POST(request: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  const body = (await request.json().catch(() => ({}))) as {
    id?: string | null;
    conversationId?: string;
    channel?: ConversationChannel;
    subject?: string | null;
    body?: string;
    literatureIds?: string[];
    jobDocumentIds?: string[];
  };
  if (!body.conversationId || !body.body?.trim() || !["email", "sms", "whatsapp"].includes(body.channel ?? "")) {
    return NextResponse.json({ ok: false, error: "Conversation, supported channel and message body are required." }, { status: 400 });
  }
  try {
    const draft = await saveCommunicationDraft({
      id: body.id,
      conversationId: body.conversationId,
      channel: body.channel as Extract<ConversationChannel, "email" | "sms" | "whatsapp">,
      subject: body.subject,
      body: body.body,
      literatureIds: body.literatureIds,
      jobDocumentIds: body.jobDocumentIds,
      createdBy: "admin"
    });
    return NextResponse.json({ ok: true, draft });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Draft could not be saved." }, { status: 400 });
  }
}
