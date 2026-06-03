import { NextResponse } from "next/server";
import { createActivity } from "@/lib/activity/createActivity";
import { findOrCreateConversation } from "@/lib/comms/findOrCreateConversation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { validatePublicQuoteAccess } from "@/lib/public-quote";
import { canPersistToSupabase } from "@/lib/workflows";
import type { QuoteRecord } from "@/lib/types";

type Props = {
  params: Promise<{ quoteId: string }>;
};

export async function GET(_request: Request, { params }: Props) {
  const { quoteId } = await params;
  if (!canPersistToSupabase()) return NextResponse.json({ ok: true, messages: [] });

  const supabase = createSupabaseAdminClient();
  const { data: quote } = await supabase.from("quotes").select("id, status, public_token").eq("id", quoteId).single();
  const token = new URL(_request.url).searchParams.get("token");
  if (!token || !quote || !validatePublicQuoteAccess(quote as QuoteRecord, token).ok) {
    return NextResponse.json({ ok: false, error: "Quote link is invalid or has expired." }, { status: 403 });
  }

  const { data, error } = await supabase.from("quote_messages").select("*").eq("quote_id", quoteId).order("created_at", { ascending: true });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, messages: data ?? [] });
}

export async function POST(request: Request, { params }: Props) {
  const { quoteId } = await params;
  const token = new URL(request.url).searchParams.get("token");
  const body = (await request.json().catch(() => ({}))) as {
    sender_name?: string;
    sender_email?: string;
    message?: string;
  };

  const message = body.message?.trim() ?? "";
  const senderName = body.sender_name?.trim().slice(0, 120) || null;
  const senderEmail = body.sender_email?.trim().slice(0, 180) || null;

  if (!message) {
    return NextResponse.json({ ok: false, error: "Message is required." }, { status: 400 });
  }
  if (senderEmail && !/^\S+@\S+\.\S+$/.test(senderEmail)) {
    return NextResponse.json({ ok: false, error: "Please enter a valid email address." }, { status: 400 });
  }

  if (!canPersistToSupabase()) return NextResponse.json({ ok: true });

  const supabase = createSupabaseAdminClient();
  const { data: quote } = await supabase
    .from("quotes")
    .select("id, job_id, quote_ref, status, public_token, business_id")
    .eq("id", quoteId)
    .single();
  if (!quote || !validatePublicQuoteAccess(quote as unknown as QuoteRecord, token).ok) {
    return NextResponse.json({ ok: false, error: "Quote link is invalid or has expired." }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("quote_messages")
    .insert({
      quote_id: quoteId,
      job_id: quote?.job_id ?? null,
      sender_type: "customer",
      sender_name: senderName,
      sender_email: senderEmail,
      message
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  // Mirror customer's message into the unified Comms inbox + log activity on the job.
  try {
    const conversation = await findOrCreateConversation({
      customerEmail: senderEmail,
      channel: "platform",
      subject: `Quote ${(quote as { quote_ref?: string }).quote_ref ?? quoteId} reply`,
      jobId: quote?.job_id ?? null,
      quoteId
    });

    const { data: insertedMessage } = await supabase
      .from("messages")
      .insert({
        conversation_id: conversation.id,
        direction: "inbound",
        channel: "platform",
        sender_type: "customer",
        sender_name: senderName,
        sender_email: senderEmail,
        body: message,
        status: "delivered"
      })
      .select("id")
      .single();

    await supabase
      .from("conversations")
      .update({
        unread_count: Number((conversation as { unread_count?: number }).unread_count ?? 0) + 1,
        last_message_at: new Date().toISOString(),
        last_message_preview: message.slice(0, 100),
        updated_at: new Date().toISOString()
      })
      .eq("id", conversation.id);

    if (quote?.job_id) {
      const { data: jobMeta } = await supabase
        .from("jobs")
        .select("business_id, customer_id")
        .eq("id", quote.job_id)
        .maybeSingle();

      await createActivity(supabase, {
        business_id: jobMeta?.business_id ? String(jobMeta.business_id) : null,
        job_id: String(quote.job_id),
        customer_id: jobMeta?.customer_id ? String(jobMeta.customer_id) : null,
        quote_id: quoteId,
        activity_type: "customer_message",
        message: `${senderName ?? "Customer"} sent a message from the quote: ${message.slice(0, 80)}${message.length > 80 ? "…" : ""}`,
        actor_type: "customer",
        actor_name: senderName ?? senderEmail ?? "Customer",
        linked_entity_type: "comms_message",
        linked_entity_id: insertedMessage?.id ?? null,
        details: { conversation_id: conversation.id, sender_email: senderEmail }
      });
    }
  } catch (convoError) {
    console.warn("Comms mirror failed for quote message:", convoError instanceof Error ? convoError.message : convoError);
  }

  return NextResponse.json({ ok: true, message: data });
}
