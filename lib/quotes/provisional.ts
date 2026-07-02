import type { CostLineItem } from "@/lib/types";

export const PRICE_TO_BE_CONFIRMED_NOTE = "Price to be confirmed by company.";

export function isPriceToBeConfirmed(line: Pick<CostLineItem, "notes">) {
  return line.notes?.toLowerCase().includes("price to be confirmed") ?? false;
}

export function setPriceToBeConfirmed(notes: string | null | undefined, enabled: boolean) {
  const cleaned = (notes ?? "")
    .replace(/(?:^|\n)\s*Price to be confirmed by company\.?\s*(?=\n|$)/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return enabled ? [cleaned, PRICE_TO_BE_CONFIRMED_NOTE].filter(Boolean).join("\n") : cleaned;
}

export function getFirmQuoteLines(lines: CostLineItem[] = []) {
  return lines.filter((line) => !isPriceToBeConfirmed(line));
}
