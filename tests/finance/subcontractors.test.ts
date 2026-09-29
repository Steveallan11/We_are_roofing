import { describe, expect, it } from "vitest";
import { calculateSubcontractorAmounts } from "@/lib/finance/subcontractors";

describe("subcontractor finance calculations", () => {
  it("calculates VAT and a 20% CIS deduction from the net labour value", () => {
    expect(calculateSubcontractorAmounts({ quantity: 5, unitRate: 200, vatRate: 20, cisRate: 20 })).toEqual({
      net: 1000,
      vat: 200,
      gross: 1200,
      cisDeduction: 200,
      payable: 1000
    });
  });

  it("supports gross-status and unregistered subcontractors", () => {
    expect(calculateSubcontractorAmounts({ quantity: 2, unitRate: 175.5, vatRate: 0, cisRate: 0 }).payable).toBe(351);
    expect(calculateSubcontractorAmounts({ quantity: 1, unitRate: 1000, vatRate: 0, cisRate: 30 }).payable).toBe(700);
  });

  it("rounds money to pennies", () => {
    expect(calculateSubcontractorAmounts({ quantity: 1.25, unitRate: 99.99, vatRate: 5, cisRate: 20 })).toEqual({
      net: 124.99,
      vat: 6.25,
      gross: 131.24,
      cisDeduction: 25,
      payable: 106.24
    });
  });
});
