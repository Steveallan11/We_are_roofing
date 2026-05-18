import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { findOrCreateConversation } from "@/lib/comms/findOrCreateConversation";

export async function POST(request: Request) {
  const body = await request.text();
  const params = new URLSearchParams(body);
  const from = params.get("From") || "";
  const text = params.get("Body") || "";
  const isWhatsApp = from.startsWith("whatsapp:");
  const phone = from.replace("whatsapp:", "");
  const channel = isWhatsApp ? "whatsapp" : "sms";

  const conversation = await findOrCreateConversation({
    customerPhone: phone,
    channel,
    subject: `Inbound ${channel}`
  });

  const supabase = createSupabaseAdminClient();
  await supabase.from("messages").insert({
    conversation_id: conversation.id,
    direction: "inbound",
    channel,
    sender_type: "customer",
    sender_phone: phone,
    body: text,
    provider: "twilio",
    provider_msg_id: params.get("MessageSid"),
    status: "delivered",
    sent_at: new Date().toISOString()
  });

  await supabase
    .from("conversations")
    .update({
      unread_count: Number(conversation.unread_count ?? 0) + 1,
      last_message_at: new Date().toISOString(),
      last_message_preview: text.slice(0, 100),
      updated_at: new Date().toISOString()
    })
    .eq("id", conversation.id);

  return new NextResponse("<Response/>", {
    headers: { "Content-Type": "text/xml" }
  });
}
