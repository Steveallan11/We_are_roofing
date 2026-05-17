import type { CostLineItem, PricingRuleRecord } from "@/lib/types";

export type RateCardInput = {
  category: string;
  item: string;
  unit: string;
  default_rate: number;
};

export type RateCardEntry = RateCardInput & {
  id?: string;
  rate: number;
  active: boolean;
};

export type PricedLineItem = CostLineItem & {
  quantity?: number;
  unit?: string;
  unit_rate?: number;
  pricing_source?: string;
};

export const DEFAULT_RATES: RateCardInput[] = [
  { category: "Area", item: "Flat - EPDM", unit: "m²", default_rate: 55 },
  { category: "Area", item: "Flat - GRP", unit: "m²", default_rate: 65 },
  { category: "Area", item: "Flat - Felt", unit: "m²", default_rate: 45 },
  { category: "Area", item: "Flat - Lead", unit: "m²", default_rate: 180 },
  { category: "Area", item: "Pitched - Tile", unit: "m²", default_rate: 48 },
  { category: "Area", item: "Pitched - Slate", unit: "m²", default_rate: 65 },
  { category: "Area", item: "Pitched - Metal", unit: "m²", default_rate: 70 },
  { category: "Linear", item: "Ridge", unit: "lm", default_rate: 18 },
  { category: "Linear", item: "Valley", unit: "lm", default_rate: 22 },
  { category: "Linear", item: "Hip", unit: "lm", default_rate: 20 },
  { category: "Linear", item: "Eaves", unit: "lm", default_rate: 15 },
  { category: "Linear", item: "Verge", unit: "lm", default_rate: 14 },
  { category: "Linear", item: "Abutment", unit: "lm", default_rate: 25 },
  { category: "Linear", item: "Parapet", unit: "lm", default_rate: 28 },
  { category: "Linear", item: "Flashing", unit: "lm", default_rate: 30 },
  { category: "Linear", item: "Gutter", unit: "lm", default_rate: 12 },
  { category: "Linear", item: "Fascia", unit: "lm", default_rate: 10 },
  { category: "Linear", item: "Soaker", unit: "lm", default_rate: 18 },
  { category: "Fixed", item: "Scaffold", unit: "item", default_rate: 1250 },
  { category: "Fixed", item: "Skip", unit: "item", default_rate: 300 },
  { category: "Fixed", item: "Waste Disposal", unit: "item", default_rate: 250 },
  { category: "Fixed", item: "Asbestos Disposal Allowance", unit: "item", default_rate: 250 },
  { category: "Fixed", item: "OSB Board Sheet Allowance", unit: "item", default_rate: 70 },
  { category: "Fixed", item: "Roof Lantern Replacement", unit: "item", default_rate: 2500 },
  { category: "Fixed", item: "Refit Existing Roof Lantern", unit: "item", default_rate: 600 },
  { category: "Anchor", item: "Roof Report / Diagnosis", unit: "item", default_rate: 500 },
  { category: "Anchor", item: "Chimney Flaunching And Lead Flashings", unit: "item", default_rate: 495 },
  { category: "Anchor", item: "Chimney Removal", unit: "item", default_rate: 695 },
  { category: "Anchor", item: "Ridge Tile Local Repair", unit: "item", default_rate: 595 },
  { category: "Anchor", item: "Gable Verge Re-bed", unit: "item", default_rate: 995 },
  { category: "Anchor", item: "Dry Valley Replacement", unit: "item", default_rate: 995 },
  { category: "Anchor", item: "Porch Flat Roof Replacement", unit: "item", default_rate: 995 },
  { category: "Anchor", item: "Dormer Or Small Flat Roof", unit: "item", default_rate: 1150 },
  { category: "Anchor", item: "Verges And Ridge Tiles", unit: "item", default_rate: 1500 },
  { category: "Anchor", item: "Large Moss Removal", unit: "item", default_rate: 1777 },
  { category: "Anchor", item: "Moss Scrape And Verges", unit: "item", default_rate: 1895 },
  { category: "Anchor", item: "Mansard Eaves Felt And Lead Repair", unit: "item", default_rate: 2835 },
  { category: "Anchor", item: "Garage Flat Roof Fascias And Walkway Roof", unit: "item", default_rate: 2995 },
  { category: "Anchor", item: "UPVC Fascia Soffit Guttering", unit: "item", default_rate: 3495 },
  { category: "Anchor", item: "Commercial Flat Roof Overclad", unit: "item", default_rate: 3495 },
  { category: "Anchor", item: "GRP Flat Roof Replacement With Coping And Lantern", unit: "item", default_rate: 5555 },
  { category: "Anchor", item: "Half Elevation Re-roof", unit: "item", default_rate: 6495 },
  { category: "Anchor", item: "Flat Roof With New Roof Lantern", unit: "item", default_rate: 7650 },
  { category: "Anchor", item: "Strip And Re-tile With UPVC", unit: "item", default_rate: 7995 },
  { category: "Anchor", item: "Large Warm Deck Flat Roof", unit: "item", default_rate: 12995 }
];

export function pricingRulesToRateCard(rules: PricingRuleRecord[]): RateCardEntry[] {
  const entries = rules
    .filter((rule) => rule.rule_name && rule.flat_adjustment != null && rule.active !== false)
    .map((rule) => ({
      id: rule.id,
      category: rule.rule_type ?? "Custom",
      item: rule.rule_name ?? rule.title,
      unit: typeof rule.conditions?.unit === "string" ? rule.conditions.unit : "item",
      default_rate: Number(rule.flat_adjustment ?? 0),
      rate: Number(rule.flat_adjustment ?? 0),
      active: rule.active !== false
    }));

  return entries.length > 0 ? entries : DEFAULT_RATES.map((rate) => ({ ...rate, rate: rate.default_rate, active: true }));
}

export function mergeRateCardWithDefaults(savedRates: RateCardEntry[]) {
  const keyFor = (rate: Pick<RateCardEntry, "category" | "item">) => `${normaliseRateName(rate.category)}:${normaliseRateName(rate.item)}`;
  const savedByKey = new Map(savedRates.map((rate) => [keyFor(rate), rate]));
  const mergedDefaults = DEFAULT_RATES.map((rate) => savedByKey.get(keyFor(rate)) ?? { ...rate, rate: rate.default_rate, active: true });
  const defaultKeys = new Set(DEFAULT_RATES.map(keyFor));
  const customRates = savedRates.filter((rate) => !defaultKeys.has(keyFor(rate)));
  return [...mergedDefaults, ...customRates];
}

export function normaliseRateName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function findRateForItem(itemName: string, rates: RateCardEntry[]) {
  const name = normaliseRateName(itemName);
  return (
    rates.find((rate) => normaliseRateName(rate.item) === name) ??
    rates.find((rate) => {
      const rateName = normaliseRateName(rate.item);
      return name.includes(rateName) || rateName.includes(name);
    }) ??
    null
  );
}

export function parseQuantityFromLine(line: CostLineItem, unit?: string) {
  if (unit === "item") return 1;
  const search = `${line.item} ${line.notes}`.replace(/,/g, "");
  const units = unit ? [unit] : ["m²", "m2", "sqm", "lm", "m", "item", "no."];
  for (const candidate of units) {
    const escaped = candidate.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = search.match(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*${escaped}`, "i"));
    if (match) return Number(match[1]);
  }
  const firstNumber = search.match(/(\d+(?:\.\d+)?)/);
  return firstNumber ? Number(firstNumber[1]) : 1;
}

export function applyRateCardToCostBreakdown(lines: CostLineItem[], rates: RateCardEntry[]) {
  const pricingNotes: string[] = [];
  const updated = lines.map((line) => {
    if (Number(line.cost || 0) > 0) return line as PricedLineItem;

    const rate = findRateForItem(line.item, rates);
    if (!rate) return line as PricedLineItem;

    const quantity = parseQuantityFromLine(line, rate.unit);
    const cost = Math.round(quantity * rate.rate * 100) / 100;
    pricingNotes.push(`${line.item}: ${quantity} ${rate.unit} x £${rate.rate.toFixed(2)} from Rate Card.`);

    return {
      ...line,
      cost,
      quantity,
      unit: rate.unit,
      unit_rate: rate.rate,
      pricing_source: "rate_card"
    };
  });

  return { updated, pricingNotes };
}

export function calculateQuoteTotals(lines: CostLineItem[], vatRate = 0.2) {
  const subtotal = Math.round(lines.reduce((sum, item) => sum + Number(item.cost || 0), 0) * 100) / 100;
  const vatAmount =
    Math.round(lines.filter((item) => item.vat_applicable).reduce((sum, item) => sum + Number(item.cost || 0) * vatRate, 0) * 100) / 100;
  return { subtotal, vat_amount: vatAmount, total: subtotal + vatAmount };
}
