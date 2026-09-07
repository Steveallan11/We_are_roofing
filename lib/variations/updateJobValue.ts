import type { SupabaseClient } from "@supabase/supabase-js";
import type { JobVariationRecord, QuoteRecord } from "@/lib/types";
import { getQuotePipelineValue } from "@/lib/quotes/value";

export async function updateJobValueWithVariations(supabase: SupabaseClient, jobId: string) {
  const [quoteResult, variationsResult] = await Promise.all([
    supabase.from("quotes").select("*").eq("job_id", jobId).order("version_number", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("job_variations").select("total,status").eq("job_id", jobId).in("status", ["Accepted", "Invoiced", "Paid"])
  ]);
  if (quoteResult.error || variationsResult.error) return;
  const quote = quoteResult.data as QuoteRecord | null;
  const originalValue = quote ? getQuotePipelineValue(quote) ?? Number(quote.total ?? 0) : 0;
  const additionalValue = ((variationsResult.data as Pick<JobVariationRecord, "total" | "status">[] | null) ?? []).reduce(
    (sum, variation) => sum + Number(variation.total ?? 0),
    0
  );
  await supabase.from("jobs").update({ estimated_value: originalValue + additionalValue, updated_at: new Date().toISOString() }).eq("id", jobId);
}
