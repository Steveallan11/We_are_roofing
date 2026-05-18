import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/sendEmail";
import { formatUkPhone, sendSMS } from "@/lib/sms/sendSMS";
import type { ConversationChannel, MessageRecord } from "@/lib/types";

type SendMessageParams = {
  conversationId?: string | null;
  channel: ConversationChannel;
  body: string;
  subject?: string | null;
  htmlBody?: string | null;
  toEmail?: string | null;
  toPhone?: string | null;
  jobId?: string | null;
  quoteId?: string | null;
  templateType?: string | null;
};

export async function sendMessage({
  conversationId,
  channel,
  body,
  subject,
  htmlBody,
  toEmail,
  toPhone,
  jobId,
  quoteId,
  templateType
}: SendMessageParams) {
  const supabase = createSupabaseAdminClient();
  let providerId: string | null = null;
  let provider: string | null = null;
  let status: MessageRecord["status"] = "sent";
  const trimmedBody = body.trim();

  try {
    if (channel === "email") {
      if (!toEmail?.trim()) throw new Error("Email address is required.");
      const result = await sendEmail({
        to: toEmail.trim(),
        subject: subject?.trim() || "Message from We Are Roofing",
        html: htmlBody?.trim() || `<p>${escapeHtml(trimmedBody).replaceAll("\n", "<br />")}</p>`,
        text: trimmedBody,
        jobId: jobId ?? null,
        quoteId: quoteId ?? null,
        templateType: templateType || "manual_message"
      });
      providerId = result.id;
      provider = "resend";
    } else if (channel === "sms" || channel === "whatsapp") {
      if (!toPhone?.trim()) throw new Error("Phone number is required.");
      const result = await sendSMS({
        to: toPhone.trim(),
        message: trimmedBody.slice(0, 1600),
        jobId: jobId ?? null,
        templateType: templateType || "manual_message"
      });
      providerId = result.sid;
      provider = "twilio";
      status = result.status === "queued" ? "pending" : "sent";
    }
  } catch (error) {
    status = "failed";
    throw error;
  } finally {
    if (conversationId) {
      await supabase.from("messages").insert({
        conversation_id: conversationId,
        direction: "outbound",
        channel,
        sender_type: "admin",
        sender_name: "Andy",
        sender_email: channel === "email" ? process.env.RESEND_FROM_EMAIL || null : null,
        sender_phone: channel === "sms" || channel === "whatsapp" ? formatUkPhone(process.env.TWILIO_FROM_NUMBER || "0000000000") : null,
        body: trimmedBody,
        subject: subject?.trim() || null,
        html_body: htmlBody?.trim() || null,
        provider,
        provider_msg_id: providerId,
        status,
        sent_at: new Date().toISOString()
      });

      await supabase
        .from("conversations")
        .update({
          last_message_at: new Date().toISOString(),
          last_message_preview: trimmedBody.slice(0, 100),
          unread_count: 0,
          updated_at: new Date().toISOString()
        })
        .eq("id", conversationId);
    }
  }

  return { status, providerId };
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
