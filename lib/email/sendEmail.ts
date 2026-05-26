import { Resend } from "resend";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { canPersistToSupabase } from "@/lib/workflows";

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
  const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
  const fromName = process.env.RESEND_FROM_NAME || "Andy @ We Are Roofing";
  let resendId: string | null = null;
  let status = "Logged - no provider configured";

  if (process.env.RESEND_API_KEY) {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const result = await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: [to],
      subject,
      html,
      text,
      attachments
    });
    resendId = result.data?.id ?? null;
    status = "Sent";
  }

  if (canPersistToSupabase()) {
    await createSupabaseAdminClient().from("email_logs").insert({
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
  }

  return { id: resendId, status };
}
