import { describe, expect, it } from "vitest";
import { applyQuoteLineChanges, buildQuoteUpdate } from "@/lib/quotes/mcpQuoteEditing";
import type { QuoteRecord } from "@/lib/types";

const quote: QuoteRecord = {
  id: "quote-1",
  job_id: "job-1",
  quote_ref: "WR-Q-1001",
  version_number: 1,
  status: "Draft",
  roof_report: "Old report",
  scope_of_works: "Old scope",
  cost_breakdown: [
    { item: "Roof works", cost: 1000, quantity: 1, unit_rate: 1000, vat_applicable: true, notes: "" },
    { item: "Scaffold", cost: 500, vat_applicable: false, notes: "Existing access" }
  ],
  subtotal: 1500,
  vat_amount: 200,
  total: 1700,
  options: [{ id: "option-a", label: "Option A", description: "Standard", cost_breakdown: [{ item: "Option works", cost: 2000, vat_applicable: true, notes: "" }], subtotal: 2000, vat_amount: 400, total: 2400, recommended: true }],
  accepted_option_id: null,
  missing_info: [],
  pricing_notes: []
};

describe("ChatGPT quote editing", () => {
  it("updates a numbered line and recalculates VAT and totals", () => {
    const result = buildQuoteUpdate(quote, { line_changes: [{ action: "update", line_number: 1, quantity: 2, unit_rate: 750 }] }, 0.2);
    expect(result.patch.cost_breakdown[0].cost).toBe(1500);
    expect(result.preview.updated).toEqual({ subtotal: 2000, vat_amount: 300, total: 2300 });
  });

  it("adds and removes lines without replacing untouched content", () => {
    const lines = applyQuoteLineChanges(quote.cost_breakdown, [
      { action: "remove", line_number: 2 },
      { action: "add", item: "Waste removal", cost: 250, vat_applicable: true, notes: "" }
    ]);
    expect(lines.map((line) => line.item)).toEqual(["Roof works", "Waste removal"]);
  });

  it("updates a specific quote option", () => {
    const result = buildQuoteUpdate(quote, { line_changes: [{ action: "update", option_id: "option-a", line_number: 1, cost: 2500 }] }, 0.2);
    expect(result.patch.options[0].total).toBe(3000);
    expect(result.patch.cost_breakdown[0].cost).toBe(1000);
  });

  it("updates wording while preserving prices", () => {
    const result = buildQuoteUpdate(quote, { customer_pricing_mode: "selectable_items", scope_of_works: "Revised roof scope", missing_info: ["Confirm tile colour"], pricing_note: "Rate checked with supplier" }, 0.2);
    expect(result.patch.customer_pricing_mode).toBe("selectable_items");
    expect(result.preview.pricing_mode.updated).toBe("selectable_items");
    expect(result.patch.scope_of_works).toBe("Revised roof scope");
    expect(result.patch.missing_info).toEqual(["Confirm tile colour"]);
    expect(result.patch.pricing_notes).toEqual(["Rate checked with supplier"]);
    expect(result.patch.cost_breakdown).toEqual(quote.cost_breakdown);
  });

  it("updates option wording and maintains one recommendation", () => {
    const result = buildQuoteUpdate(quote, { option_updates: [{ option_id: "option-a", title: "Temporary Roof Protection", description: "Full weather protection", recommended: true }] }, 0.2);
    expect(result.patch.options[0].title).toBe("Temporary Roof Protection");
    expect(result.patch.options[0].description).toBe("Full weather protection");
    expect(result.patch.options[0].recommended).toBe(true);
  });

  it("rejects invalid line numbers and unknown options", () => {
    expect(() => buildQuoteUpdate(quote, { line_changes: [{ action: "remove", line_number: 9 }] }, 0.2)).toThrow("line_number");
    expect(() => buildQuoteUpdate(quote, { line_changes: [{ action: "add", option_id: "missing", item: "Line", cost: 1 }] }, 0.2)).toThrow("was not found");
  });
});
