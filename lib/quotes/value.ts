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

export function calculateLineVat(item: CostLineItem, vatRate = 0.2) {
  return item.vat_applicable === false ? 0 : calculateVat(getLineItemNet(item), vatRate);
}

export function calculateLineItemGross(item: CostLineItem, vatRate = 0.2) {
  const net = getLineItemNet(item);
  return roundMoney(net + calculateLineVat(item, vatRate));
}

export function calculateOptionNet(option: Pick<QuoteOption, "cost_breakdown">) {
  return roundMoney((option.cost_breakdown ?? []).reduce((sum, item) => sum + getLineItemNet(item), 0));
}

export function calculateOptionVat(option: Pick<QuoteOption, "cost_breakdown">, vatRate = 0.2) {
  return roundMoney((option.cost_breakdown ?? []).reduce((sum, item) => sum + calculateLineVat(item, vatRate), 0));
}

export function calculateOptionTotal(option: Pick<QuoteOption, "cost_breakdown">) {
  return roundMoney(calculateOptionNet(option) + calculateOptionVat(option));
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

export type QuoteCustomerPriceRow = {
  id: string;
  label: string;
  net: number;
};

export type QuoteOptionPresentation = {
  optionName: string;
  optionType?: string;
  title: string;
  shortDescription: string;
  longDescription: string;
  recommended: boolean;
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

export function buildQuoteOptionCustomerRows(option: Pick<QuoteOption, "cost_breakdown">): QuoteCustomerPriceRow[] {
  return (option.cost_breakdown ?? [])
    .map((item, index) => {
      const net = getLineItemNet(item);
      if (!net) return null;
      return {
        id: `${item.source_id || item.item || "line"}-${index}`,
        label: getCustomerLineItemLabel(item),
        net
      };
    })
    .filter((row): row is QuoteCustomerPriceRow => Boolean(row));
}

export function getQuoteOptionPresentation(option: QuoteOption, index = 0): QuoteOptionPresentation {
  const optionName = getOptionName(option, index);
  const optionType = option.option_type || getOptionTypeFromId(option.id);
  const recommended = Boolean(option.recommended);

  if (optionType === "standard_scaffold") {
    return {
      optionName,
      optionType,
      title: option.title || "Standard Scaffold",
      shortDescription: option.short_description || "Best lower upfront cost",
      longDescription:
        option.description ||
        "A full roof refurbishment with standard scaffold access. This is the lower-cost option, but it does not include a temporary roof covering during the works.",
      recommended
    };
  }

  if (optionType === "temporary_roof_protection") {
    return {
      optionName,
      optionType,
      title: option.title || "Temporary Roof Protection",
      shortDescription: option.short_description || "Best protection during the works",
      longDescription:
        option.description ||
        "A full roof refurbishment with a temporary roof covering in place during the works. This gives the best weather protection and helps reduce delays.",
      recommended
    };
  }

  return {
    optionName,
    optionType,
    title: option.title || option.label || optionName,
    shortDescription: option.short_description || "Review this option",
    longDescription: option.description || "Review this option and the price summary below before deciding whether to proceed.",
    recommended
  };
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

export function getQuoteOptionTypeDefaults(optionType: string | undefined, index = 0) {
  if (optionType === "standard_scaffold") {
    return {
      id: "option-a",
      label: "Option A",
      title: "Standard Scaffold",
      short_description: "Best lower upfront cost",
      description:
        "A full roof refurbishment with standard scaffold access. This is the lower-cost option, but it does not include a temporary roof covering during the works.",
      recommended: false
    };
  }

  if (optionType === "temporary_roof_protection") {
    return {
      id: "option-b",
      label: "Option B",
      title: "Temporary Roof Protection",
      short_description: "Best protection during the works",
      description:
        "A full roof refurbishment with a temporary roof covering in place during the works. This gives the best weather protection and helps reduce delays.",
      recommended: true
    };
  }

  const optionName = `Option ${String.fromCharCode(65 + Math.max(index, 0))}`;
  return {
    id: `option-${String.fromCharCode(97 + Math.max(index, 0))}`,
    label: optionName,
    title: optionName,
    short_description: "Review this option",
    description: "Review this option and the price summary before deciding whether to proceed.",
    recommended: index === 0
  };
}

export function normaliseQuoteCostLine(line: CostLineItem): CostLineItem {
  const cost = getLineItemNet(line);
  const quantity = typeof line.quantity === "number" && Number.isFinite(line.quantity) ? line.quantity : undefined;
  const unitRate = typeof line.unit_rate === "number" && Number.isFinite(line.unit_rate) ? line.unit_rate : undefined;
  const identity = `${line.source_id ?? ""} ${line.item ?? ""} ${line.pricing_category ?? ""} ${line.quote_section ?? ""} ${line.source_label ?? ""}`.toLowerCase();
  const broadCategory = getQuoteLineItemCategory(line);

  if (broadCategory === "access" && (identity.includes("temporary roof") || identity.includes("weather protection") || identity.includes("temp roof"))) {
    return {
      ...line,
      item: line.item || "Temporary roof protection",
      cost,
      vat_applicable: line.vat_applicable !== false,
      notes: line.notes || "",
      quantity,
      unit_rate: unitRate,
      pricing_category: "temporary_roof_protection",
      quote_section: "access",
      source_id: line.source_id || "temporary-roof-protection"
    };
  }

  if (broadCategory === "access") {
    return {
      ...line,
      item: line.item || "Standard scaffold",
      cost,
      vat_applicable: line.vat_applicable !== false,
      notes: line.notes || "",
      quantity,
      unit_rate: unitRate,
      pricing_category: "standard_scaffold",
      quote_section: "access",
      source_id: line.source_id || "standard-scaffold"
    };
  }

  return {
    ...line,
    item: line.item || "Roof works",
    cost,
    vat_applicable: line.vat_applicable !== false,
    notes: line.notes || "",
    quantity,
    unit_rate: unitRate,
    pricing_category: line.pricing_category || "roof_works",
    quote_section: line.quote_section || "roof_works",
    source_id: line.source_id
  };
}

export function normaliseQuoteOption(option: QuoteOption, index = 0): QuoteOption {
  const optionType = option.option_type || getOptionTypeFromId(option.id);
  const defaults = getQuoteOptionTypeDefaults(optionType, index);
  const cost_breakdown = (option.cost_breakdown ?? []).map(normaliseQuoteOptionCostLine);
  const subtotal = calculateOptionNet({ cost_breakdown });
  const vat_amount = calculateOptionVat({ cost_breakdown });

  return {
    ...option,
    id: optionType ? defaults.id : option.id || defaults.id,
    label: optionType ? defaults.label : option.label || defaults.label,
    option_type: optionType,
    title: option.title || defaults.title,
    short_description: option.short_description || defaults.short_description,
    description: option.description || defaults.description,
    recommended: optionType ? defaults.recommended : Boolean(option.recommended),
    cost_breakdown,
    subtotal,
    vat_amount,
    total: roundMoney(subtotal + vat_amount)
  };
}

export function buildDefaultQuoteOptionsFromLines(lines: CostLineItem[]): QuoteOption[] {
  const normalisedLines = lines.map(normaliseQuoteOptionCostLine).filter((line) => getLineItemNet(line) > 0);
  const roofLines = normalisedLines.filter((line) => getQuoteLineItemCategory(line) === "roof_works");
  const standardAccess = normalisedLines.filter((line) => line.pricing_category === "standard_scaffold");
  const temporaryProtection = normalisedLines.filter((line) => line.pricing_category === "temporary_roof_protection");
  const defaultsA = getQuoteOptionTypeDefaults("standard_scaffold", 0);
  const defaultsB = getQuoteOptionTypeDefaults("temporary_roof_protection", 1);
  const optionALines = [...roofLines, ...(standardAccess.length ? standardAccess : normalisedLines.filter((line) => getQuoteLineItemCategory(line) === "access" && line.pricing_category !== "temporary_roof_protection"))];
  const optionBLines = [...roofLines, ...(temporaryProtection.length ? temporaryProtection : standardAccess)];
  const fallbackLines = normalisedLines.length ? normalisedLines : lines.map(normaliseQuoteCostLine);

  return [
    normaliseQuoteOption({ ...defaultsA, option_type: "standard_scaffold", cost_breakdown: optionALines.length ? optionALines : fallbackLines, subtotal: 0, vat_amount: 0, total: 0 }, 0),
    normaliseQuoteOption({ ...defaultsB, option_type: "temporary_roof_protection", cost_breakdown: optionBLines.length ? optionBLines : fallbackLines, subtotal: 0, vat_amount: 0, total: 0 }, 1)
  ];
}

function normaliseQuoteOptionCostLine(line: CostLineItem): CostLineItem {
  const normalised = normaliseQuoteCostLine(line);
  if (getQuoteLineItemCategory(normalised) !== "roof_works") return normalised;

  return {
    ...normalised,
    pricing_category: "roof_works",
    quote_section: "roof_works",
    source_id: normalised.source_id || "roof-works"
  };
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

function getCustomerLineItemLabel(item: CostLineItem) {
  const identity = `${item.source_id ?? ""} ${item.item ?? ""} ${item.pricing_category ?? ""} ${item.quote_section ?? ""} ${item.source_label ?? ""}`.toLowerCase();
  const category = getQuoteLineItemCategory(item);

  if (category === "roof_works") return "Roof works";
  if (identity.includes("temporary roof") || identity.includes("weather protection") || identity.includes("temp roof")) return "Temporary roof protection";
  if (identity.includes("scaffold")) return "Standard scaffold";
  return item.item || "Quote item";
}

function getOptionName(option: Pick<QuoteOption, "id" | "label">, index: number) {
  if (/^option[\s_-]?[a-z]$/i.test(option.label || "")) return option.label.replace(/[-_]/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());

  const typeFromId = getOptionTypeFromId(option.id);
  if (typeFromId === "standard_scaffold") return "Option A";
  if (typeFromId === "temporary_roof_protection") return "Option B";

  return `Option ${String.fromCharCode(65 + Math.max(index, 0))}`;
}

function getOptionTypeFromId(id?: string) {
  const normalised = (id || "").toLowerCase().replace(/_/g, "-");
  if (normalised === "option-a") return "standard_scaffold";
  if (normalised === "option-b") return "temporary_roof_protection";
  return undefined;
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
