import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { NurtureSequence, NurtureTemplate } from "@/lib/types";

// Template cache with TTL
let templateCache: { templates: NurtureTemplate[]; timestamp: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function startNurtureSequence(quoteId: string): Promise<NurtureSequence | null> {
  const supabase = createSupabaseAdminClient();

  // Get quote and job details
  const { data: quote, error: quoteError } = await supabase
    .from("quotes")
    .select("id, job_id, customer_email_subject")
    .eq("id", quoteId)
    .single();

  if (quoteError || !quote) {
    console.error("Failed to fetch quote for nurture sequence:", quoteError);
    return null;
  }

  // Get job and customer details
  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .select("id, job_title, customer_id")
    .eq("id", quote.job_id)
    .single();

  if (jobError || !job) {
    console.error("Failed to fetch job for nurture sequence:", jobError);
    return null;
  }

  // Insert directly and rely on the unique(quote_id) index to catch races —
  // a prior check-then-insert here allowed two concurrent triggers (e.g. the
  // quote-send email path and a manual "start") to both create a sequence.
  const { data: sequence, error: seqError } = await supabase
    .from("nurture_sequences")
    .insert({
      quote_id: quoteId,
      job_id: quote.job_id,
      customer_id: job.customer_id
    })
    .select("*")
    .single();

  if (seqError) {
    if (seqError.code === "23505") {
      // Sequence already started by a concurrent request — not an error.
      return null;
    }
    console.error("Failed to create nurture sequence:", seqError);
    return null;
  }

  return sequence as NurtureSequence;
}

export async function getNurtureSequence(quoteId: string): Promise<NurtureSequence | null> {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("nurture_sequences")
    .select("*")
    .eq("quote_id", quoteId)
    .maybeSingle();

  if (error) {
    console.error("Failed to fetch nurture sequence:", error);
    return null;
  }

  return data as NurtureSequence | null;
}

export async function getNurtureTemplates(): Promise<NurtureTemplate[]> {
  // Check cache
  if (templateCache && Date.now() - templateCache.timestamp < CACHE_TTL) {
    return templateCache.templates;
  }

  const supabase = createSupabaseAdminClient();

  // Get business ID
  const { data: businesses } = await supabase.from("businesses").select("id").limit(1);
  const businessId = businesses?.[0]?.id;

  if (!businessId) {
    console.warn("No business found, using empty templates");
    return [];
  }

  const { data: templates, error } = await supabase
    .from("nurture_templates")
    .select("*")
    .eq("business_id", businessId)
    .eq("is_active", true)
    .order("day_number", { ascending: true });

  if (error) {
    console.error("Failed to fetch nurture templates:", error);
    return [];
  }

  const result = (templates || []) as NurtureTemplate[];

  // Cache the result
  templateCache = { templates: result, timestamp: Date.now() };

  return result;
}

export async function getNurtureTemplate(dayNumber: number): Promise<NurtureTemplate | null> {
  const templates = await getNurtureTemplates();
  return templates.find((t) => t.day_number === dayNumber) || null;
}

export async function getAllNurtureTemplateDays(): Promise<number[]> {
  const templates = await getNurtureTemplates();
  return templates.map((t) => t.day_number).sort((a, b) => a - b);
}
