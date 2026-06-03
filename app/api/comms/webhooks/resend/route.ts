import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { createActivity } from "@/lib/activity/createActivity";
import { findOrCreateConversation } from "@/lib/comms/findOrCreateConversation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Resend webhook endpoint.
 *
 * Handles two kinds of events:
 *
 * 1. OUTBOUND status updates (email.delivered, email.opened, email.bounced, etc.)
 *    Match the email by provider_message_id and update the corresponding rows in
 *    `email_logs` and `messages` so the Comms thread reflects the latest state.
 *
 * 2. INBOUND emails (when Resend Inbound is configured to POST here).
 *    Create or reuse a conversation, insert an inbound message, log a
 *    `customer_replied` activity entry against the linked job/quote.
 *
 * Signature verification follows the Svix scheme that Resend uses:
 *   signed_payload = `${svix_id}.${svix_timestamp}.${body}`
 *   expected = `v1,${base64(hmac_sha256(secret, signed_payload))}`
 * Headers come in as `svix-id`, `svix-timestamp`, `svix-signature`.
 *
 * Set RESEND_WEBHOOK_SECRET to the secret shown in the Resend dashboard.
 * If unset, the webhook accepts payloads (useful for local dev) but logs a warning.
 */

type ResendEventName =
  | "email.sent"
  | "email.delivered"
  | "email.delivery_delayed"
  | "email.complained"
  | "email.bounced"
  | "email.opened"
  | "email.clicked"
  | "email.failed"
  | "email.received"
  | "inbound.email"
  | "inbound.received";

type ResendPayload = {
  type?: ResendEventName | string;
  created_at?: string;
  data?: {
    email_id?: string;
    from?: string | { email?: string; name?: string };
    to?: string[] | string;
    subject?: string;
    text?: string;
    html?: string;
    bounce?: { message?: string; type?: string };
    click?: { link?: string };
    headers?: Record<string, string>;
    [key: string]: unknown;
  };
};

export async function POST(request: Request) {
  const body = await request.text();
  const signatureValid = verifyResendSignature(request, body);
  if (!signatureValid.ok) {
    return NextResponse.json({ ok: false, error: signatureValid.reason }, { status: 403 });
  }

  let payload: ResendPayload;
  try {
    payload = JSON.parse(body) as ResendPayload;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }

  const eventType = String(payload.type ?? "");
  if (!eventType) {
    return NextResponse.json({ ok: false, error: "Missing event type." }, { status: 400 });
  }

  // Inbound email: customer replied
  if (eventType === "email.received" || eventType === "inbound.email" || eventType === "inbound.received") {
    return handleInboundEmail(payload);
  }

  // Outbound status update
  if (eventType.startsWith("email.")) {
    return handleOutboundStatus(eventType, payload);
  }

  return NextResponse.json({ ok: true, ignored: eventType });
}

async function handleOutboundStatus(eventType: string, payload: ResendPayload) {
  const providerMessageId = payload.data?.email_id;
  if (!providerMessageId) {
    return NextResponse.json({ ok: false, error: "Event missing email_id." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const status = mapOutboundEventStatus(eventType);
  const timestamp = payload.created_at ?? new Date().toISOString();

  // Update email_logs status (best-effort, may not exist for old emails)
  await supabase
    .from("email_logs")
    .update({
      status,
      opened_at: eventType === "email.opened" ? timestamp : undefined,
      clicked_at: eventType === "email.clicked" ? timestamp : undefined
    })
    .eq("provider_message_id", providerMessageId);

  // Update messages table for the unified inbox
  const messageStatus = mapOutboundEventMessageStatus(eventType);
  if (messageStatus) {
    await supabase
      .from("messages")
      .update({
        status: messageStatus,
        delivered_at: eventType === "email.delivered" ? timestamp : undefined,
        read_at: eventType === "email.opened" ? timestamp : undefined
      })
      .eq("provider_msg_id", providerMessageId);
  }

  // Log failure as activity so it shows up on the job timeline
  if (eventType === "email.bounced" || eventType === "email.failed") {
    const { data: log } = await supabase
      .from("email_logs")
      .select("job_id, quote_id, subject, to_email")
      .eq("provider_message_id", providerMessageId)
      .maybeSingle();

    if (log?.job_id) {
      const reason = payload.data?.bounce?.message || payload.data?.bounce?.type || "Provider reported failure";
      await createActivity(supabase, {
        job_id: log.job_id ? String(log.job_id) : null,
        quote_id: log.quote_id ? String(log.quote_id) : null,
        activity_type: "email_failed",
        message: `Email to ${log.to_email ?? "customer"} failed: ${reason}`,
        actor_type: "system",
        linked_entity_type: "email",
        linked_entity_id: providerMessageId,
        details: { event: eventType, subject: log.subject, reason }
      });
    }
  }

  return NextResponse.json({ ok: true, event: eventType });
}

async function handleInboundEmail(payload: ResendPayload) {
  const from = extractEmailAddress(payload.data?.from);
  const subject = payload.data?.subject ?? "Customer reply";
  const text = payload.data?.text ?? stripHtml(payload.data?.html);
  const headers = payload.data?.headers ?? {};
  const inReplyTo = headers["In-Reply-To"] || headers["in-reply-to"] || headers["References"] || null;

  if (!from || !text.trim()) {
    return NextResponse.json({ ok: false, error: "Inbound email missing sender or body." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();

  // Try to thread the reply to an outbound message we sent
  let jobId: string | null = null;
  let quoteId: string | null = null;
  let customerId: string | null = null;
  let businessId: string | null = null;
  let parentConversationId: string | null = null;

  if (inReplyTo) {
    const cleanInReplyTo = inReplyTo.replace(/[<>]/g, "").trim();
    const { data: parentMessage } = await supabase
      .from("messages")
      .select("conversation_id, conversations!inner(job_id, quote_id, customer_id, business_id)")
      .eq("provider_msg_id", cleanInReplyTo)
      .maybeSingle();

    const conversation = (parentMessage as { conversations?: { job_id?: string; quote_id?: string; customer_id?: string; business_id?: string } } | null)?.conversations;
    if (conversation) {
      parentConversationId = (parentMessage as { conversation_id?: string }).conversation_id ?? null;
      jobId = conversation.job_id ?? null;
      quoteId = conversation.quote_id ?? null;
      customerId = conversation.customer_id ?? null;
      businessId = conversation.business_id ?? null;
    }
  }

  // Fallback: match by sender email to a customer
  if (!customerId) {
    const { data: customer } = await supabase
      .from("customers")
      .select("id, business_id")
      .ilike("email", from)
      .maybeSingle();
    if (customer) {
      customerId = String(customer.id);
      businessId = customer.business_id ? String(customer.business_id) : businessId;
    }
  }

  const conversation = parentConversationId
    ? { id: parentConversationId, unread_count: 0 }
    : await findOrCreateConversation({
        customerEmail: from,
        channel: "email",
        subject,
        jobId,
        quoteId
      }).catch(() => null);

  if (!conversation) {
    return NextResponse.json({ ok: false, error: "Could not create conversation." }, { status: 500 });
  }

  const { data: message, error: messageError } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversation.id,
      direction: "inbound",
      channel: "email",
      sender_type: "customer",
      sender_email: from,
      body: text.trim(),
      subject,
      provider: "resend",
      provider_msg_id: payload.data?.email_id ?? null,
      status: "delivered"
    })
    .select("*")
    .single();

  if (messageError || !message) {
    return NextResponse.json({ ok: false, error: messageError?.message ?? "Failed to record message." }, { status: 500 });
  }

  await supabase
    .from("conversations")
    .update({
      unread_count: Number((conversation as { unread_count?: number }).unread_count ?? 0) + 1,
      last_message_at: new Date().toISOString(),
      last_message_preview: text.slice(0, 100),
      updated_at: new Date().toISOString()
    })
    .eq("id", conversation.id);

  if (jobId) {
    await createActivity(supabase, {
      business_id: businessId,
      job_id: jobId,
      customer_id: customerId,
      quote_id: quoteId,
      activity_type: "customer_replied",
      message: `${from} replied: ${text.slice(0, 80)}${text.length > 80 ? "…" : ""}`,
      actor_type: "customer",
      actor_name: from,
      linked_entity_type: "comms_message",
      linked_entity_id: message.id,
      details: { subject, conversation_id: conversation.id }
    });
  }

  return NextResponse.json({ ok: true, conversation_id: conversation.id, message_id: message.id });
}

/* -----------------  Helpers  ----------------- */

function verifyResendSignature(request: Request, body: string): { ok: true } | { ok: false; reason: string } {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    console.warn("RESEND_WEBHOOK_SECRET is not set. Accepting webhook without signature verification.");
    return { ok: true };
  }

  const svixId = request.headers.get("svix-id");
  const svixTimestamp = request.headers.get("svix-timestamp");
  const svixSignature = request.headers.get("svix-signature");
  if (!svixId || !svixTimestamp || !svixSignature) {
    return { ok: false, reason: "Missing Svix headers." };
  }

  // Resend secrets are formatted as `whsec_<base64>`
  const secretBytes = secret.startsWith("whsec_") ? Buffer.from(secret.slice(6), "base64") : Buffer.from(secret, "utf8");
  const signedPayload = `${svixId}.${svixTimestamp}.${body}`;
  const expected = createHmac("sha256", secretBytes).update(signedPayload).digest("base64");

  // svix-signature header looks like: "v1,sig1 v1,sig2 ..."
  const provided = svixSignature.split(" ").map((part) => part.split(",")[1]).filter(Boolean);
  const expectedBuf = Buffer.from(expected, "base64");
  const match = provided.some((sig) => {
    try {
      const sigBuf = Buffer.from(sig, "base64");
      return sigBuf.length === expectedBuf.length && timingSafeEqual(sigBuf, expectedBuf);
    } catch {
      return false;
    }
  });

  if (!match) return { ok: false, reason: "Signature mismatch." };
  return { ok: true };
}

function mapOutboundEventStatus(event: string): string {
  if (event === "email.delivered") return "Delivered";
  if (event === "email.opened") return "Opened";
  if (event === "email.clicked") return "Clicked";
  if (event === "email.complained") return "Complained";
  if (event === "email.bounced") return "Bounced";
  if (event === "email.failed") return "Failed";
  if (event === "email.delivery_delayed") return "Delayed";
  return "Sent";
}

function mapOutboundEventMessageStatus(event: string): "sent" | "delivered" | "read" | "failed" | null {
  if (event === "email.delivered") return "delivered";
  if (event === "email.opened" || event === "email.clicked") return "read";
  if (event === "email.bounced" || event === "email.failed") return "failed";
  if (event === "email.sent") return "sent";
  return null;
}

function extractEmailAddress(value: string | { email?: string; name?: string } | undefined): string | null {
  if (!value) return null;
  if (typeof value === "string") {
    const match = value.match(/<([^>]+)>/);
    return (match?.[1] ?? value).trim().toLowerCase();
  }
  if (typeof value.email === "string") return value.email.toLowerCase();
  return null;
}

function stripHtml(html: string | undefined): string {
  if (!html) return "";
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
