import type { QuotePricingMode } from "@/lib/types";

export function resolveQuotePricingMode(mode: QuotePricingMode | null | undefined, optionCount: number): QuotePricingMode {
  if (mode === "single" || mode === "options" || mode === "selectable_items") return mode;
  return optionCount >= 2 ? "options" : "single";
}

export function validateQuoteAcceptanceChoice({
  hasAcceptedOption,
  hasSelectedLines,
  optionId,
  pricingMode
}: {
  hasAcceptedOption: boolean;
  hasSelectedLines: boolean;
  optionId?: string | null;
  pricingMode: QuotePricingMode;
}) {
  if (pricingMode === "options" && !hasAcceptedOption) return "Choose Option A or Option B before accepting.";
  if (pricingMode === "selectable_items" && !hasSelectedLines) return "Choose at least one work item before accepting.";
  if (pricingMode === "single" && (optionId || hasSelectedLines)) return "This is a single fixed quotation and does not accept partial selections.";
  return null;
}
