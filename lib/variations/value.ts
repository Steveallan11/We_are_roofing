import type { VariationLineItem } from "@/lib/types";

export const VARIATION_VAT_RATE = 0.2;

export function calculateVariationTotals(lineItems: VariationLineItem[]) {
  const subtotal = roundMoney(lineItems.reduce((sum, item) => sum + Number(item.total || 0), 0));
  const vatAmount = roundMoney(
    lineItems.reduce((sum, item) => sum + (item.vat_applicable ? Number(item.total || 0) * VARIATION_VAT_RATE : 0), 0)
  );
  return { subtotal, vatAmount, total: roundMoney(subtotal + vatAmount) };
}

export function normaliseVariationLineItems(value: unknown): VariationLineItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((raw, index) => {
      const item = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
      const description = String(item.description ?? "").trim();
      const quantity = positiveNumber(item.quantity, 1);
      const unitPrice = nonNegativeNumber(item.unit_price);
      return {
        id: String(item.id ?? `variation-line-${index + 1}`),
        description,
        quantity,
        unit: String(item.unit ?? "item").trim() || "item",
        unit_price: unitPrice,
        vat_applicable: item.vat_applicable === true,
        total: roundMoney(quantity * unitPrice)
      };
    })
    .filter((item) => item.description && item.total >= 0);
}

function positiveNumber(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function nonNegativeNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
