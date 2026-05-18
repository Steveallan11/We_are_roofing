import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { canPersistToSupabase } from "@/lib/workflows";

type SendSMSParams = {
  to: string;
  message: string;
  jobId: string;
  templateType: string;
};

export const SMS_TEMPLATES = {
  survey_confirmation: (name: string, date: string, time: string) =>
    `Hi ${firstName(name)}, your roof survey is confirmed for ${date} at ${time}. Any questions call 01252 000000. We Are Roofing`,
  survey_reminder: (name: string, time: string) =>
    `Hi ${firstName(name)}, reminder: your roof survey is tomorrow at ${time}. We Are Roofing 01252 000000`,
  quote_sent: (name: string, ref: string) =>
    `Hi ${firstName(name)}, your roofing quote ${ref} is ready to view. Check your email or call 01252 000000. We Are Roofing`,
  quote_accepted: (ref: string) => `Great news! Quote ${ref} has been accepted. Andy will be in touch to confirm your start date. We Are Roofing`
};

function firstName(value: string) {
  return value.split(" ")[0] || value;
}

export function formatUkPhone(value: string) {
  const clean = value.replace(/[^\d+]/g, "");
  if (clean.startsWith("+44")) return clean;
  if (clean.startsWith("07")) return `+44${clean.slice(1)}`;
  if (clean.startsWith("44")) return `+${clean}`;
  return `+44${clean.replace(/^0/, "")}`;
}

export async function sendSMS({ to, message, jobId, templateType }: SendSMSParams) {
  const formatted = formatUkPhone(to);
  let sid: string | null = null;
  let status = "Logged - no provider configured";

  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER) {
    const auth = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64");
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        Body: message,
        From: process.env.TWILIO_FROM_NUMBER,
        To: formatted
      })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "SMS send failed.");
    sid = result.sid ?? null;
    status = result.status ?? "sent";
  }

  if (canPersistToSupabase()) {
    await createSupabaseAdminClient().from("email_logs").insert({
      job_id: jobId,
      to_phone: formatted,
      to_email: "",
      subject: templateType,
      body: message,
      channel: "sms",
      template_type: templateType,
      twilio_sid: sid,
      sent_at: new Date().toISOString(),
      status
    });
  }

  return { sid, status };
}
