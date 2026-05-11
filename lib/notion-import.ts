import { requireServerEnv } from "@/lib/env";
import type { HistoricalQuoteRecord, KnowledgeBaseRecord } from "@/lib/types";

const DEFAULT_NOTION_VERSION = "2025-09-03";

type NotionQueryResult = {
  results: Array<Record<string, unknown>>;
  next_cursor?: string | null;
  has_more?: boolean;
};

type ImportBatchMode = "quotes" | "knowledge" | "all";

export async function importNotionBatch({
  businessId,
  cursor,
  pageSize = 25,
  mode = "all"
}: {
  businessId: string;
  cursor?: string | null;
  pageSize?: number;
  mode?: ImportBatchMode;
}) {
  const imports = await Promise.all([
    mode === "knowledge" ? Promise.resolve(emptyHistoricalBatch()) : importHistoricalQuotesFromNotion({ businessId, cursor, pageSize }),
    mode === "quotes" ? Promise.resolve(emptyKnowledgeBatch()) : importKnowledgeBaseFromNotion({ businessId, cursor, pageSize })
  ]);

  return {
    historicalQuotes: imports[0].records,
    knowledgeBase: imports[1].records,
    nextCursor: imports[0].nextCursor ?? imports[1].nextCursor ?? null,
    hasMore: imports[0].hasMore || imports[1].hasMore
  };
}

export async function importHistoricalQuotesFromNotion({
  businessId,
  cursor,
  pageSize = 25
}: {
  businessId: string;
  cursor?: string | null;
  pageSize?: number;
}) {
  const env = requireServerEnv();
  if (!env.NOTION_API_KEY || !env.NOTION_QUOTES_DATA_SOURCE_ID) {
    throw new Error("NOTION_API_KEY and NOTION_QUOTES_DATA_SOURCE_ID are required for quote import.");
  }

  const queryResult = await queryNotionDataSource(env.NOTION_QUOTES_DATA_SOURCE_ID, cursor, pageSize);
  const pages = await Promise.all(
    queryResult.results.map(async (page) => {
      const normalized = normalizeHistoricalQuotePage(page, businessId);
      if (!normalized) return null;

      const blockText = await fetchPageContent(normalized.source_record_id || "");
      return {
        ...normalized,
        imported_text: blockText || normalized.imported_text
      };
    })
  );

  return {
    records: pages.filter(Boolean) as HistoricalQuoteRecord[],
    nextCursor: queryResult.next_cursor ?? null,
    hasMore: Boolean(queryResult.has_more)
  };
}

export async function importKnowledgeBaseFromNotion({
  businessId,
  cursor,
  pageSize = 25
}: {
  businessId: string;
  cursor?: string | null;
  pageSize?: number;
}) {
  const env = requireServerEnv();
  if (!env.NOTION_API_KEY || !env.NOTION_KNOWLEDGE_DATA_SOURCE_ID) {
    throw new Error("NOTION_API_KEY and NOTION_KNOWLEDGE_DATA_SOURCE_ID are required for knowledge import.");
  }

  const queryResult = await queryNotionDataSource(env.NOTION_KNOWLEDGE_DATA_SOURCE_ID, cursor, pageSize);
  const pages = await Promise.all(
    queryResult.results.map(async (page) => {
      const normalized = normalizeKnowledgeBasePage(page, businessId);
      if (!normalized) return null;

      const content = await fetchPageContent(String(page.id ?? ""));
      return {
        ...normalized,
        content: content || normalized.content
      };
    })
  );

  return {
    records: pages.filter(Boolean) as KnowledgeBaseRecord[],
    nextCursor: queryResult.next_cursor ?? null,
    hasMore: Boolean(queryResult.has_more)
  };
}

function normalizeHistoricalQuotePage(page: Record<string, unknown>, businessId: string): HistoricalQuoteRecord | null {
  const properties = (page.properties as Record<string, Record<string, unknown>> | undefined) ?? {};
  const title = getFirstPresent([getTitleProperty(properties), getTextProperty(properties, /^Quote Title$/i)]);
  if (!title) return null;

  const quoteRef = getNumberProperty(properties, /^Quote Ref$/i);
  const quoteDate = getDateProperty(properties, /^Quote Date$/i);
  const sourceYear = quoteDate ? new Date(quoteDate).getUTCFullYear() : null;
  const stage = getTextProperty(properties, /^Stage$/i);
  const workDescription = getRichTextProperty(properties, /^Work Description$/i);
  const price = getNumberProperty(properties, /^Quote Value$/i);
  const roofType = inferRoofTypeFromText(`${title} ${workDescription ?? ""}`);
  const tags = [
    roofType,
    stage,
    getTextProperty(properties, /^Customer$/i),
    ...(workDescription ? splitKeywords(workDescription) : [])
  ].filter(Boolean) as string[];

  return {
    id: crypto.randomUUID(),
    business_id: businessId,
    title,
    source_reference: quoteRef != null ? `AB${quoteRef}` : title,
    source_record_id: String(page.id ?? ""),
    source_url: String(page.url ?? ""),
    source_type: "notion_quote_import",
    source_date: quoteDate,
    source_year: sourceYear,
    roof_type: roofType,
    job_type: inferJobType(title, workDescription),
    tags: uniqueStrings(tags),
    imported_text: workDescription || title,
    scope_excerpt: workDescription,
    materials_excerpt: buildMaterialsExcerpt(properties),
    original_total: price,
    uplifted_reference_total: price,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

function normalizeKnowledgeBasePage(page: Record<string, unknown>, businessId: string): KnowledgeBaseRecord | null {
  const properties = (page.properties as Record<string, Record<string, unknown>> | undefined) ?? {};
  const title = getTitleProperty(properties);
  if (!title) return null;

  const sourceType = getTextProperty(properties, /^Source Type$/i) ?? "Template / Wording";
  const currentPricingUse = getTextProperty(properties, /^Current Pricing Use$/i);
  const priceConfidence = getTextProperty(properties, /^Price Confidence$/i);
  const aiPriority = getTextProperty(properties, /^AI Priority$/i);
  const roofType = getTextProperty(properties, /^Roof Type$/i);
  const keywords = getRichTextProperty(properties, /^Search Keywords$/i);
  const notes = [
    getRichTextProperty(properties, /^Problem \/ Diagnosis$/i),
    getRichTextProperty(properties, /^Recommended Scope$/i),
    getRichTextProperty(properties, /^System \/ Materials$/i),
    getRichTextProperty(properties, /^Add-ons \/ Exclusions$/i),
    getRichTextProperty(properties, /^AI Quote Notes$/i),
    getRichTextProperty(properties, /^AI Retrieval Summary$/i),
    getRichTextProperty(properties, /^VAT Notes$/i),
    getRichTextProperty(properties, /^Import Notes$/i)
  ]
    .filter(Boolean)
    .join("\n\n");

  const tags = uniqueStrings([
    ...getMultiValueProperty(properties, /^Job Category$/i),
    roofType,
    sourceType,
    currentPricingUse,
    priceConfidence,
    aiPriority,
    ...(keywords ? splitKeywords(keywords) : [])
  ]);

  return {
    id: crypto.randomUUID(),
    business_id: businessId,
    title,
    category: mapKnowledgeCategory(sourceType, currentPricingUse),
    content: notes || title,
    source_type: "notion_master_library",
    tags,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

async function queryNotionDataSource(dataSourceId: string, cursor?: string | null, pageSize = 25) {
  return notionRequest<NotionQueryResult>(`https://api.notion.com/v1/data_sources/${dataSourceId}/query`, {
    method: "POST",
    body: JSON.stringify({
      page_size: pageSize,
      ...(cursor ? { start_cursor: cursor } : {})
    })
  });
}

async function fetchPageContent(blockId: string) {
  if (!blockId) return "";
  const blocks = await notionRequest<{ results: Array<Record<string, unknown>> }>(
    `https://api.notion.com/v1/blocks/${blockId}/children?page_size=100`
  );
  return flattenBlockText(blocks.results);
}

async function notionRequest<T>(url: string, init?: RequestInit) {
  const env = requireServerEnv();
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.NOTION_API_KEY}`,
      "Content-Type": "application/json",
      "Notion-Version": env.NOTION_VERSION || DEFAULT_NOTION_VERSION,
      ...(init?.headers ?? {})
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Notion request failed: ${response.status} ${errorText}`);
  }

  return (await response.json()) as T;
}

function flattenBlockText(blocks: Array<Record<string, unknown>>) {
  return blocks
    .map((block) => {
      const type = String(block.type ?? "");
      const content = block[type] as Record<string, unknown> | undefined;
      const richText = (content?.rich_text as Array<Record<string, unknown>> | undefined) ?? [];
      return richText.map((item) => String(item.plain_text ?? "")).join("");
    })
    .filter(Boolean)
    .join("\n\n");
}

function mapKnowledgeCategory(sourceType: string | null, currentPricingUse: string | null): KnowledgeBaseRecord["category"] {
  const source = (sourceType ?? "").toLowerCase();
  const pricingUse = (currentPricingUse ?? "").toLowerCase();

  if (source.includes("template") || source.includes("wording")) return "Quote Template";
  if (source.includes("roof report")) return "Roof Report Style";
  if (source.includes("material")) return "Materials System";
  if (source.includes("supplier")) return "Supplier Info";
  if (source.includes("guarantee")) return "Terms";
  if (pricingUse.includes("pricing")) return "Pricing Reference";
  return "Historical Quote";
}

function buildMaterialsExcerpt(properties: Record<string, Record<string, unknown>>) {
  const materials = getRichTextProperty(properties, /^System \/ Materials$/i);
  if (materials) return materials;

  const parts = [
    getNumberProperty(properties, /^Est\. Materials$/i),
    getNumberProperty(properties, /^Est\. Scaffold$/i),
    getNumberProperty(properties, /^Est\. Skip \/ Waste$/i),
    getNumberProperty(properties, /^Est\. Toilet Hire$/i),
    getNumberProperty(properties, /^Est\. Other Site Costs$/i)
  ];

  if (parts.every((item) => item == null)) return null;

  return [
    parts[0] != null ? `Materials ${parts[0]}` : null,
    parts[1] != null ? `Scaffold ${parts[1]}` : null,
    parts[2] != null ? `Waste ${parts[2]}` : null,
    parts[3] != null ? `Toilet ${parts[3]}` : null,
    parts[4] != null ? `Other ${parts[4]}` : null
  ]
    .filter(Boolean)
    .join(" | ");
}

function inferRoofTypeFromText(text: string) {
  const value = text.toLowerCase();
  if (value.includes("flat")) return "Flat";
  if (value.includes("slate")) return "Slate";
  if (value.includes("tile") || value.includes("pitched")) return "Tile";
  if (value.includes("fascia") || value.includes("gutter") || value.includes("soffit")) return "Fascia";
  if (value.includes("chimney") || value.includes("lead")) return "Chimney";
  return null;
}

function inferJobType(title: string, workDescription: string | null) {
  const combined = `${title} ${workDescription ?? ""}`.toLowerCase();
  if (combined.includes("repair")) return "Repair";
  if (combined.includes("replace") || combined.includes("replacement")) return "Replacement";
  if (combined.includes("report")) return "Report";
  if (combined.includes("clean")) return "Cleaning";
  return null;
}

function splitKeywords(text: string) {
  return text
    .split(/[,/|\n]+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 2)
    .slice(0, 10);
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value && value.trim()))));
}

function getTitleProperty(properties: Record<string, Record<string, unknown>>) {
  for (const value of Object.values(properties)) {
    if (value.type === "title") {
      return extractRichText(value.title as Array<Record<string, unknown>> | undefined);
    }
  }
  return null;
}

function getRichTextProperty(properties: Record<string, Record<string, unknown>>, pattern: RegExp) {
  for (const [name, value] of Object.entries(properties)) {
    if (!pattern.test(name)) continue;
    if (value.type === "rich_text") {
      return extractRichText(value.rich_text as Array<Record<string, unknown>> | undefined);
    }
  }
  return null;
}

function getTextProperty(properties: Record<string, Record<string, unknown>>, pattern: RegExp) {
  for (const [name, value] of Object.entries(properties)) {
    if (!pattern.test(name)) continue;
    if (value.type === "select") {
      return (value.select as { name?: string } | null)?.name ?? null;
    }
    if (value.type === "status") {
      return (value.status as { name?: string } | null)?.name ?? null;
    }
    if (value.type === "rich_text") {
      return extractRichText(value.rich_text as Array<Record<string, unknown>> | undefined);
    }
    if (value.type === "title") {
      return extractRichText(value.title as Array<Record<string, unknown>> | undefined);
    }
    if (value.type === "url") {
      return typeof value.url === "string" ? value.url : null;
    }
  }
  return null;
}

function getMultiValueProperty(properties: Record<string, Record<string, unknown>>, pattern: RegExp) {
  const values = new Set<string>();
  for (const [name, value] of Object.entries(properties)) {
    if (!pattern.test(name)) continue;
    if (value.type === "multi_select") {
      for (const item of (value.multi_select as Array<{ name?: string }> | undefined) ?? []) {
        if (item.name) values.add(item.name);
      }
    }
    if (value.type === "select") {
      const selected = (value.select as { name?: string } | null)?.name;
      if (selected) values.add(selected);
    }
  }
  return Array.from(values);
}

function getNumberProperty(properties: Record<string, Record<string, unknown>>, pattern: RegExp) {
  for (const [name, value] of Object.entries(properties)) {
    if (!pattern.test(name)) continue;
    if (value.type === "number" && typeof value.number === "number") {
      return value.number;
    }
    const richText = value.type === "rich_text" ? extractRichText(value.rich_text as Array<Record<string, unknown>> | undefined) : null;
    if (richText) {
      const parsed = Number(richText.replace(/[^0-9.-]+/g, ""));
      if (!Number.isNaN(parsed)) return parsed;
    }
  }
  return null;
}

function getDateProperty(properties: Record<string, Record<string, unknown>>, pattern: RegExp) {
  for (const [name, value] of Object.entries(properties)) {
    if (!pattern.test(name)) continue;
    if (value.type === "date") {
      return (value.date as { start?: string } | null)?.start ?? null;
    }
    if (value.type === "created_time") {
      return String(value.created_time ?? "");
    }
  }
  return null;
}

function extractRichText(items: Array<Record<string, unknown>> | undefined) {
  return (items ?? []).map((item) => String(item.plain_text ?? "")).join("").trim() || null;
}

function getFirstPresent(values: Array<string | null>) {
  return values.find((value) => value && value.trim().length > 0) ?? null;
}

function emptyHistoricalBatch() {
  return {
    records: [] as HistoricalQuoteRecord[],
    nextCursor: null,
    hasMore: false
  };
}

function emptyKnowledgeBatch() {
  return {
    records: [] as KnowledgeBaseRecord[],
    nextCursor: null,
    hasMore: false
  };
}
