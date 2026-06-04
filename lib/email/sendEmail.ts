import { Resend } from "resend";
import nodemailer from "nodemailer";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { canPersistToSupabase } from "@/lib/workflows";
import { findOrCreateConversation } from "@/lib/comms/findOrCreateConversation";
import { startNurtureSequence } from "@/lib/email/nurture";

type SendEmailParams = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: Array<{
    filename: string;
    content: string;
    contentType?: string;
  }>;
  jobId?: string | null;
  quoteId?: string | null;
  templateType: string;
  sequenceDay?: number | null;
};

export async function sendEmail({ to, subject, html, text, attachments, jobId, quoteId, templateType, sequenceDay }: SendEmailParams) {
  const sender = getEmailSenderConfig(to);
  let resendId: string | null = null;
  let status = "Logged - no provider configured";

  try {
    if (shouldUseGmailSmtp()) {
      const result = await sendViaGmailSmtp({
        sender,
        to,
        subject,
        html,
        text,
        attachments
      });
      resendId = result.id;
      status = "Sent";
    } else if (process.env.RESEND_API_KEY) {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const result = await resend.emails.send({
        from: sender.from,
        to: [to],
        subject,
        html,
        text,
        attachments,
        replyTo: sender.replyTo,
        bcc: sender.bcc
      });

      if (result.error) {
        throw new Error(result.error.message);
      }

      resendId = result.data?.id ?? null;
      status = "Sent";
    }
  } catch (error) {
    status = `Failed - ${error instanceof Error ? error.message : "provider rejected email"}`;
    await logEmail({
      jobId,
      quoteId,
      to,
      subject,
      html,
      text,
      templateType,
      sequenceDay,
      resendId,
      status
    });
    throw error;
  }

  await logEmail({
    jobId,
    quoteId,
    to,
    subject,
    html,
    text,
    templateType,
    sequenceDay,
    resendId,
    status
  });

  return { id: resendId, status };
}

export function getEmailSenderConfig(toEmail?: string | null) {
  const usingGmail = shouldUseGmailSmtp();
  const fromEmail = usingGmail
    ? process.env.GMAIL_SMTP_USER || "werroofinguk@gmail.com"
    : process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
  const fromName = process.env.RESEND_FROM_NAME || "Andy @ We Are Roofing";
  const replyTo = process.env.RESEND_REPLY_TO_EMAIL || process.env.MVP_ADMIN_EMAIL || process.env.NEXT_PUBLIC_MVP_ADMIN_EMAIL || "werroofinguk@gmail.com";
  const bcc = process.env.RESEND_BCC_EMAIL || replyTo;

  return {
    from: `${fromName} <${fromEmail}>`,
    replyTo,
    bcc: bcc && bcc.toLowerCase() !== toEmail?.trim().toLowerCase() ? bcc : undefined
  };
}

function shouldUseGmailSmtp() {
  return process.env.EMAIL_PROVIDER === "gmail" || Boolean(process.env.GMAIL_SMTP_USER && process.env.GMAIL_SMTP_APP_PASSWORD && !process.env.RESEND_API_KEY);
}

async function sendViaGmailSmtp({
  sender,
  to,
  subject,
  html,
  text,
  attachments
}: {
  sender: ReturnType<typeof getEmailSenderConfig>;
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: SendEmailParams["attachments"];
}) {
  const user = process.env.GMAIL_SMTP_USER;
  const pass = process.env.GMAIL_SMTP_APP_PASSWORD;
  if (!user || !pass) {
    throw new Error("Gmail SMTP is selected but GMAIL_SMTP_USER or GMAIL_SMTP_APP_PASSWORD is missing.");
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass }
  });

  const result = await transporter.sendMail({
    from: sender.from,
    to,
    bcc: sender.bcc,
    replyTo: sender.replyTo,
    subject,
    html,
    text,
    attachments: attachments?.map((attachment) => ({
      filename: attachment.filename,
      content: Buffer.from(attachment.content, "base64"),
      contentType: attachment.contentType
    }))
  });

  return { id: result.messageId || null };
}

async function logEmail({
  jobId,
  quoteId,
  to,
  subject,
  html,
  text,
  templateType,
  sequenceDay,
  resendId,
  status
}: {
  jobId?: string | null;
  quoteId?: string | null;
  to: string;
  subject: string;
  html: string;
  text?: string;
  templateType: string;
  sequenceDay?: number | null;
  resendId: string | null;
  status: string;
}) {
  if (!canPersistToSupabase()) return;

  const supabase = createSupabaseAdminClient();

  // Create or find conversation to track in Comms
  try {
    const conversation = await findOrCreateConversation({
      customerEmail: to,
      channel: "email",
      subject,
      jobId: jobId ?? null,
      quoteId: quoteId ?? null
    });

    // Create message record so it appears in Comms thread
    await supabase.from("messages").insert({
      conversation_id: conversation.id,
      direction: "outbound",
      channel: "email",
      sender_type: "business",
      sender_name: "Andy @ We Are Roofing",
      sender_email: "werroofinguk@gmail.com",
      body: text || html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
      html_body: html,
      subject,
      status: status === "Sent" ? "delivered" : "failed",
      sent_at: new Date().toISOString()
    });
  } catch (err) {
    console.error("Failed to create message/conversation for email:", {
      to,
      jobId,
      quoteId,
      error: err instanceof Error ? err.message : String(err)
    });
  }

  await supabase.from("email_logs").insert({
    job_id: jobId ?? null,
    quote_id: quoteId ?? null,
    to_email: to,
    subject,
    body: text || html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
    channel: "email",
    template_type: templateType,
    sequence_day: sequenceDay ?? null,
    resend_id: resendId,
    provider_message_id: resendId,
    sent_at: new Date().toISOString(),
    status
  });

  // Start nurture sequence if this is a quote email (and successful send)
  if (quoteId && status === "Sent" && !sequenceDay) {
    try {
      await startNurtureSequence(quoteId);
    } catch (err) {
      console.error("Failed to start nurture sequence:", {
        quoteId,
        error: err instanceof Error ? err.message : String(err)
      });
    }
  }
}
