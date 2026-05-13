import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hydrateRoofSurvey } from "@/lib/roof-surveys";
import { buildRoofSurveyBom, toMaterialRows, toQuoteCostBreakdown } from "@/lib/survey/geometry";
import { canPersistToSupabase, getNextQuoteVersionAndRef } from "@/lib/workflows";

type Props = {
  params: Promise<{ surveyId: string }>;
};

export async function POST(_: Request, { params }: Props) {
  const { surveyId } = await params;
  const survey = await hydrateRoofSurvey(surveyId);
  const bom = buildRoofSurveyBom(survey);

  if (bom.length === 0) {
    return NextResponse.json({ ok: false, error: "The roof survey has no measurable bill of quantities yet." }, { status: 400 });
  }

  const quoteUrl = `/jobs/${survey.job_id}/quote?prefill=roof-survey&surveyId=${surveyId}`;

  if (!canPersistToSupabase()) {
    return NextResponse.json({ ok: true, quote_url: quoteUrl, imported_items: bom.length });
  }

  const supabase = createSupabaseAdminClient();
  const [jobResult, customerResult, existingQuoteResult] = await Promise.all([
    supabase.from("jobs").select("id, customer_id, property_address, job_title, job_ref, status").eq("id", survey.job_id).single(),
    supabase
      .from("jobs")
      .select("customer_id")
      .eq("id", survey.job_id)
      .single()
      .then(async (jobLookup) => {
        if (!jobLookup.data?.customer_id) return { data: null, error: jobLookup.error };
        return supabase.from("customers").select("full_name").eq("id", jobLookup.data.customer_id).maybeSingle();
      }),
    supabase.from("quotes").select("*").eq("job_id", survey.job_id).order("version_number", { ascending: false }).limit(1).maybeSingle()
  ]);

  if (jobResult.error || !jobResult.data) {
    return NextResponse.json({ ok: false, error: jobResult.error?.message ?? "Job not found." }, { status: 404 });
  }

  const costBreakdown = toQuoteCostBreakdown(bom);
  const basePayload = {
    roof_report:
      existingQuoteResult.data?.roof_report ??
      `Measured roof takeoff completed for ${customerResult.data?.full_name ?? jobResult.data.job_title}. Review the traced sections, measured runs, and roof features before final pricing.`,
    scope_of_works:
      existingQuoteResult.data?.scope_of_works ??
      "Measured roof quantities have been imported from the roof survey tool. Add rates, check waste factors, and finalise the wording before approval.",
    cost_breakdown: costBreakdown,
    subtotal: 0,
    vat_amount: 0,
    total: 0,
    guarantee_text: existingQuoteResult.data?.guarantee_text ?? "Guarantee wording to be confirmed during quote review.",
    exclusions: existingQuoteResult.data?.exclusions ?? "Final exclusions to be confirmed during quote review.",
    terms: existingQuoteResult.data?.terms ?? "Standard terms to be confirmed during quote review.",
    customer_email_subject: existingQuoteResult.data?.customer_email_subject ?? `Measured roof quote draft for ${jobResult.data.property_address}`,
    customer_email_body:
      existingQuoteResult.data?.customer_email_body ?? "We have prepared the draft quote from the measured roof survey. Please review the pricing and wording before sending.",
    missing_info: existingQuoteResult.data?.missing_info ?? [],
    pricing_notes: [
      `Imported ${bom.length} measured BOM item${bom.length === 1 ? "" : "s"} from roof survey ${survey.project_name}.`,
      ...(existingQuoteResult.data?.pricing_notes ?? [])
    ],
    confidence: existingQuoteResult.data?.confidence ?? "Medium",
    updated_at: new Date().toISOString()
  };

  let quoteId = existingQuoteResult.data?.id as string | undefined;
  if (quoteId) {
    const { error } = await supabase.from("quotes").update(basePayload).eq("id", quoteId);
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
  } else {
    const { versionNumber, quoteRef } = await getNextQuoteVersionAndRef(survey.job_id);
    const { data, error } = await supabase
      .from("quotes")
      .insert({
        job_id: survey.job_id,
        quote_ref: quoteRef,
        version_number: versionNumber,
        status: "Draft",
        ...basePayload
      })
      .select("*")
      .single();

    if (error || !data) {
      return NextResponse.json({ ok: false, error: error?.message ?? "Unable to create the quote draft." }, { status: 500 });
    }
    quoteId = data.id;
  }

  await supabase.from("materials").delete().eq("job_id", survey.job_id).eq("quote_id", quoteId);
  const materials = toMaterialRows(survey.job_id, quoteId ?? null, bom);
  if (materials.length > 0) {
    const { error } = await supabase.from("materials").insert(materials);
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
  }

  await supabase
    .from("jobs")
    .update({
      status: "Quote Drafted",
      updated_at: new Date().toISOString()
    })
    .eq("id", survey.job_id);

  return NextResponse.json({ ok: true, quote_url: quoteUrl, imported_items: bom.length });
}
