import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { findOrCreateConversation } from "@/lib/comms/findOrCreateConversation";

export async function POST(request: Request) {
  const body = await request.text();
  if (!isValidTwilioRequest(request, body)) {
    return NextResponse.json({ ok: false, error: "Invalid Twilio signature." }, { status: 403 });
  }

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

function isValidTwilioRequest(request: Request, body: string) {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) {
    return process.env.NODE_ENV !== "production";
  }

  const signature = request.headers.get("x-twilio-signature");
  if (!signature) return false;

  const url = request.url.replace(/^http:\/\//, "https://");
  const params = new URLSearchParams(body);
  const data = [...params.keys()]
    .sort()
    .reduce((acc, key) => `${acc}${key}${params.get(key) ?? ""}`, url);
  const expected = createHmac("sha1", authToken).update(data).digest("base64");
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}
