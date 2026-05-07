import { NextResponse } from "next/server";
import { getJobBundle, getKnowledgeBase } from "@/lib/data";
import { generateQuoteFromBundle } from "@/lib/quote";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { canPersistToSupabase, deriveQuoteStatus, getNextQuoteVersionAndRef } from "@/lib/workflows";

export async function POST(request: Request) {
  const body = (await request.json()) as { job_id?: string };
  if (!body.job_id) {
    return NextResponse.json({ ok: false, error: "job_id is required" }, { status: 400 });
  }

  const bundle = await getJobBundle(body.job_id);
  if (!bundle) {
    return NextResponse.json({ ok: false, error: "Job not found" }, { status: 404 });
  }

  const knowledge = await getKnowledgeBase();
  const quote = await generateQuoteFromBundle(bundle, knowledge);
  const quoteStatus = deriveQuoteStatus(quote);

  if (!canPersistToSupabase()) {
    return NextResponse.json({
      ok: true,
      quote,
      next_job_status: "Quote Drafted"
    });
  }

  const supabase = createSupabaseAdminClient();
  const { versionNumber, quoteRef } = await getNextQuoteVersionAndRef(body.job_id);

  const { data: quoteRecord, error: quoteError } = await supabase
    .from("quotes")
    .insert({
      job_id: body.job_id,
      quote_ref: quoteRef,
      version_number: versionNumber,
      roof_report: quote.roof_report,
      scope_of_works: quote.scope_of_works,
      cost_breakdown: quote.cost_breakdown,
      subtotal: quote.subtotal,
      vat_amount: quote.vat_amount,
      total: quote.total,
      guarantee_text: quote.guarantee_text,
      exclusions: quote.exclusions,
      terms: quote.terms,
      customer_email_subject: quote.customer_email_subject,
      customer_email_body: quote.customer_email_body,
      status: quoteStatus,
      missing_info: quote.missing_info,
      pricing_notes: quote.pricing_notes,
      confidence: quote.confidence,
      model_name: quote.model_name,
      prompt_version: quote.prompt_version
    })
    .select("*")
    .single();

  if (quoteError || !quoteRecord) {
    return NextResponse.json({ ok: false, error: quoteError?.message ?? "Unable to save quote." }, { status: 500 });
  }

  if (quote.materials.length > 0) {
    await supabase.from("materials").insert(
      quote.materials.map((material) => ({
        job_id: body.job_id,
        quote_id: quoteRecord.id,
        ...material
      }))
    );
  }

  await supabase
    .from("jobs")
    .update({
      status: "Quote Drafted",
      estimated_value: quote.total,
      updated_at: new Date().toISOString()
    })
    .eq("id", body.job_id);

  return NextResponse.json({
    ok: true,
    quote: quoteRecord,
    next_job_status: "Quote Drafted"
  });
}
