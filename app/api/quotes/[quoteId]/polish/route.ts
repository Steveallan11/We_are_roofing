import OpenAI from "openai";
import { NextResponse } from "next/server";
import { getJobBundle } from "@/lib/data";
import { requireAdminApi } from "@/lib/auth";
import { getLatestRoofSurvey } from "@/lib/roof-surveys";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { canPersistToSupabase } from "@/lib/workflows";
import type { CostLineItem } from "@/lib/types";

type Props = {
  params: Promise<{ quoteId: string }>;
};

type PolishBody = {
  roof_report?: string;
  scope_of_works?: string;
  guarantee_text?: string;
  exclusions?: string;
  terms?: string;
  customer_email_subject?: string;
  customer_email_body?: string;
  cost_breakdown?: CostLineItem[];
  missing_info?: string[];
  pricing_notes?: string[];
};

type PolishedQuoteWording = {
  roof_report: string;
  scope_of_works: string;
  guarantee_text: string;
  exclusions: string;
  terms: string;
  customer_email_subject: string;
  customer_email_body: string;
  missing_info: string[];
  pricing_notes: string[];
};

export async function POST(request: Request, { params }: Props) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { quoteId } = await params;
  const body = (await request.json().catch(() => ({}))) as PolishBody;

  if (!canPersistToSupabase()) {
    return NextResponse.json({ ok: true, wording: buildFallbackWording(body) });
  }

  const supabase = createSupabaseAdminClient();
  const { data: quote, error } = await supabase.from("quotes").select("*").eq("id", quoteId).single();
  if (error || !quote) {
    return NextResponse.json({ ok: false, error: error?.message ?? "Quote not found." }, { status: 404 });
  }

  const bundle = await getJobBundle(quote.job_id);
  if (!bundle) {
    return NextResponse.json({ ok: false, error: "Related job not found." }, { status: 404 });
  }

  const roofSurvey = await getLatestRoofSurvey(quote.job_id);
  const draft = {
    roof_report: body.roof_report ?? quote.roof_report ?? "",
    scope_of_works: body.scope_of_works ?? quote.scope_of_works ?? "",
    guarantee_text: body.guarantee_text ?? quote.guarantee_text ?? "",
    exclusions: body.exclusions ?? quote.exclusions ?? "",
    terms: body.terms ?? quote.terms ?? "",
    customer_email_subject: body.customer_email_subject ?? quote.customer_email_subject ?? "",
    customer_email_body: body.customer_email_body ?? quote.customer_email_body ?? "",
    missing_info: body.missing_info ?? quote.missing_info ?? [],
    pricing_notes: body.pricing_notes ?? quote.pricing_notes ?? [],
    cost_breakdown: body.cost_breakdown?.length ? body.cost_breakdown : quote.cost_breakdown ?? []
  };

  const wording = process.env.OPENAI_API_KEY ? await polishWithOpenAI({ bundle, draft, roofSurvey }) : buildFallbackWording(draft);

  const { data: updatedQuote, error: updateError } = await supabase
    .from("quotes")
    .update({
      roof_report: wording.roof_report,
      scope_of_works: wording.scope_of_works,
      guarantee_text: wording.guarantee_text,
      exclusions: wording.exclusions,
      terms: wording.terms,
      customer_email_subject: wording.customer_email_subject,
      customer_email_body: wording.customer_email_body,
      missing_info: wording.missing_info,
      pricing_notes: wording.pricing_notes,
      updated_at: new Date().toISOString()
    })
    .eq("id", quoteId)
    .select("*")
    .single();

  if (updateError || !updatedQuote) {
    return NextResponse.json({ ok: false, error: updateError?.message ?? "Unable to save polished wording." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, wording, quote: updatedQuote });
}

async function polishWithOpenAI(opts: { bundle: NonNullable<Awaited<ReturnType<typeof getJobBundle>>>; draft: PolishBody & { cost_breakdown: CostLineItem[] }; roofSurvey: Awaited<ReturnType<typeof getLatestRoofSurvey>> }) {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const measuredRows = opts.draft.cost_breakdown.map((line) => ({
    quote_section: line.quote_section,
    item: line.item,
    measurement: line.measurement_label,
    quantity: line.quantity,
    unit: line.unit,
    price: line.cost,
    pricing_category: line.pricing_category,
    takeoff_notes: line.takeoff_notes || line.notes
  }));

  const prompt = `You are Andrew Bailey's quote-writing assistant for We Are Roofing UK Ltd.
Rewrite the saved quote wording into clear, customer-friendly British English.

Rules:
- Do not change prices, quantities, VAT, totals, or the cost breakdown.
- Use the measured takeoff rows as the structure for the scope.
- Use Andy's takeoff notes as context, but do not overclaim anything not evidenced.
- Write in proper paragraphs, not one dense block.
- Keep it practical, calm, direct, and professional.
- If a detail is uncertain, put it in missing_info rather than pretending.
- Return JSON only.

Customer:
${JSON.stringify(opts.bundle.customer, null, 2)}

Job:
${JSON.stringify(opts.bundle.job, null, 2)}

Latest roof takeoff notes:
${opts.roofSurvey?.notes || "No takeoff notes saved."}

Measured quote rows:
${JSON.stringify(measuredRows, null, 2)}

Current draft wording:
${JSON.stringify(
  {
    roof_report: opts.draft.roof_report,
    scope_of_works: opts.draft.scope_of_works,
    guarantee_text: opts.draft.guarantee_text,
    exclusions: opts.draft.exclusions,
    terms: opts.draft.terms,
    customer_email_subject: opts.draft.customer_email_subject,
    customer_email_body: opts.draft.customer_email_body,
    missing_info: opts.draft.missing_info,
    pricing_notes: opts.draft.pricing_notes
  },
  null,
  2
)}`;

  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
    input: prompt,
    text: {
      format: {
        type: "json_schema",
        name: "polished_quote_wording",
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            roof_report: { type: "string" },
            scope_of_works: { type: "string" },
            guarantee_text: { type: "string" },
            exclusions: { type: "string" },
            terms: { type: "string" },
            customer_email_subject: { type: "string" },
            customer_email_body: { type: "string" },
            missing_info: { type: "array", items: { type: "string" } },
            pricing_notes: { type: "array", items: { type: "string" } }
          },
          required: [
            "roof_report",
            "scope_of_works",
            "guarantee_text",
            "exclusions",
            "terms",
            "customer_email_subject",
            "customer_email_body",
            "missing_info",
            "pricing_notes"
          ]
        }
      }
    }
  });

  return JSON.parse(response.output_text) as PolishedQuoteWording;
}

function buildFallbackWording(draft: Partial<PolishedQuoteWording>): PolishedQuoteWording {
  return {
    roof_report: draft.roof_report || "We have reviewed the roof and prepared this quotation based on the information currently available.",
    scope_of_works: draft.scope_of_works || "The proposed works are set out in the measured cost breakdown below. Please review the scope and pricing before approval.",
    guarantee_text: draft.guarantee_text || "Guarantee details will be confirmed against the final agreed system and scope of works.",
    exclusions: draft.exclusions || "Hidden defects, rotten decking, structural issues, or additional works discovered once opened up are excluded unless specifically listed.",
    terms: draft.terms || "Standard We Are Roofing payment terms apply.",
    customer_email_subject: draft.customer_email_subject || "Your roofing quotation from We Are Roofing",
    customer_email_body: draft.customer_email_body || "Please find your roofing quotation ready for review. If you have any questions, reply here and we will be happy to help.",
    missing_info: draft.missing_info ?? [],
    pricing_notes: [...(draft.pricing_notes ?? []), "Wording polish fallback used because OPENAI_API_KEY is not configured."]
  };
}
