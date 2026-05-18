import type { SupabaseClient } from "@supabase/supabase-js";
import type { HistoricalQuoteRecord } from "@/lib/types";

export const BUSINESS_ID = process.env.NEXT_PUBLIC_BUSINESS_ID || "6f9a6dca-a747-4a20-ab87-111808577cc7";

function cleanTag(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function buildHistoricalQuoteKnowledgeContent(quote: Partial<HistoricalQuoteRecord>) {
  return [
    quote.roof_type ? `Roof Type: ${quote.roof_type}` : "",
    quote.job_type ? `Job Type: ${quote.job_type}` : "",
    quote.scope_excerpt ? `Scope:\n${quote.scope_excerpt}` : "",
    quote.materials_excerpt ? `Materials:\n${quote.materials_excerpt}` : "",
    quote.original_total != null ? `Original Total: £${quote.original_total}` : "",
    quote.uplifted_reference_total != null ? `Uplifted Reference Total: £${quote.uplifted_reference_total}` : "",
    quote.imported_text || ""
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function buildHistoricalQuoteKnowledgeTags(quote: Partial<HistoricalQuoteRecord>) {
  const tags = new Set<string>(["historical-quote"]);
  for (const value of [...(quote.tags ?? []), quote.roof_type, quote.job_type, quote.source_year ? String(quote.source_year) : null]) {
    if (value) tags.add(cleanTag(String(value)));
  }
  return Array.from(tags);
}

export function historicalQuoteToKnowledgeEntry(quote: Partial<HistoricalQuoteRecord>) {
  return {
    business_id: quote.business_id || BUSINESS_ID,
    title: quote.title || `Historical Quote - ${quote.roof_type || "Roofing"} ${quote.source_year || ""}`.trim(),
    category: "Historical Quote",
    content: buildHistoricalQuoteKnowledgeContent(quote),
    source_type: "historical_quote",
    tags: buildHistoricalQuoteKnowledgeTags(quote)
  };
}

export async function syncHistoricalQuotesToKnowledgeBase(supabase: SupabaseClient, quotes: Partial<HistoricalQuoteRecord>[]) {
  const entries = quotes.map(historicalQuoteToKnowledgeEntry).filter((entry) => entry.content.trim().length > 0);
  let synced = 0;

  for (let index = 0; index < entries.length; index += 50) {
    const batch = entries.slice(index, index + 50);
    const { error } = await supabase.from("knowledge_base").upsert(batch, {
      onConflict: "business_id,title,category,source_type",
      ignoreDuplicates: false
    });
    if (error) throw new Error(`Knowledge base sync failed: ${error.message}`);
    synced += batch.length;
  }

  return synced;
}

export async function syncAllHistoricalQuotesToKnowledgeBase(supabase: SupabaseClient, businessId = BUSINESS_ID) {
  const { data, error } = await supabase.from("historical_quotes").select("*").eq("business_id", businessId);
  if (error) throw new Error(error.message);
  const quotes = (data as HistoricalQuoteRecord[] | null) ?? [];
  const synced = await syncHistoricalQuotesToKnowledgeBase(supabase, quotes);
  return { synced, total: quotes.length };
}
