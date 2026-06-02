import type { SupabaseClient } from "@supabase/supabase-js";
import type { HistoricalQuoteRecord } from "@/lib/types";
import { currency } from "@/lib/utils";

export const BUSINESS_ID = process.env.NEXT_PUBLIC_BUSINESS_ID || "6f9a6dca-a747-4a20-ab87-111808577cc7";

function cleanTag(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function buildHistoricalQuoteKnowledgeContent(quote: Partial<HistoricalQuoteRecord>) {
  const originalTotal = quote.original_total != null ? currency(Number(quote.original_total)) : "";
  const upliftedTotal = quote.uplifted_reference_total != null ? currency(Number(quote.uplifted_reference_total)) : "";

  return [
    quote.roof_type ? `Roof Type: ${quote.roof_type}` : "",
    quote.job_type ? `Job Type: ${quote.job_type}` : "",
    quote.scope_excerpt ? `Scope:\n${quote.scope_excerpt}` : "",
    quote.materials_excerpt ? `Materials:\n${quote.materials_excerpt}` : "",
    originalTotal ? `Original Total: ${originalTotal}` : "",
    upliftedTotal ? `Uplifted Reference Total: ${upliftedTotal}` : "",
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
  let created = 0;
  let updated = 0;

  for (let index = 0; index < entries.length; index += 50) {
    const batch = entries.slice(index, index + 50);
    const existing = await supabase
      .from("knowledge_base")
      .select("title")
      .eq("business_id", batch[0]?.business_id ?? BUSINESS_ID)
      .eq("category", "Historical Quote")
      .eq("source_type", "historical_quote")
      .in("title", batch.map((entry) => entry.title));

    if (existing.error) throw new Error(`Knowledge base sync check failed: ${existing.error.message}`);
    const existingTitles = new Set(((existing.data as Array<{ title: string }> | null) ?? []).map((entry) => entry.title));

    const { error } = await supabase.from("knowledge_base").upsert(batch, {
      onConflict: "business_id,title,category,source_type",
      ignoreDuplicates: false
    });
    if (error) throw new Error(`Knowledge base sync failed: ${error.message}`);
    synced += batch.length;
    created += batch.filter((entry) => !existingTitles.has(entry.title)).length;
    updated += batch.filter((entry) => existingTitles.has(entry.title)).length;
  }

  return { synced, created, updated, skipped: quotes.length - entries.length };
}

export async function syncAllHistoricalQuotesToKnowledgeBase(supabase: SupabaseClient, businessId = BUSINESS_ID) {
  const { data, error } = await supabase.from("historical_quotes").select("*").eq("business_id", businessId);
  if (error) throw new Error(error.message);
  const quotes = (data as HistoricalQuoteRecord[] | null) ?? [];
  const result = await syncHistoricalQuotesToKnowledgeBase(supabase, quotes);
  return { ...result, total: quotes.length };
}
