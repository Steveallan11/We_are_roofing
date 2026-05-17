import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { MOCK_BUSINESS } from "@/lib/mock-data";
import type { Business, GeneratedQuote, QuoteRecord } from "@/lib/types";

function hasSupabaseConfig() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
      process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export function canPersistToSupabase() {
  return hasSupabaseConfig();
}

export async function ensureBusinessRecord(): Promise<Business> {
  if (!hasSupabaseConfig()) {
    return MOCK_BUSINESS;
  }

  const supabase = createSupabaseAdminClient();
  const { data: existing } = await supabase.from("businesses").select("*").limit(1).maybeSingle();
  if (existing) {
    return existing as Business;
  }

  const { data: inserted, error } = await supabase
    .from("businesses")
    .insert({
      business_name: MOCK_BUSINESS.business_name,
      trading_address: MOCK_BUSINESS.trading_address,
      phone: MOCK_BUSINESS.phone,
      email: MOCK_BUSINESS.email,
      website: MOCK_BUSINESS.website,
      logo_url: MOCK_BUSINESS.logo_url,
      vat_registered: MOCK_BUSINESS.vat_registered,
      vat_rate: MOCK_BUSINESS.vat_rate,
      company_number: MOCK_BUSINESS.company_number,
      payment_terms: MOCK_BUSINESS.payment_terms,
      quote_valid_days: MOCK_BUSINESS.quote_valid_days
    })
    .select("*")
    .single();

  if (error || !inserted) {
    throw new Error(error?.message ?? "Unable to create business record.");
  }

  return inserted as Business;
}

export async function getNextQuoteVersionAndRef(jobId: string) {
  const supabase = createSupabaseAdminClient();
  const { data: latestQuote } = await supabase
    .from("quotes")
    .select("version_number")
    .eq("job_id", jobId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { count } = await supabase.from("quotes").select("*", { count: "exact", head: true });
  const versionNumber = ((latestQuote?.version_number as number | undefined) ?? 0) + 1;
  const quoteRef = `WR-Q-${String((count ?? 0) + 1001).padStart(4, "0")}`;

  return { versionNumber, quoteRef };
}

export async function getNextInvoiceRef() {
  const supabase = createSupabaseAdminClient();
  const { count } = await supabase.from("invoices").select("*", { count: "exact", head: true });
  return `WR-I-${String((count ?? 0) + 1001).padStart(4, "0")}`;
}

export async function getNextJobRef() {
  const supabase = createSupabaseAdminClient();
  const { count } = await supabase.from("jobs").select("*", { count: "exact", head: true });
  return `WR-J-${String((count ?? 0) + 1001).padStart(4, "0")}`;
}

export function deriveQuoteStatus(quote: GeneratedQuote): QuoteRecord["status"] {
  if (quote.confidence === "Low" || quote.missing_info.length > 0) {
    return "Needs Review";
  }
  return "Draft";
}
