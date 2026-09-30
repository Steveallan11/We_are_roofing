import { describe, expect, it } from "vitest";
import { toQuoteContentBlocks } from "@/lib/quotes/readableQuote";

describe("public quote content structure", () => {
  it("keeps headings, prose and bullets as separate readable blocks", () => {
    expect(toQuoteContentBlocks(`Existing roof condition:\nThe coverings have reached the end of their useful life.\n\n- Remove existing tiles\n- Renew battens and membrane`)).toEqual([
      { kind: "heading", text: "Existing roof condition" },
      { kind: "paragraph", text: "The coverings have reached the end of their useful life." },
      { kind: "list", ordered: false, items: ["Remove existing tiles", "Renew battens and membrane"] }
    ]);
  });

  it("preserves numbered work stages as an ordered list", () => {
    expect(toQuoteContentBlocks("Proposed works\n1. Erect scaffold\n2. Strip the roof\n3. Install the new system")).toEqual([
      { kind: "heading", text: "Proposed works" },
      { kind: "list", ordered: true, items: ["Erect scaffold", "Strip the roof", "Install the new system"] }
    ]);
  });

  it("joins wrapped prose without turning every line into a separate paragraph", () => {
    expect(toQuoteContentBlocks("The rear roof has slipped tiles\nand signs of historic water entry.")).toEqual([
      { kind: "paragraph", text: "The rear roof has slipped tiles and signs of historic water entry." }
    ]);
  });

  it("always treats a leading hyphen as a bullet, never a heading", () => {
    expect(toQuoteContentBlocks("- Install a fully reinforced Siltec RB30 PMMA waterproofing system to\n- Dress all perimeter details")).toEqual([
      {
        kind: "list",
        ordered: false,
        items: [
          "Install a fully reinforced Siltec RB30 PMMA waterproofing system to",
          "Dress all perimeter details"
        ]
      }
    ]);
  });

  it("recognises legacy space-numbered subsection titles without preserving broken repeated numbers", () => {
    expect(toQuoteContentBlocks("1 Roof Cleaning & Moss Treatment\nClean all roof slopes.\n\n1 Valley Repairs\nRenew defective valley details.")).toEqual([
      { kind: "heading", numbered: true, text: "Roof Cleaning & Moss Treatment" },
      { kind: "paragraph", text: "Clean all roof slopes." },
      { kind: "heading", numbered: true, text: "Valley Repairs" },
      { kind: "paragraph", text: "Renew defective valley details." }
    ]);
  });

  it("recognises tightly spaced numbered headings and strips their stored numbers", () => {
    expect(toQuoteContentBlocks("01 —FLAT ROOF — APPROX. 14 M²\n- Prepare the roof area\n\n02—SILTEC SILFLEX PMMA WATERPROOFING SYSTEM\n- Install the reinforced system")).toEqual([
      { kind: "heading", numbered: true, text: "FLAT ROOF — APPROX. 14 M²" },
      { kind: "list", ordered: false, items: ["Prepare the roof area"] },
      { kind: "heading", numbered: true, text: "SILTEC SILFLEX PMMA WATERPROOFING SYSTEM" },
      { kind: "list", ordered: false, items: ["Install the reinforced system"] }
    ]);
  });

  it("recognises bold markdown numbered headings as headings rather than body copy", () => {
    expect(toQuoteContentBlocks("**01 — FLAT ROOF — APPROX. 14 M²**\n- Prepare all suitable surfaces")).toEqual([
      { kind: "heading", numbered: true, text: "FLAT ROOF — APPROX. 14 M²" },
      { kind: "list", ordered: false, items: ["Prepare all suitable surfaces"] }
    ]);
  });
});
