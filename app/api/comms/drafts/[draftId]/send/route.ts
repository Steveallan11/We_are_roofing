import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { sendCommunicationDraft } from "@/lib/comms/communicationDrafts";
import { getMessages } from "@/lib/data";

type Props = { params: Promise<{ draftId: string }> };

export async function POST(request: Request, { params }: Props) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  const { draftId } = await params;
  const body = (await request.json().catch(() => ({}))) as { confirmed?: boolean; conversationId?: string };
  if (body.confirmed !== true) {
    return NextResponse.json({ ok: false, error: "Explicit confirmation is required before sending." }, { status: 400 });
  }
  try {
    const result = await sendCommunicationDraft(draftId, true);
    return NextResponse.json({
      ok: true,
      result,
      messages: body.conversationId ? await getMessages(body.conversationId) : undefined
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Message could not be sent." }, { status: 400 });
  }
}
