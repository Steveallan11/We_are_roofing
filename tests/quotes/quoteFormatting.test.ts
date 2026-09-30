import { describe, expect, it } from "vitest";
import { formatScopeNumber, isUppercaseHeading, toQuoteContentBlocks } from "@/lib/quotes/readableQuote";
import { buildQuoteOptionCustomerRows, normalizeQuoteLineItemLabel } from "@/lib/quotes/value";

describe("customer quote formatting", () => {
  it.each([
    ["Moss Scrape roof works", "Moss Scrape"],
    ["Box Gutter roof works", "Box Gutter"],
    ["Valleys roof works", "Valley Repairs"],
    ["Hips & Ridges roof works", "Hips & Ridges"],
    ["Tile Replacement roof works", "Tile Replacement"]
  ])("normalises %s to %s without changing stored data", (source, expected) => {
    expect(normalizeQuoteLineItemLabel(source)).toBe(expected);
  });

  it("uses an explicit customer display name before internal section/category names", () => {
    const rows = buildQuoteOptionCustomerRows({
      cost_breakdown: [{
        item: "Roof works",
        display_name: "White uPVC Fascia, Soffit & Guttering with Eaves Protection",
        quote_section: "fascia-package",
        pricing_category: "roof_works",
        cost: 3595,
        vat_applicable: true,
        notes: ""
      }]
    });

    expect(rows[0]).toMatchObject({ label: "White uPVC Fascia, Soffit & Guttering with Eaves Protection", net: 3595 });
  });

  it.each([[0, "01"], [1, "02"], [8, "09"], [9, "10"]])("formats scope index %s as %s", (index, expected) => {
    expect(formatScopeNumber(index)).toBe(expected);
  });

  it("recognises a substantial uppercase standalone line but not ordinary prose", () => {
    expect(isUppercaseHeading("ASBESTOS WARNING")).toBe(true);
    expect(isUppercaseHeading("Supply and install new white uPVC fascia.")).toBe(false);
  });

  it("renders standalone markdown bold as emphasis without interpreting raw HTML", () => {
    expect(toQuoteContentBlocks("**Important note**\n\n<b>Keep this as text</b>")).toEqual([
      { kind: "heading", emphasis: true, text: "Important note" },
      { kind: "paragraph", text: "<b>Keep this as text</b>" }
    ]);
  });

  it("keeps warning emphasis separate from sequential top-level scope sections", () => {
    expect(toQuoteContentBlocks("01 Roof Cleaning\nClean the covering.\n\nASBESTOS WARNING\nStop if suspect material is found.\n\n01 Access\nWorks are based on ladder access.")).toEqual([
      { kind: "heading", numbered: true, text: "Roof Cleaning" },
      { kind: "paragraph", text: "Clean the covering." },
      { kind: "heading", emphasis: true, text: "ASBESTOS WARNING" },
      { kind: "paragraph", text: "Stop if suspect material is found." },
      { kind: "heading", numbered: true, text: "Access" },
      { kind: "paragraph", text: "Works are based on ladder access." }
    ]);
  });

  it("splits a joined legacy scope title from its body copy", () => {
    expect(toQuoteContentBlocks("New Fascia, Soffit & Guttering Carefully remove the existing guttering and fascia.")).toEqual([
      { kind: "heading", text: "New Fascia, Soffit & Guttering" },
      { kind: "paragraph", text: "Carefully remove the existing guttering and fascia." }
    ]);
  });
});
