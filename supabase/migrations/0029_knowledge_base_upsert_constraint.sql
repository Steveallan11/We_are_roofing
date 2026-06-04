-- Add unique constraint to support upsert on knowledge_base table.
-- Required by syncHistoricalQuotesToKnowledgeBase which uses
-- onConflict: "business_id,title,category,source_type"

CREATE UNIQUE INDEX IF NOT EXISTS knowledge_base_business_title_category_source_idx
  ON public.knowledge_base (business_id, title, category, source_type);
