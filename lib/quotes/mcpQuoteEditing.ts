import {
  calculateOptionNet,
  calculateOptionVat,
  normaliseQuoteCostLine,
  normaliseQuoteOption
} from "@/lib/quotes/value";
import type { CostLineItem, QuoteOption, QuotePricingMode, QuoteRecord } from "@/lib/types";

export type QuoteLineChange = {
  action: "add" | "update" | "remove";
  option_id?: string | null;
  line_number?: number | null;
  item?: string;
  quantity?: number;
  unit?: string;
  unit_rate?: number;
  cost?: number;
  vat_applicable?: boolean;
  notes?: string;
  pricing_category?: string;
  quote_section?: string;
  billed_separately?: boolean;
  billed_separately_note?: string;
};

export type QuoteEditableFields = {
  customer_pricing_mode?: QuotePricingMode;
  roof_report?: string;
  scope_of_works?: string;
  guarantee_text?: string;
  exclusions?: string;
  terms?: string;
  customer_email_subject?: string;
  customer_email_body?: string;
  confidence?: "Low" | "Medium" | "High";
  missing_info?: string[];
  pricing_note?: string;
};

export type QuoteOptionUpdate = {
  option_id: string;
  label?: string;
  title?: string;
  short_description?: string;
  description?: string;
  recommended?: boolean;
};

export type QuoteUpdatePlan = QuoteEditableFields & {
  line_changes?: QuoteLineChange[];
  option_updates?: QuoteOptionUpdate[];
};

function money(value: unknown) {
  const number = Number(value ?? 0);
  if (!Number.isFinite(number) || number < 0) throw new Error("Quote amounts must be valid non-negative numbers.");
  return Math.round(number * 100) / 100;
}

function updatedLine(existing: CostLineItem | null, change: QuoteLineChange): CostLineItem {
  const quantity = change.quantity ?? existing?.quantity;
  const unitRate = change.unit_rate ?? existing?.unit_rate;
  const explicitCost = change.cost ?? existing?.cost ?? 0;
  const cost = change.cost !== undefined ? money(change.cost) : quantity !== undefined && unitRate !== undefined ? money(quantity * unitRate) : money(explicitCost);
  const item = change.item?.trim() || existing?.item?.trim();
  if (!item) throw new Error("Every added or updated quote line needs an item description.");
  if (quantity !== undefined && (!Number.isFinite(quantity) || quantity <= 0)) throw new Error(`Quantity for "${item}" must be greater than zero.`);
  if (unitRate !== undefined && (!Number.isFinite(unitRate) || unitRate < 0)) throw new Error(`Unit rate for "${item}" cannot be negative.`);

  return normaliseQuoteCostLine({
    ...(existing ?? { item, cost: 0, vat_applicable: true, notes: "" }),
    item,
    quantity,
    unit: change.unit ?? existing?.unit,
    unit_rate: unitRate,
    cost,
    vat_applicable: change.vat_applicable ?? existing?.vat_applicable ?? true,
    notes: change.notes ?? existing?.notes ?? "",
    pricing_category: change.pricing_category ?? existing?.pricing_category,
    quote_section: change.quote_section ?? existing?.quote_section,
    billed_separately: change.billed_separately ?? existing?.billed_separately,
    billed_separately_note: change.billed_separately_note ?? existing?.billed_separately_note
  });
}

export function applyQuoteLineChanges(lines: CostLineItem[], changes: QuoteLineChange[]) {
  const result = lines.map((line) => ({ ...line }));
  for (const change of changes) {
    if (change.action === "add") {
      result.push(updatedLine(null, change));
      continue;
    }
    const index = Number(change.line_number ?? 0) - 1;
    if (!Number.isInteger(index) || index < 0 || index >= result.length) {
      throw new Error(`line_number must identify an existing 1-based quote line for ${change.action}.`);
    }
    if (change.action === "remove") result.splice(index, 1);
    else result[index] = updatedLine(result[index], change);
  }
  return result;
}

function totals(lines: CostLineItem[], vatRate: number) {
  const subtotal = calculateOptionNet({ cost_breakdown: lines });
  const vat_amount = calculateOptionVat({ cost_breakdown: lines }, vatRate);
  return { subtotal, vat_amount, total: Math.round((subtotal + vat_amount) * 100) / 100 };
}

export function buildQuoteUpdate(quote: QuoteRecord, plan: QuoteUpdatePlan, vatRate: number) {
  const baseChanges = (plan.line_changes ?? []).filter((change) => !change.option_id);
  const nextLines = applyQuoteLineChanges(quote.cost_breakdown ?? [], baseChanges);
  const optionUpdates = new Map((plan.option_updates ?? []).map((update) => [update.option_id, update]));
  const unknownOptionUpdate = (plan.option_updates ?? []).find((update) => !(quote.options ?? []).some((option) => option.id === update.option_id));
  if (unknownOptionUpdate) throw new Error(`Quote option ${unknownOptionUpdate.option_id} was not found.`);
  const recommendedOption = (plan.option_updates ?? []).find((update) => update.recommended === true)?.option_id;
  const nextOptions: QuoteOption[] = (quote.options ?? []).map((option, index) => {
    const optionChanges = (plan.line_changes ?? []).filter((change) => change.option_id === option.id);
    const cost_breakdown = applyQuoteLineChanges(option.cost_breakdown ?? [], optionChanges);
    const metadata = optionUpdates.get(option.id);
    const nextOption = {
      ...option,
      ...(metadata?.label !== undefined ? { label: metadata.label.trim() } : {}),
      ...(metadata?.title !== undefined ? { title: metadata.title.trim() } : {}),
      ...(metadata?.short_description !== undefined ? { short_description: metadata.short_description.trim() } : {}),
      ...(metadata?.description !== undefined ? { description: metadata.description.trim() } : {}),
      ...(metadata?.recommended !== undefined ? { recommended: metadata.recommended } : {}),
      ...(recommendedOption ? { recommended: option.id === recommendedOption } : {}),
      cost_breakdown
    };
    const normalised = normaliseQuoteOption(nextOption, index);
    return {
      ...normalised,
      ...(metadata?.label !== undefined ? { label: metadata.label.trim() } : {}),
      ...(metadata?.title !== undefined ? { title: metadata.title.trim() } : {}),
      ...(metadata?.short_description !== undefined ? { short_description: metadata.short_description.trim() } : {}),
      ...(metadata?.description !== undefined ? { description: metadata.description.trim() } : {}),
      ...(metadata?.recommended !== undefined ? { recommended: metadata.recommended } : {}),
      ...(recommendedOption ? { recommended: option.id === recommendedOption } : {}),
      ...totals(cost_breakdown, vatRate)
    };
  });
  const knownOptionIds = new Set(nextOptions.map((option) => option.id));
  const unknownOption = (plan.line_changes ?? []).find((change) => change.option_id && !knownOptionIds.has(change.option_id));
  if (unknownOption) throw new Error(`Quote option ${unknownOption.option_id} was not found.`);
  const baseTotals = totals(nextLines, vatRate);

  return {
    patch: {
      ...(plan.customer_pricing_mode !== undefined ? { customer_pricing_mode: plan.customer_pricing_mode } : {}),
      ...(plan.roof_report !== undefined ? { roof_report: plan.roof_report.trim() } : {}),
      ...(plan.scope_of_works !== undefined ? { scope_of_works: plan.scope_of_works.trim() } : {}),
      ...(plan.guarantee_text !== undefined ? { guarantee_text: plan.guarantee_text.trim() } : {}),
      ...(plan.exclusions !== undefined ? { exclusions: plan.exclusions.trim() } : {}),
      ...(plan.terms !== undefined ? { terms: plan.terms.trim() } : {}),
      ...(plan.customer_email_subject !== undefined ? { customer_email_subject: plan.customer_email_subject.trim() } : {}),
      ...(plan.customer_email_body !== undefined ? { customer_email_body: plan.customer_email_body.trim() } : {}),
      ...(plan.confidence !== undefined ? { confidence: plan.confidence } : {}),
      ...(plan.missing_info !== undefined ? { missing_info: plan.missing_info.map((item) => item.trim()).filter(Boolean) } : {}),
      ...(plan.pricing_note?.trim() ? { pricing_notes: [...new Set([...(quote.pricing_notes ?? []), plan.pricing_note.trim()])] } : {}),
      cost_breakdown: nextLines,
      options: nextOptions,
      ...baseTotals
    },
    preview: {
      pricing_mode: {
        previous: quote.customer_pricing_mode ?? ((quote.options?.length ?? 0) >= 2 ? "options" : "single"),
        updated: plan.customer_pricing_mode ?? quote.customer_pricing_mode ?? ((quote.options?.length ?? 0) >= 2 ? "options" : "single")
      },
      previous: { subtotal: Number(quote.subtotal ?? 0), vat_amount: Number(quote.vat_amount ?? 0), total: Number(quote.total ?? 0) },
      updated: baseTotals,
      base_lines: nextLines.map((line, index) => ({ line_number: index + 1, ...line })),
      options: nextOptions.map((option) => ({ id: option.id, label: option.label, title: option.title, subtotal: option.subtotal, vat_amount: option.vat_amount, total: option.total, lines: option.cost_breakdown.map((line, index) => ({ line_number: index + 1, ...line })) }))
    }
  };
}
