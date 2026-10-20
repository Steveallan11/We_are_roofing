import { describe, expect, it } from "vitest";
import { calculateCisDeduction, normaliseInvoiceTaxLine, round2 } from "@/lib/invoice-engine";
import type { InvoiceLineItem } from "@/lib/types";

describe("draft invoice tax repair", () => {
  it("normalises a legacy zero-VAT finance line and restores reverse-charge and CIS amounts", () => {
    const legacyLine = {
      description: "Roof repairs (labour; domestic reverse charge applies)",
      quantity: 1,
      unit: "job",
      unit_price: 1000,
      net_amount: 1000,
      vat_rate: 0
    } as InvoiceLineItem & { net_amount: number; vat_rate: number };
    const line = normaliseInvoiceTaxLine(legacyLine, { category: "labour", vat_applicable: true });
    const cis = calculateCisDeduction([line], 30);
    const reverseChargeVat = round2(line.total * 0.2);

    expect(line).toMatchObject({ total: 1000, category: "labour", vat_applicable: true });
    expect(cis).toEqual({ rate: 30, labourAmount: 1000, deductionAmount: 300 });
    expect(reverseChargeVat).toBe(200);
    expect(round2(line.total - cis.deductionAmount)).toBe(700);
  });
});
