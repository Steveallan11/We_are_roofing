import { NextResponse } from "next/server";
import { getHistoricalQuotes, getJobBundle, getKnowledgeBase, getPricingRules } from "@/lib/data";
import { persistQuoteArtifacts } from "@/lib/quote-engine";
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

  if (!bundle.survey) {
    return NextResponse.json({ ok: false, error: "A survey must be saved before a quote can be generated." }, { status: 400 });
  }

  const [knowledge, historicalQuotes, pricingRules] = await Promise.all([
    getKnowledgeBase(),
    getHistoricalQuotes(),
    getPricingRules()
  ]);
  const quote = await generateQuoteFromBundle(bundle, knowledge, historicalQuotes, pricingRules);
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

  await supabase.from("materials").delete().eq("job_id", body.job_id).is("quote_id", null);

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

  if (bundle.photos.length > 0) {
    const attachmentRows = bundle.photos.map((photo) => ({
      quote_id: quoteRecord.id,
      job_photo_id: photo.id,
      attachment_type: "job_photo"
    }));
    await supabase.from("quote_attachments").delete().eq("quote_id", quoteRecord.id);
    await supabase.from("quote_attachments").insert(attachmentRows);
  }

  const updatedBundle = {
    ...bundle,
    quote: quoteRecord
  };
  const artifacts = await persistQuoteArtifacts(supabase, updatedBundle, quoteRecord);

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
    quote: {
      ...quoteRecord,
      pdf_url: artifacts.pdfUrl ?? quoteRecord.pdf_url
    },
    next_job_status: "Quote Drafted",
    warning:
      artifacts.pdfUrl || artifacts.htmlUrl
        ? null
        : artifacts.pdfError || artifacts.bucketError || "Quote drafted, but document snapshots could not be uploaded."
  });
}
