import { NextResponse } from "next/server";
import { acceptQuote } from "@/lib/quotes/acceptQuote";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { validatePublicQuoteAccess } from "@/lib/public-quote";
import type { QuoteRecord } from "@/lib/types";
import { canPersistToSupabase } from "@/lib/workflows";

type Props = {
  params: Promise<{ quoteId: string }>;
};

export async function POST(request: Request, { params }: Props) {
  const { quoteId } = await params;
  const token = new URL(request.url).searchParams.get("token");
  const body = (await request.json().catch(() => ({}))) as {
    option_id?: string | null;
    selected_line_indexes?: number[];
    customer_name?: string | null;
    customer_email?: string | null;
  };

  if (!canPersistToSupabase()) {
    return NextResponse.json({ ok: true });
  }

  const supabase = createSupabaseAdminClient();
  const { data: quote, error } = await supabase.from("quotes").select("*").eq("id", quoteId).single();
  if (error || !quote) {
    return NextResponse.json({ ok: false, error: error?.message ?? "Quote not found." }, { status: 404 });
  }

  const quoteRecord = quote as QuoteRecord;
  const access = validatePublicQuoteAccess(quoteRecord, token);
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: "Quote link is invalid or has expired." }, { status: 403 });
  }

  const customerName = body.customer_name?.trim() ?? "";
  const customerEmail = body.customer_email?.trim() ?? "";
  if (customerName.length < 2 || !/^\S+@\S+\.\S+$/.test(customerEmail)) {
    return NextResponse.json({ ok: false, error: "Please confirm your name and email before accepting." }, { status: 400 });
  }

  const result = await acceptQuote(supabase, {
    quoteId,
    optionId: body.option_id,
    selectedLineIndexes: body.selected_line_indexes,
    actorType: "customer",
    actorName: customerName,
    customerEmail
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true, accepted_option_id: result.accepted_option_id });
}
