import { describe, expect, it } from "vitest";
import { resolveQuotePricingMode, validateQuoteAcceptanceChoice } from "@/lib/quotes/pricingMode";

describe("quote customer pricing modes", () => {
  it("keeps old A/B quotes compatible without making roof sections selectable", () => {
    expect(resolveQuotePricingMode(undefined, 2)).toBe("options");
    expect(resolveQuotePricingMode(undefined, 0)).toBe("single");
    expect(resolveQuotePricingMode("selectable_items", 0)).toBe("selectable_items");
  });

  it("requires one valid A/B option", () => {
    expect(validateQuoteAcceptanceChoice({ pricingMode: "options", hasAcceptedOption: false, hasSelectedLines: false, optionId: "missing" })).toMatch(/Option A/);
    expect(validateQuoteAcceptanceChoice({ pricingMode: "options", hasAcceptedOption: true, hasSelectedLines: false, optionId: "option-a" })).toBeNull();
  });

  it("requires selected work only in pick-individual mode", () => {
    expect(validateQuoteAcceptanceChoice({ pricingMode: "selectable_items", hasAcceptedOption: false, hasSelectedLines: false })).toMatch(/at least one/);
    expect(validateQuoteAcceptanceChoice({ pricingMode: "selectable_items", hasAcceptedOption: false, hasSelectedLines: true })).toBeNull();
    expect(validateQuoteAcceptanceChoice({ pricingMode: "single", hasAcceptedOption: false, hasSelectedLines: true })).toMatch(/single fixed/);
  });
});
