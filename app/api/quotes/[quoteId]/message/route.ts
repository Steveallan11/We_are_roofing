import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { canPersistToSupabase } from "@/lib/workflows";

type Props = {
  params: Promise<{ quoteId: string }>;
};

export async function GET(_request: Request, { params }: Props) {
  const { quoteId } = await params;
  if (!canPersistToSupabase()) return NextResponse.json({ ok: true, messages: [] });

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.from("quote_messages").select("*").eq("quote_id", quoteId).order("created_at", { ascending: true });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, messages: data ?? [] });
}

export async function POST(request: Request, { params }: Props) {
  const { quoteId } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    sender_type?: "customer" | "admin";
    sender_name?: string;
    sender_email?: string;
    message?: string;
  };

  if (!body.message?.trim()) {
    return NextResponse.json({ ok: false, error: "Message is required." }, { status: 400 });
  }

  if (!canPersistToSupabase()) return NextResponse.json({ ok: true });

  const supabase = createSupabaseAdminClient();
  const { data: quote } = await supabase.from("quotes").select("job_id").eq("id", quoteId).single();
  const { data, error } = await supabase
    .from("quote_messages")
    .insert({
      quote_id: quoteId,
      job_id: quote?.job_id ?? null,
      sender_type: body.sender_type === "admin" ? "admin" : "customer",
      sender_name: body.sender_name || null,
      sender_email: body.sender_email || null,
      message: body.message.trim()
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, message: data });
}
