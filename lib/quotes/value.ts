import type { CostLineItem, Job, QuoteOption, QuoteRecord } from "@/lib/types";
import { currency } from "@/lib/utils";

type QuoteValue = Pick<QuoteRecord, "total" | "options" | "accepted_option_id">;
type JobValue = Pick<Job, "estimated_value" | "final_value" | "status"> & {
  quote?: QuoteValue | null;
};

export function getPositiveNumber(value: unknown): number | null {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

export function getLowestOptionTotal(options?: QuoteOption[] | null): number | null {
  const totals = (options ?? []).map((option) => getOptionTotal(option)).filter((value): value is number => value !== null);
  return totals.length > 0 ? Math.min(...totals) : null;
}

export function getAcceptedOptionTotal(quote?: Pick<QuoteValue, "options" | "accepted_option_id"> | null): number | null {
  if (!quote?.accepted_option_id) return null;
  const acceptedOption = (quote.options ?? []).find((option) => option.id === quote.accepted_option_id);
  return acceptedOption ? getOptionTotal(acceptedOption) : null;
}

export function getQuotePipelineValue(quote?: QuoteValue | null): number | null {
  if (!quote) return null;
  return getAcceptedOptionTotal(quote) ?? getLowestOptionTotal(quote.options) ?? getPositiveNumber(quote.total);
}

export function getJobPipelineValue(job: JobValue): number | null {
  if (job.status === "Completed") {
    return getPositiveNumber(job.final_value) ?? getPositiveNumber(job.estimated_value) ?? getQuotePipelineValue(job.quote);
  }

  return getQuotePipelineValue(job.quote) ?? getPositiveNumber(job.estimated_value);
}

export function isFromOptionValue(job: JobValue): boolean {
  return Boolean(job.quote?.options?.length && !job.quote.accepted_option_id && getLowestOptionTotal(job.quote.options));
}

export function isQuoteFromOptionValue(quote?: QuoteValue | null): boolean {
  return Boolean(quote?.options?.length && !quote.accepted_option_id && getLowestOptionTotal(quote.options));
}

export function getOptionTotal(option: QuoteOption): number | null {
  const calculated = calculateOptionTotal(option);
  if (process.env.NODE_ENV !== "production") {
    const stored = getPositiveNumber(option.total);
    if (stored && Math.abs(stored - calculated) > 0.01) {
      console.warn(`Quote option total mismatch for ${option.id}: stored ${stored}, calculated ${calculated}`);
    }
  }

  return getPositiveNumber(calculated) ?? getPositiveNumber(option.total) ?? getPositiveNumber(option.subtotal + option.vat_amount);
}

export function formatCurrency(value: number) {
  return currency(value);
}

export function calculateVat(net: number, vatRate = 0.2) {
  return roundMoney(net * vatRate);
}

export function calculateLineItemGross(item: CostLineItem, vatRate = 0.2) {
  const net = getLineItemNet(item);
  return roundMoney(net + (item.vat_applicable === false ? 0 : calculateVat(net, vatRate)));
}

export function calculateOptionTotal(option: Pick<QuoteOption, "cost_breakdown">) {
  return roundMoney((option.cost_breakdown ?? []).reduce((sum, item) => sum + calculateLineItemGross(item), 0));
}

export type QuotePriceSummaryRow = {
  id: "roof_works" | "access";
  label: string;
  vatLabel: string;
  net: number;
  vat: number;
  gross: number;
};

export type QuotePriceDetailRow = {
  id: string;
  category: QuotePriceSummaryRow["id"];
  label: string;
  net: number;
  vat: number;
  gross: number;
};

export function buildQuoteOptionPriceSummary(option: Pick<QuoteOption, "cost_breakdown">): QuotePriceSummaryRow[] {
  const groups = new Map<QuotePriceSummaryRow["id"], QuotePriceSummaryRow>();

  for (const item of option.cost_breakdown ?? []) {
    const net = getLineItemNet(item);
    if (!net) continue;

    const groupId = getLineItemCategory(item);
    const existing = groups.get(groupId) ?? {
      id: groupId,
      label: getDefaultSummaryLabel(groupId),
      vatLabel: getDefaultSummaryVatLabel(groupId),
      net: 0,
      vat: 0,
      gross: 0
    };

    existing.label = pickBetterSummaryLabel(existing.label, getLineItemSummaryLabel(item, groupId), groupId);
    existing.vatLabel = `VAT on ${existing.label.toLowerCase()}`;
    existing.net = roundMoney(existing.net + net);
    existing.vat = roundMoney(existing.vat + (item.vat_applicable === false ? 0 : calculateVat(net)));
    existing.gross = roundMoney(existing.net + existing.vat);
    groups.set(groupId, existing);
  }

  return (["roof_works", "access"] as const).map((id) => groups.get(id)).filter((row): row is QuotePriceSummaryRow => Boolean(row));
}

export function buildQuoteOptionPriceDetailRows(option: Pick<QuoteOption, "cost_breakdown">): QuotePriceDetailRow[] {
  return (option.cost_breakdown ?? [])
    .map((item, index) => {
      const net = getLineItemNet(item);
      if (!net) return null;
      const category = getLineItemCategory(item);
      const label = getDetailedLineItemLabel(item, category);
      const vat = item.vat_applicable === false ? 0 : calculateVat(net);

      return {
        id: `${category}-${index}-${label}`,
        category,
        label,
        net,
        vat,
        gross: roundMoney(net + vat)
      };
    })
    .filter((row): row is QuotePriceDetailRow => Boolean(row));
}

function getLineItemNet(item: CostLineItem) {
  return roundMoney(Math.max(0, Number(item.cost || 0)));
}

function getLineItemCategory(item: CostLineItem): QuotePriceSummaryRow["id"] {
  return getQuoteLineItemCategory(item);
}

export function getQuoteLineItemCategory(item: CostLineItem): QuotePriceSummaryRow["id"] {
  const identity = `${item.quote_section ?? ""} ${item.item ?? ""} ${item.source_label ?? ""}`.toLowerCase();
  const category = `${item.pricing_category ?? ""}`.toLowerCase();

  if (/\b(scaffold|access|temporary roof|temp roof|weather protection|protection system|edge protection|tower)\b/.test(`${identity} ${category}`)) {
    return "access";
  }

  if (/\b(roof works|main roof|pitched|flat roof|tile|slate|leadwork|gutter|ridge|hip|valley|verge|eaves)\b/.test(identity)) {
    return "roof_works";
  }

  return "roof_works";
}

function getLineItemSummaryLabel(item: CostLineItem, category: QuotePriceSummaryRow["id"]) {
  const labelSource = [item.quote_section, item.item, item.pricing_category, item.source_label].find((value) => value?.trim())?.trim();
  if (!labelSource) return getDefaultSummaryLabel(category);

  const normalised = labelSource.toLowerCase();
  if (category === "access") {
    if (normalised.includes("temporary roof") || normalised.includes("weather protection")) {
      return "Temporary roof/weather protection system";
    }
    if (normalised.includes("scaffold")) {
      return "Standard scaffold";
    }
    return labelSource;
  }

  return "Roof works";
}

function getDetailedLineItemLabel(item: CostLineItem, category: QuotePriceSummaryRow["id"]) {
  const labelSource = [item.quote_section, item.item, item.source_label, item.pricing_category].find((value) => value?.trim())?.trim();
  if (!labelSource) return getDefaultSummaryLabel(category);

  const normalised = labelSource.toLowerCase();
  if (category === "roof_works" && /roof works|main roof|full roof|roof refurbishment/.test(normalised)) {
    return labelSource;
  }
  if (category === "roof_works") {
    return labelSource;
  }
  if (normalised.includes("temporary roof") || normalised.includes("weather protection")) {
    return "Temporary roof/weather protection system";
  }
  if (normalised.includes("scaffold")) {
    return "Standard scaffold";
  }
  return labelSource;
}

function pickBetterSummaryLabel(current: string, next: string, category: QuotePriceSummaryRow["id"]) {
  if (category === "roof_works") return "Roof works";
  if (current === getDefaultSummaryLabel(category)) return next;
  if (current === "Standard scaffold" && next.includes("Temporary roof")) return next;
  return current;
}

function getDefaultSummaryLabel(category: QuotePriceSummaryRow["id"]) {
  return category === "access" ? "Scaffold/access allowance" : "Roof works";
}

function getDefaultSummaryVatLabel(category: QuotePriceSummaryRow["id"]) {
  return `VAT on ${getDefaultSummaryLabel(category).toLowerCase()}`;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}
