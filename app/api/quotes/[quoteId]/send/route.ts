import { NextResponse } from "next/server";
import { Resend } from "resend";
import { getJobBundle } from "@/lib/data";
import { persistQuoteArtifacts } from "@/lib/quote-engine";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { canPersistToSupabase } from "@/lib/workflows";

type Props = {
  params: Promise<{ quoteId: string }>;
};

export async function POST(request: Request, { params }: Props) {
  const { quoteId } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    to_email?: string;
    subject?: string;
    body?: string;
  };

  if (!body.to_email || !body.subject || !body.body) {
    return NextResponse.json({ ok: false, error: "to_email, subject and body are required" }, { status: 400 });
  }

  if (!canPersistToSupabase()) {
    return NextResponse.json({
      ok: true,
      quoteId,
      message: "Quote send preview completed.",
      next_job_status: "Quote Sent",
      next_quote_status: "Sent"
    });
  }

  const supabase = createSupabaseAdminClient();
  const { data: quote, error } = await supabase.from("quotes").select("*").eq("id", quoteId).single();
  if (error || !quote) {
    return NextResponse.json({ ok: false, error: error?.message ?? "Unable to load quote." }, { status: 500 });
  }

  if (quote.status !== "Approved" && quote.status !== "Sent") {
    return NextResponse.json({ ok: false, error: "Quote must be approved before it can be sent." }, { status: 400 });
  }

  const bundle = await getJobBundle(quote.job_id);
  if (!bundle) {
    return NextResponse.json({ ok: false, error: "Related job bundle not found." }, { status: 404 });
  }

  const artifacts = await persistQuoteArtifacts(supabase, { ...bundle, quote }, quote);

  let providerMessageId: string | null = null;
  if (process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL) {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const result = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL,
      to: [body.to_email],
      subject: body.subject,
      html: `<div style="font-family:Arial,sans-serif;white-space:pre-line">${body.body}</div>`,
      attachments: [
        {
          filename: `${quote.quote_ref}.pdf`,
          content: artifacts.pdf.toString("base64")
        }
      ]
    });
    providerMessageId = result.data?.id ?? null;
  }

  const { data: sentQuote, error: updateError } = await supabase
    .from("quotes")
    .update({
      status: "Sent",
      sent_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      pdf_url: artifacts.pdfUrl ?? quote.pdf_url
    })
    .eq("id", quoteId)
    .select("*")
    .single();

  if (updateError || !sentQuote) {
    return NextResponse.json({ ok: false, error: updateError?.message ?? "Unable to update quote send status." }, { status: 500 });
  }

  await supabase
    .from("jobs")
    .update({
      status: "Quote Sent",
      quote_sent_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq("id", quote.job_id);

  await supabase.from("email_logs").insert({
    job_id: quote.job_id,
    quote_id: quoteId,
    to_email: body.to_email,
    subject: body.subject,
    body: body.body,
    provider_message_id: providerMessageId,
    sent_at: new Date().toISOString(),
    status: process.env.RESEND_API_KEY ? "Sent" : "Logged - no provider configured"
  });

  return NextResponse.json({
    ok: true,
    quoteId,
    provider_message_id: providerMessageId,
    pdf_url: artifacts.pdfUrl,
    message: process.env.RESEND_API_KEY
      ? "Quote email sent and saved."
      : "Quote send logged in Supabase. RESEND_API_KEY not configured, so no provider email was sent.",
    next_job_status: "Quote Sent",
    next_quote_status: "Sent"
  });
}
