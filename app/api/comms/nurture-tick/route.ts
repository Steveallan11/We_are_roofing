import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { getJobBundle } from "@/lib/data";
import { nurtureEmail } from "@/lib/email/templates";
import { sendEmail } from "@/lib/email/sendEmail";
import { createQuotePublicToken } from "@/lib/public-quote";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { canPersistToSupabase } from "@/lib/workflows";

const DAYS = [2, 5, 10, 14, 21];

export async function GET() {
  if (!canPersistToSupabase()) return NextResponse.json({ ok: true, sent: 0 });

  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const supabase = createSupabaseAdminClient();
  const { data: sequences, error } = await supabase.from("nurture_sequences").select("*").eq("status", "active");
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  let sent = 0;
  for (const sequence of sequences ?? []) {
    const { data: quote } = await supabase.from("quotes").select("*").eq("id", sequence.quote_id).single();
    if (!quote || ["Accepted", "Declined"].includes(quote.status)) {
      await supabase.from("nurture_sequences").update({ status: "cancelled", cancelled_at: new Date().toISOString(), cancel_reason: quote?.status?.toLowerCase() || "missing_quote" }).eq("id", sequence.id);
      continue;
    }

    const ageDays = Math.floor((Date.now() - new Date(sequence.triggered_at).getTime()) / 86_400_000);
    const day = DAYS.find((item) => item === ageDays);
    if (!day) continue;

    const { data: existing } = await supabase.from("email_logs").select("id").eq("quote_id", sequence.quote_id).eq("template_type", "nurture").eq("sequence_day", day).maybeSingle();
    if (existing) continue;

    const bundle = await getJobBundle(sequence.job_id);
    if (!bundle?.customer.email) continue;

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://we-are-roofing-one.vercel.app";
    const publicToken = quote.public_token || createQuotePublicToken();
    if (!quote.public_token) {
      const { error: tokenError } = await supabase
        .from("quotes")
        .update({
          public_token: publicToken,
          public_token_created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq("id", sequence.quote_id);

      if (tokenError) {
        console.warn("Nurture quote token could not be created:", tokenError.message);
        continue;
      }
    }

    const email = nurtureEmail(day, {
      customerName: bundle.customer.full_name,
      town: bundle.customer.town,
      quoteUrl: `${appUrl}/quote/${sequence.quote_id}?token=${encodeURIComponent(publicToken)}`,
      quoteRef: quote.quote_ref,
      businessPhone: bundle.business.phone,
      businessEmail: bundle.business.email
    });
    await sendEmail({
      to: bundle.customer.email,
      subject: email.subject,
      html: email.html,
      jobId: sequence.job_id,
      quoteId: sequence.quote_id,
      templateType: "nurture",
      sequenceDay: day
    });
    sent += 1;

    if (day === 21) {
      await supabase.from("nurture_sequences").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", sequence.id);
    }
  }

  return NextResponse.json({ ok: true, sent });
}
