import type { KnowledgeBaseCategory } from "@/lib/types";

type SeedRecord = {
  title: string;
  category: KnowledgeBaseCategory;
  tags: string[];
  content: string;
  source_type: string;
};

export const KNOWLEDGE_BASE_SEEDS: SeedRecord[] = [
  {
    title: "We Are Roofing Quote Template",
    category: "Quote Template",
    tags: ["template", "customer-facing", "quote"],
    source_type: "notion_import",
    content:
      "We Are Roofing UK Ltd quotation structure: company header, quote ref, customer details, roof report opening, scope of works, cost breakdown, guarantee, terms, close with Andrew Bailey / Director sign-off. Opening line should read: Having been out to look at the roof of the above property we offer you the following information with costs for your perusal."
  },
  {
    title: "Roof Report Writing Guide",
    category: "Roof Report Style",
    tags: ["style", "report", "tone"],
    source_type: "notion_import",
    content:
      "Use plain English and experienced roofer language. Explain what was found, likely cause, recommended works, and where hidden conditions cannot be confirmed until stripped. Avoid sales language and avoid overpromising."
  },
  {
    title: "Pricing Reference by Job Type",
    category: "Pricing Reference",
    tags: ["pricing", "uplift", "2025/26"],
    source_type: "notion_import",
    content:
      "Historical prices are based on 2022 We Are Roofing source material and must be uplifted by roughly 15-20% for 2025/26 pricing. Always consider labour, materials, scaffold, waste, asbestos, insulation, decking, and specialist access."
  },
  {
    title: "Scope of Works Library",
    category: "Scope Of Works",
    tags: ["scope", "works", "installation"],
    source_type: "notion_import",
    content:
      "Use step-by-step roofing scopes. For flat roofs, Danosa Option 3 two-layer torch-on is the default standard where appropriate. Include strip out, deck checks, system build-up, flashings, tidy-up, and waste handling."
  },
  {
    title: "Materials and Systems Reference",
    category: "Materials System",
    tags: ["materials", "systems", "roofing"],
    source_type: "notion_import",
    content:
      "Key systems include Danosa Option 3 torch-on, warm deck insulation build-ups, GRP/EPDM alternatives where required, pitched roofing repair/replacement components, and fascia/soffit/gutter replacement items."
  },
  {
    title: "Standard Terms",
    category: "Terms",
    tags: ["terms", "vat", "payment"],
    source_type: "notion_import",
    content:
      "Default terms: prices subject to VAT at 20%, 50% deposit may be requested, payment due on receipt, defects notified within 7 days, materials remain property of We Are Roofing UK Ltd until paid in full."
  },
  {
    title: "Historical Quote Examples",
    category: "Historical Quote",
    tags: ["examples", "historical", "quotes"],
    source_type: "notion_import",
    content:
      "Use prior We Are Roofing quotes as style anchors for flat roofs, moss removal, ridge/hip works, dry valleys, lead flashing, UPVC rooflines, and chimney works. Do not copy old prices directly without uplift and current checks."
  },
  {
    title: "Email Style Guidance",
    category: "Email Style",
    tags: ["email", "approval", "quote send"],
    source_type: "notion_import",
    content:
      "Email copy should be concise, professional, and practical. Explain that the quotation is attached or linked, highlight the key recommendation, and invite the customer to reply or call with questions."
  }
];

