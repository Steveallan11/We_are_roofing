import { NextResponse } from "next/server";
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
  const { data: quote } = await supabase.from("quotes").select("job_id, status, public_token").eq("id", quoteId).single();
  if (!quote || !validatePublicQuoteAccess(quote as QuoteRecord, token).ok) {
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
  return NextResponse.json({ ok: true, message: data });
}
