import { describe, expect, it } from "vitest";
import { ageingBucket, calculateProfitability, groupDirectCosts, summariseSales } from "@/lib/finance/calculations";
import { decimalMultiply, toPence } from "@/lib/finance/money";

describe("finance calculations", () => {
  it("rounds decimal money to pennies without binary-float accumulation", () => {
    expect(toPence("12.345")).toBe(1235);
    expect(toPence(0.1) + toPence(0.2)).toBe(30);
    expect(decimalMultiply("2.5", "12.34")).toBe(3085);
  });

  it("keeps invoices, payments and credit notes separate", () => {
    const result = summariseSales(
      [{ id: "i1", invoice_ref: "WR-INV-1001", status: "Part Paid", subtotal: "100000.00", vat_amount: "20000.00", total: "120000.00", amount_paid: "60000.00", balance_due: "60000.00" }],
      [{ status: "Issued", subtotal: "1000.00", vat_amount: "200.00", total: "1200.00" }],
      toPence("60000.00")
    );
    expect(result.net_adjusted_sales).toBe(99000);
    expect(result.output_vat).toBe(20000);
    expect(result.credit_note_vat).toBe(200);
    expect(result.payments_received).toBe(60000);
    expect(result.outstanding).toBe(58800);
  });

  it("handles zero revenue and negative profit safely", () => {
    expect(calculateProfitability(0, 8400000)).toEqual({ net_revenue: 0, gross_profit: -84000, gross_margin_percent: 0 });
    expect(calculateProfitability(1000000, 1200000).gross_margin_percent).toBe(-20);
  });

  it("groups the requested Ladi direct-cost fixture", () => {
    const result = groupDirectCosts([
      { category: "Materials", net_amount: 32000 }, { category: "Scaffolding", net_amount: 18000 },
      { category: "Subcontractor", net_amount: 12000 }, { category: "Labour", net_amount: 15000 },
      { category: "Plant Hire", net_amount: 3000 }, { category: "Waste", net_amount: 1500 },
      { category: "Other", net_amount: 2500 }
    ]);
    expect(result.total_direct_costs).toBe(84000);
    expect(result.scaffold).toBe(18000);
  });

  it("uses the required overdue ageing buckets", () => {
    expect(ageingBucket("2026-09-23", "2026-09-23")).toBe("Current");
    expect(ageingBucket("2026-09-01", "2026-09-23")).toBe("1-30 days overdue");
    expect(ageingBucket("2026-07-01", "2026-09-23")).toBe("61-90");
    expect(ageingBucket("2026-01-01", "2026-09-23")).toBe("90+");
  });
});
