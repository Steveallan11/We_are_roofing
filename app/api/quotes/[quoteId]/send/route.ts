import { NextResponse } from "next/server";
import { getJobBundle } from "@/lib/data";
import { quoteSentEmail } from "@/lib/email/templates";
import { sendEmail } from "@/lib/email/sendEmail";
import { persistQuoteArtifacts } from "@/lib/quote-engine";
import { sendSMS, SMS_TEMPLATES } from "@/lib/sms/sendSMS";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { canPersistToSupabase } from "@/lib/workflows";
import { createQuotePublicToken } from "@/lib/public-quote";

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

  const toEmail = body.to_email?.trim() || bundle.customer.email?.trim();
  if (!toEmail) {
    return NextResponse.json({ ok: false, error: "NO_EMAIL", message: "No customer email is saved for this job yet." }, { status: 400 });
  }

  const subject = body.subject?.trim() || quote.customer_email_subject || `Your We Are Roofing quotation - ${quote.quote_ref}`;
  const messageBody = body.body?.trim() || quote.customer_email_body || "Please find our quotation below.";

  const artifacts = await persistQuoteArtifacts(supabase, { ...bundle, quote }, quote);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://we-are-roofing-one.vercel.app";
  const publicToken = quote.public_token || createQuotePublicToken();
  let quoteUrl = `${appUrl}/quote/${quoteId}?token=${encodeURIComponent(publicToken)}`;

  if (!quote.public_token) {
    const { error: tokenError } = await supabase
      .from("quotes")
      .update({
        public_token: publicToken,
        public_token_created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq("id", quoteId);

    if (tokenError && /public_token|schema cache/i.test(tokenError.message)) {
      console.warn("Quote public token columns are not available yet. Falling back to legacy quote link until migration runs.");
      quoteUrl = `${appUrl}/quote/${quoteId}`;
    } else if (tokenError) {
      return NextResponse.json({ ok: false, error: tokenError.message }, { status: 500 });
    }
  }
  const emailResult = await sendEmail({
    to: toEmail,
    subject,
    html: quoteSentEmail({ customerName: bundle.customer.full_name, quote, quoteUrl }),
    text: `${messageBody}\n\nView your quote: ${quoteUrl}`,
    jobId: quote.job_id,
    quoteId,
    templateType: "quote_sent"
  });

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

  if (toEmail !== (bundle.customer.email ?? "")) {
    await supabase.from("customers").update({ email: toEmail }).eq("id", bundle.customer.id);
  }

  if (bundle.customer.phone) {
    await sendSMS({
      to: bundle.customer.phone,
      message: SMS_TEMPLATES.quote_sent(bundle.customer.full_name, quote.quote_ref),
      jobId: quote.job_id,
      templateType: "quote_sent"
    }).catch((smsError) => console.warn("Quote SMS failed:", smsError));
  }

  const { data: existingSequence } = await supabase
    .from("nurture_sequences")
    .select("id")
    .eq("quote_id", quoteId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (!existingSequence) {
    await supabase.from("nurture_sequences").insert({
      job_id: quote.job_id,
      quote_id: quoteId,
      status: "active"
    });
  }

  return NextResponse.json({
    ok: true,
    quoteId,
    provider_message_id: emailResult.id,
    pdf_url: artifacts.pdfUrl,
    message: process.env.RESEND_API_KEY
      ? "Quote email sent and saved."
      : "Quote send logged in Supabase. RESEND_API_KEY not configured, so no provider email was sent.",
    next_job_status: "Quote Sent",
    next_quote_status: "Sent"
  });
}
