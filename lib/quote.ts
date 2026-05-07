import OpenAI from "openai";
import type { GeneratedQuote, JobBundle, KnowledgeBaseRecord, MaterialLineItem } from "@/lib/types";

const PROMPT_VERSION = "weareroofing-v1";

function buildFallbackMaterials(bundle: JobBundle): MaterialLineItem[] {
  const roofType = bundle.job.roof_type ?? "Other";
  if (roofType === "Flat") {
    return [
      {
        item_name: "Danosa Option 3 system",
        category: "Flat Roof",
        quantity: 20,
        unit: "m2",
        required_status: "Definitely Needed",
        notes: "Allow for torch-on underlay and cap sheet"
      },
      {
        item_name: "18mm OSB deck allowance",
        category: "Decking",
        quantity: 4,
        unit: "sheets",
        required_status: "May Be Needed",
        notes: "Only if soft decking confirmed on strip"
      }
    ];
  }

  return [
    {
      item_name: "Roofing sundries",
      category: "General",
      quantity: 1,
      unit: "lot",
      required_status: "Check On Site",
      notes: "Finalise after approval"
    }
  ];
}

export async function generateQuoteFromBundle(
  bundle: JobBundle,
  knowledgeBase: KnowledgeBaseRecord[]
): Promise<GeneratedQuote & { model_name: string; prompt_version: string }> {
  if (!process.env.OPENAI_API_KEY) {
    return buildFallbackQuote(bundle);
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const knowledge = knowledgeBase
    .map((record) => `${record.category}: ${record.title}\n${record.content}`)
    .join("\n\n");

  const prompt = `
You are the We Are Roofing Expert Quote Builder.
Use the survey and knowledge base below to produce a professional quote in conservative UK roofer language.
Return JSON only.

Business:
${JSON.stringify(bundle.business, null, 2)}

Customer:
${JSON.stringify(bundle.customer, null, 2)}

Job:
${JSON.stringify(bundle.job, null, 2)}

Survey:
${JSON.stringify(bundle.survey, null, 2)}

Photo metadata:
${JSON.stringify(bundle.photos, null, 2)}

Knowledge base:
${knowledge}
`;

  const response = await client.responses.create({
    model: "gpt-4.1",
    input: prompt,
    text: {
      format: {
        type: "json_schema",
        name: "generated_quote",
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            roof_report: { type: "string" },
            scope_of_works: { type: "string" },
            cost_breakdown: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  item: { type: "string" },
                  cost: { type: "number" },
                  vat_applicable: { type: "boolean" },
                  notes: { type: "string" }
                },
                required: ["item", "cost", "vat_applicable", "notes"]
              }
            },
            subtotal: { type: "number" },
            vat_amount: { type: "number" },
            total: { type: "number" },
            guarantee_text: { type: "string" },
            exclusions: { type: "string" },
            terms: { type: "string" },
            customer_email_subject: { type: "string" },
            customer_email_body: { type: "string" },
            missing_info: { type: "array", items: { type: "string" } },
            pricing_notes: { type: "array", items: { type: "string" } },
            confidence: { type: "string", enum: ["Low", "Medium", "High"] },
            materials: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  item_name: { type: "string" },
                  category: { type: "string" },
                  quantity: { type: "number" },
                  unit: { type: "string" },
                  required_status: {
                    type: "string",
                    enum: ["Definitely Needed", "May Be Needed", "Optional", "Check On Site"]
                  },
                  notes: { type: "string" },
                  supplier: { type: ["string", "null"] },
                  estimated_price: { type: ["number", "null"] },
                  link: { type: ["string", "null"] }
                },
                required: ["item_name", "category", "quantity", "unit", "required_status", "notes", "supplier", "estimated_price", "link"]
              }
            }
          },
          required: [
            "roof_report",
            "scope_of_works",
            "cost_breakdown",
            "subtotal",
            "vat_amount",
            "total",
            "guarantee_text",
            "exclusions",
            "terms",
            "customer_email_subject",
            "customer_email_body",
            "missing_info",
            "pricing_notes",
            "confidence",
            "materials"
          ]
        }
      }
    }
  });

  const raw = response.output_text;
  const parsed = JSON.parse(raw) as GeneratedQuote;
  return normalizeQuote(parsed, bundle);
}

function buildFallbackQuote(bundle: JobBundle): GeneratedQuote & { model_name: string; prompt_version: string } {
  const subtotal = bundle.job.estimated_value ?? 3200;
  const vatAmount = Math.round(subtotal * (bundle.business.vat_rate / 100) * 100) / 100;
  const total = subtotal + vatAmount;

  return {
    roof_report:
      "Having been out to look at the roof of the above property we offer you the following information with costs for your perusal. The survey points to weathered roofing elements and the need for a practical long-term remedy rather than a short patch repair.",
    scope_of_works:
      "Based on all of the above we propose the following works: provide safe access, strip back the affected area, renew the failed roofing detail with suitable materials, check the surrounding substrate, and leave the roof watertight and tidy.",
    cost_breakdown: [
      {
        item: "Main works",
        cost: subtotal,
        vat_applicable: true,
        notes: "Final scope to be confirmed on approval"
      }
    ],
    subtotal,
    vat_amount: vatAmount,
    total,
    guarantee_text: "Guarantee wording to be confirmed once the final system is agreed.",
    exclusions: "Any hidden defects uncovered once opened up are excluded until confirmed on site.",
    terms: bundle.business.payment_terms,
    customer_email_subject: `Your quotation from ${bundle.business.business_name}`,
    customer_email_body: "Please find our draft quotation attached for review. If you have any questions, please let us know.",
    missing_info: bundle.photos.length === 0 ? ["No site photos uploaded yet"] : [],
    pricing_notes: ["Fallback quote generated because OPENAI_API_KEY is not configured in this environment."],
    confidence: bundle.photos.length === 0 ? "Low" : "Medium",
    materials: buildFallbackMaterials(bundle),
    model_name: "fallback-template",
    prompt_version: PROMPT_VERSION
  };
}

function normalizeQuote(
  quote: GeneratedQuote,
  bundle: JobBundle
): GeneratedQuote & { model_name: string; prompt_version: string } {
  const subtotal = Math.round(quote.cost_breakdown.reduce((sum, item) => sum + item.cost, 0) * 100) / 100;
  const vatAmount =
    Math.round(
      quote.cost_breakdown
        .filter((item) => item.vat_applicable)
        .reduce((sum, item) => sum + item.cost * (bundle.business.vat_rate / 100), 0) * 100
    ) / 100;

  return {
    ...quote,
    subtotal,
    vat_amount: vatAmount,
    total: subtotal + vatAmount,
    materials: quote.materials.length > 0 ? quote.materials : buildFallbackMaterials(bundle),
    model_name: "gpt-4.1",
    prompt_version: PROMPT_VERSION
  };
}
