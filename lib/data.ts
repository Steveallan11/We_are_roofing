import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  getMockBundle,
  getMockDashboardStats,
  MOCK_BUSINESS,
  MOCK_CUSTOMERS,
  MOCK_JOBS,
  MOCK_KNOWLEDGE_BASE,
  MOCK_MATERIALS,
  MOCK_QUOTES,
  MOCK_SURVEYS
} from "@/lib/mock-data";
import type {
  Business,
  Customer,
  DashboardStats,
  Job,
  JobBundle,
  KnowledgeBaseRecord,
  QuoteRecord,
  SurveyRecord
} from "@/lib/types";

function canUseSupabase() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
      process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export async function getBusiness(): Promise<Business> {
  if (!canUseSupabase()) {
    return MOCK_BUSINESS;
  }

  const supabase = createSupabaseAdminClient();
  const { data } = await supabase.from("businesses").select("*").limit(1).single();
  return (data as Business | null) ?? MOCK_BUSINESS;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  if (!canUseSupabase()) {
    return getMockDashboardStats();
  }

  const supabase = createSupabaseAdminClient();
  const { data } = await supabase.from("jobs").select("status");
  const jobs = (data as Array<Pick<Job, "status">> | null) ?? [];

  return {
    totalJobs: jobs.length,
    readyForQuote: jobs.filter((job) => job.status === "Ready For AI Quote").length,
    readyToSend: jobs.filter((job) => job.status === "Ready To Send").length,
    quoteSent: jobs.filter((job) => job.status === "Quote Sent").length,
    materialsNeeded: jobs.filter((job) => job.status === "Materials Needed").length
  };
}

export async function getJobs(): Promise<Array<Job & { customer?: Customer | null; quote?: QuoteRecord | null }>> {
  if (!canUseSupabase()) {
    return MOCK_JOBS.map((job) => ({
      ...job,
      customer: MOCK_CUSTOMERS.find((customer) => customer.id === job.customer_id) ?? null,
      quote: [...MOCK_QUOTES].reverse().find((quote) => quote.job_id === job.id) ?? null
    }));
  }

  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("jobs")
    .select("*, customers(*), quotes(*)")
    .order("created_at", { ascending: false });

  return ((data as Array<Record<string, unknown>> | null) ?? []).map((job) => ({
    ...(job as unknown as Job),
    customer: (job.customers as Customer | null) ?? null,
    quote: Array.isArray(job.quotes) ? ((job.quotes.at(-1) as QuoteRecord | undefined) ?? null) : null
  }));
}

export async function getJobBundle(jobId: string): Promise<JobBundle | null> {
  if (!canUseSupabase()) {
    return getMockBundle(jobId);
  }

  const supabase = createSupabaseAdminClient();
  const { data: job } = await supabase.from("jobs").select("*").eq("id", jobId).single();
  if (!job) return null;

  const [businessResult, customerResult, surveyResult, quoteResult, materialResult, photoResult] = await Promise.all([
    supabase.from("businesses").select("*").eq("id", job.business_id).single(),
    supabase.from("customers").select("*").eq("id", job.customer_id).single(),
    supabase.from("surveys").select("*").eq("job_id", jobId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("quotes").select("*").eq("job_id", jobId).order("version_number", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("materials").select("*").eq("job_id", jobId).order("created_at", { ascending: true }),
    supabase.from("job_photos").select("*").eq("job_id", jobId).order("uploaded_at", { ascending: false })
  ]);

  return {
    business: (businessResult.data as Business | null) ?? MOCK_BUSINESS,
    customer: customerResult.data as Customer,
    job: job as Job,
    survey: (surveyResult.data as SurveyRecord | null) ?? null,
    quote: (quoteResult.data as QuoteRecord | null) ?? null,
    materials: (materialResult.data as JobBundle["materials"] | null) ?? [],
    photos: (photoResult.data as JobBundle["photos"] | null) ?? []
  };
}

export async function getKnowledgeBase(): Promise<KnowledgeBaseRecord[]> {
  if (!canUseSupabase()) {
    return MOCK_KNOWLEDGE_BASE;
  }

  const supabase = createSupabaseAdminClient();
  const { data } = await supabase.from("knowledge_base").select("*").order("category", { ascending: true });
  return (data as KnowledgeBaseRecord[] | null) ?? MOCK_KNOWLEDGE_BASE;
}

export function getEmptySurvey(): SurveyRecord {
  return {
    id: "draft-survey",
    job_id: "draft-job",
    surveyor_name: "Andrew Bailey",
    access_notes: "",
    scaffold_required: false,
    scaffold_notes: "",
    roof_condition: "",
    problem_observed: "",
    suspected_cause: "",
    recommended_works: "",
    measurements: "",
    weather_notes: "",
    safety_notes: "",
    customer_concerns: "",
    voice_note_transcript: "",
    raw_notes: "",
    survey_type: "Flat Roof",
    roof_type: "Flat",
    no_photo_confirmation: false,
    adaptive_sections: {}
  };
}
