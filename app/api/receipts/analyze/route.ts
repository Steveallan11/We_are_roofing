import { NextResponse } from "next/server";
import OpenAI from "openai";
import sharp from "sharp";
import { requireAdminApi } from "@/lib/auth";
import type { ReceiptAnalysis } from "@/lib/receipts/analyseReceiptFile";
import type { JobExpenseCategory } from "@/lib/types";

const MAX_FILE_SIZE = 15 * 1024 * 1024;
const CATEGORIES: JobExpenseCategory[] = [
  "materials",
  "labour",
  "subcontractor",
  "plant_hire",
  "skip_hire",
  "scaffolding",
  "fuel",
  "waste",
  "other"
];

export async function POST(request: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ ok: false, error: "OpenAI is not configured for receipt analysis." }, { status: 503 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "Choose a receipt image to analyse." }, { status: 400 });
  }
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ ok: false, error: "AI autofill currently supports receipt photos. PDFs can still be filed manually." }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ ok: false, error: "Receipt images must be no larger than 15MB." }, { status: 400 });
  }

  try {
    const source = Buffer.from(await file.arrayBuffer());
    const image = await sharp(source)
      .rotate()
      .resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 88 })
      .toBuffer();

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_RECEIPT_MODEL || "gpt-4o-mini",
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You extract accounting data from UK supplier receipts and invoices for a roofing business. Read only what is visible. Never invent a supplier, date, VAT, or amount. The amount_total must be the final gross amount paid or due, including VAT. vat_amount must be the explicitly printed VAT total, or a VAT amount that is unambiguously shown by the document arithmetic; otherwise return null. Return valid JSON only."
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyse this receipt and return this exact JSON structure:
{
  "supplier_name": "string or null",
  "description": "short plain-English purchase description",
  "category": "materials|labour|subcontractor|plant_hire|skip_hire|scaffolding|fuel|waste|other",
  "amount_total": "number or null",
  "vat_amount": "number or null",
  "receipt_date": "YYYY-MM-DD or null",
  "invoice_number": "string or null",
  "confidence": "high|medium|low",
  "review_notes": ["short warnings about unclear, missing, or inferred values"]
}`
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${image.toString("base64")}`,
                detail: "high"
              }
            }
          ]
        }
      ]
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error("OpenAI did not return receipt data.");
    const parsed = JSON.parse(content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim()) as Record<string, unknown>;
    const analysis = normaliseAnalysis(parsed);
    return NextResponse.json({ ok: true, analysis });
  } catch (error) {
    console.error("Receipt analysis failed:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "AI could not read this receipt." },
      { status: 500 }
    );
  }
}

function normaliseAnalysis(value: Record<string, unknown>): ReceiptAnalysis {
  const category = String(value.category || "other") as JobExpenseCategory;
  const confidence = String(value.confidence || "low");
  return {
    supplier_name: nullableText(value.supplier_name),
    description: nullableText(value.description) || "Receipt / supplier invoice",
    category: CATEGORIES.includes(category) ? category : "other",
    amount_total: nullableMoney(value.amount_total),
    vat_amount: nullableMoney(value.vat_amount),
    receipt_date: normaliseDate(value.receipt_date),
    invoice_number: nullableText(value.invoice_number),
    confidence: confidence === "high" || confidence === "medium" ? confidence : "low",
    review_notes: Array.isArray(value.review_notes)
      ? value.review_notes.map((note) => String(note).trim()).filter(Boolean).slice(0, 5)
      : []
  };
}

function nullableText(value: unknown) {
  const text = String(value ?? "").trim();
  return text && text.toLowerCase() !== "null" ? text : null;
}

function nullableMoney(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const normalised = typeof value === "string" ? value.replace(/[^0-9.-]/g, "") : value;
  if (normalised === "") return null;
  const amount = Number(normalised);
  return Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 100) / 100 : null;
}

function normaliseDate(value: unknown) {
  const date = nullableText(value);
  return date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
}
