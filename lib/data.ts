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
import { groupJobsIntoColumns } from "@/lib/job-workflow";
import type {
  Business,
  BookingRecord,
  Customer,
  DashboardStats,
  EmailLog,
  HistoricalQuoteRecord,
  InvoiceRecord,
  Job,
  JobBundle,
  JobDocumentRecord,
  KanbanColumn,
  KnowledgeBaseRecord,
  LabourPersonRecord,
  LabourPlanRecord,
  LabourRateRecord,
  LabourEntryRecord,
  PricingRuleRecord,
  QuoteRecord,
  PaymentScheduleRecord,
  PaymentStageRecord,
  ConversationRecord,
  MessageRecord,
  MessageTemplateRecord,
  SupplierRecord,
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

export async function getJobs(): Promise<Array<Job & { customer?: Customer | null; quote?: QuoteRecord | null; documents?: JobDocumentRecord[]; invoices?: InvoiceRecord[] }>> {
  if (!canUseSupabase()) {
    return MOCK_JOBS.map((job) => ({
      ...job,
      customer: MOCK_CUSTOMERS.find((customer) => customer.id === job.customer_id) ?? null,
      quote: [...MOCK_QUOTES].reverse().find((quote) => quote.job_id === job.id) ?? null,
      documents: [],
      invoices: []
    }));
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("jobs")
    .select("*, customers(*), quotes(*)")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Unable to load jobs:", error.message);
    return [];
  }

  const rows = (data as Array<Record<string, unknown>> | null) ?? [];
  const jobIds = rows.map((job) => String(job.id)).filter(Boolean);
  const [documentsResult, invoicesResult] = jobIds.length
    ? await Promise.all([
        supabase.from("job_documents").select("*").in("job_id", jobIds).order("created_at", { ascending: false }),
        supabase.from("invoices").select("*").in("job_id", jobIds).order("created_at", { ascending: false })
      ])
    : [{ data: [] as JobDocumentRecord[], error: null }, { data: [] as InvoiceRecord[], error: null }];

  if (documentsResult.error) {
    console.warn("Job documents could not be loaded:", documentsResult.error.message);
  }
  if (invoicesResult.error) {
    console.warn("Invoices could not be loaded:", invoicesResult.error.message);
  }

  const documentsByJob = new Map<string, JobDocumentRecord[]>();
  for (const document of ((documentsResult.data as JobDocumentRecord[] | null) ?? [])) {
    const list = documentsByJob.get(document.job_id) ?? [];
    list.push(document);
    documentsByJob.set(document.job_id, list);
  }

  const invoicesByJob = new Map<string, InvoiceRecord[]>();
  for (const invoice of ((invoicesResult.data as InvoiceRecord[] | null) ?? [])) {
    const list = invoicesByJob.get(invoice.job_id) ?? [];
    list.push(invoice);
    invoicesByJob.set(invoice.job_id, list);
  }

  return rows.map((job) => {
    const quotes = Array.isArray(job.quotes) ? ([...(job.quotes as QuoteRecord[])] as QuoteRecord[]) : [];
    const invoices = invoicesByJob.get(String(job.id)) ?? [];
    const documents = documentsByJob.get(String(job.id)) ?? [];

    quotes.sort((left, right) => {
      const versionDiff = Number(right.version_number ?? 0) - Number(left.version_number ?? 0);
      if (versionDiff !== 0) return versionDiff;
      return new Date(right.created_at ?? 0).getTime() - new Date(left.created_at ?? 0).getTime();
    });
    invoices.sort((left, right) => new Date(right.created_at ?? 0).getTime() - new Date(left.created_at ?? 0).getTime());
    documents.sort((left, right) => new Date(right.created_at ?? 0).getTime() - new Date(left.created_at ?? 0).getTime());

    return {
      ...(job as unknown as Job),
      customer: (job.customers as Customer | null) ?? null,
      quote: quotes[0] ?? null,
      documents,
      invoices
    };
  });
}

export async function getJobBundle(jobId: string): Promise<JobBundle | null> {
  if (!canUseSupabase()) {
    return getMockBundle(jobId);
  }

  const supabase = createSupabaseAdminClient();
  const { data: job } = await supabase.from("jobs").select("*").eq("id", jobId).single();
  if (!job) return null;

  const [businessResult, customerResult, surveyResult, quoteResult, invoiceResult, materialResult, photoResult, documentResult, emailResult, activityResult] = await Promise.all([
    supabase.from("businesses").select("*").eq("id", job.business_id).single(),
    supabase.from("customers").select("*").eq("id", job.customer_id).single(),
    supabase.from("surveys").select("*").eq("job_id", jobId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("quotes").select("*").eq("job_id", jobId).order("version_number", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("invoices").select("*").eq("job_id", jobId).order("created_at", { ascending: false }),
    supabase.from("materials").select("*").eq("job_id", jobId).order("created_at", { ascending: true }),
    supabase.from("job_photos").select("*").eq("job_id", jobId).order("uploaded_at", { ascending: false }),
    supabase.from("job_documents").select("*").eq("job_id", jobId).order("created_at", { ascending: false }),
    supabase.from("email_logs").select("*").eq("job_id", jobId).order("sent_at", { ascending: false }),
    supabase.from("job_activity").select("*").eq("job_id", jobId).order("created_at", { ascending: false }).limit(100)
  ]);
  const labourPlan = await getJobLabourPlan(jobId);

  return {
    business: (businessResult.data as Business | null) ?? MOCK_BUSINESS,
    customer: customerResult.data as Customer,
    job: job as Job,
    survey: (surveyResult.data as SurveyRecord | null) ?? null,
    quote: (quoteResult.data as QuoteRecord | null) ?? null,
    invoices: (invoiceResult.data as InvoiceRecord[] | null) ?? [],
    materials: (materialResult.data as JobBundle["materials"] | null) ?? [],
    labour_plan: labourPlan,
    photos: (photoResult.data as JobBundle["photos"] | null) ?? [],
    documents: (documentResult.data as JobDocumentRecord[] | null) ?? [],
    email_logs: (emailResult.data as EmailLog[] | null) ?? [],
    activity: activityResult.error ? [] : ((activityResult.data as JobBundle["activity"]) ?? [])
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

export async function getCustomers(): Promise<Customer[]> {
  if (!canUseSupabase()) {
    return MOCK_CUSTOMERS;
  }

  const supabase = createSupabaseAdminClient();
  const { data } = await supabase.from("customers").select("*").order("created_at", { ascending: false });
  return (data as Customer[] | null) ?? MOCK_CUSTOMERS;
}

export async function getConversations(): Promise<ConversationRecord[]> {
  if (!canUseSupabase()) return [];

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("conversations")
    .select("*, customers(*), jobs(*), quotes(*)")
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .order("updated_at", { ascending: false });

  if (error) {
    if (!isMissingRelationError(error.message)) {
      console.warn("Conversations could not be loaded:", error.message);
    }
    return [];
  }

  return ((data as Array<Record<string, unknown>> | null) ?? []).map((conversation) => ({
    ...(conversation as unknown as ConversationRecord),
    customer: (conversation.customers as Customer | null) ?? null,
    job: (conversation.jobs as Job | null) ?? null,
    quote: (conversation.quotes as QuoteRecord | null) ?? null
  }));
}

export async function getMessages(conversationId: string): Promise<MessageRecord[]> {
  if (!canUseSupabase()) return [];

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("sent_at", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    if (!isMissingRelationError(error.message)) {
      console.warn("Messages could not be loaded:", error.message);
    }
    return [];
  }

  return (data as MessageRecord[] | null) ?? [];
}

export async function getMessageTemplates(): Promise<MessageTemplateRecord[]> {
  if (!canUseSupabase()) return [];

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("message_templates")
    .select("*")
    .eq("is_active", true)
    .order("category", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    if (!isMissingRelationError(error.message)) {
      console.warn("Message templates could not be loaded:", error.message);
    }
    return [];
  }

  return (data as MessageTemplateRecord[] | null) ?? [];
}

export async function getUnreadConversationCount(): Promise<number> {
  if (!canUseSupabase()) return 0;
  const conversations = await getConversations();
  return conversations.reduce((sum, conversation) => sum + Number(conversation.unread_count ?? 0), 0);
}

export type UnreadCustomerReply = {
  conversation_id: string;
  job_id: string | null;
  customer_id: string | null;
  quote_id: string | null;
  subject: string | null;
  preview: string | null;
  channel: string;
  last_message_at: string | null;
  unread_count: number;
  customer_name: string | null;
  job_ref: string | null;
  job_title: string | null;
};

/**
 * Conversations with at least one unread customer message.
 * Used by Today "Customer replies" needs-attention block.
 */
export async function getUnreadCustomerReplies(): Promise<UnreadCustomerReply[]> {
  if (!canUseSupabase()) return [];
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("conversations")
    .select("id, job_id, customer_id, quote_id, subject, last_message_preview, primary_channel, last_message_at, unread_count, customers(full_name), jobs(job_ref, job_title)")
    .gt("unread_count", 0)
    .neq("status", "resolved")
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(50);

  if (error) {
    if (!isMissingRelationError(error.message)) {
      console.warn("Unread conversations could not be loaded:", error.message);
    }
    return [];
  }

  return ((data as Array<Record<string, unknown>> | null) ?? []).map((row) => ({
    conversation_id: String(row.id ?? ""),
    job_id: row.job_id ? String(row.job_id) : null,
    customer_id: row.customer_id ? String(row.customer_id) : null,
    quote_id: row.quote_id ? String(row.quote_id) : null,
    subject: (row.subject as string | null) ?? null,
    preview: (row.last_message_preview as string | null) ?? null,
    channel: String(row.primary_channel ?? "email"),
    last_message_at: (row.last_message_at as string | null) ?? null,
    unread_count: Number(row.unread_count ?? 0),
    customer_name: ((row.customers as { full_name?: string } | null) ?? null)?.full_name ?? null,
    job_ref: ((row.jobs as { job_ref?: string } | null) ?? null)?.job_ref ?? null,
    job_title: ((row.jobs as { job_title?: string } | null) ?? null)?.job_title ?? null
  }));
}

function isMissingRelationError(message: string) {
  return /relation .* does not exist|schema cache|could not find the table/i.test(message);
}

export type DiaryTask = {
  id: string;
  entry_type: "task" | "reminder";
  title: string | null;
  body: string | null;
  task_due_date: string | null;
  task_assigned_to: string | null;
  task_completed: boolean;
  linked_job_id: string | null;
  created_at: string;
};

/**
 * Incomplete tasks/reminders due today or earlier.
 * Used by Today "Tasks due" section.
 */
export async function getUpcomingDiaryTasks(): Promise<DiaryTask[]> {
  if (!canUseSupabase()) return [];
  const supabase = createSupabaseAdminClient();
  const today = new Date().toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("diary_entries")
    .select("id, entry_type, title, body, task_due_date, task_assigned_to, task_completed, linked_job_id, created_at")
    .in("entry_type", ["task", "reminder"])
    .eq("task_completed", false)
    .lte("task_due_date", today)
    .order("task_due_date", { ascending: true })
    .limit(20);

  if (error) {
    if (!isMissingRelationError(error.message)) {
      console.warn("Upcoming diary tasks could not be loaded:", error.message);
    }
    return [];
  }

  return ((data as Array<Record<string, unknown>> | null) ?? []).map((row) => ({
    id: String(row.id ?? ""),
    entry_type: (row.entry_type as "task" | "reminder") ?? "task",
    title: (row.title as string | null) ?? null,
    body: (row.body as string | null) ?? null,
    task_due_date: (row.task_due_date as string | null) ?? null,
    task_assigned_to: (row.task_assigned_to as string | null) ?? null,
    task_completed: Boolean(row.task_completed),
    linked_job_id: row.linked_job_id ? String(row.linked_job_id) : null,
    created_at: String(row.created_at ?? "")
  }));
}

export async function getHistoricalQuotes(limit = 100): Promise<HistoricalQuoteRecord[]> {
  if (!canUseSupabase()) {
    return [];
  }

  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("historical_quotes")
    .select("*")
    .order("source_year", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data as HistoricalQuoteRecord[] | null) ?? [];
}

export async function getPricingRules(): Promise<PricingRuleRecord[]> {
  if (!canUseSupabase()) {
    return [];
  }

  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("pricing_rules")
    .select("*")
    .order("year_from", { ascending: true, nullsFirst: false });

  return (data as PricingRuleRecord[] | null) ?? [];
}

export async function getSuppliers(): Promise<SupplierRecord[]> {
  if (!canUseSupabase()) {
    return [];
  }

  const business = await getBusiness();
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase.from("suppliers").select("*").eq("business_id", business.id).order("name", { ascending: true });
  return (data as SupplierRecord[] | null) ?? [];
}

export async function getLabourRates(): Promise<LabourRateRecord[]> {
  if (!canUseSupabase()) {
    return [];
  }

  const business = await getBusiness();
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("labour_rates")
    .select("*")
    .eq("business_id", business.id)
    .order("active", { ascending: false })
    .order("role_name", { ascending: true });

  if (error) {
    if (!isMissingRelationError(error.message)) {
      console.warn("Labour rates could not be loaded:", error.message);
    }
    return [];
  }

  return (data as LabourRateRecord[] | null) ?? [];
}

export async function getLabourPeople(): Promise<LabourPersonRecord[]> {
  if (!canUseSupabase()) {
    return [];
  }

  const business = await getBusiness();
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("labour_people")
    .select("*")
    .eq("business_id", business.id)
    .order("is_active", { ascending: false })
    .order("full_name", { ascending: true });

  if (error) {
    if (!isMissingRelationError(error.message)) {
      console.warn("Labour people could not be loaded:", error.message);
    }
    return [];
  }

  return (data as LabourPersonRecord[] | null) ?? [];
}

export async function getJobLabourPlan(jobId: string): Promise<LabourPlanRecord | null> {
  if (!canUseSupabase()) return null;

  const supabase = createSupabaseAdminClient();
  const { data: plan, error: planError } = await supabase
    .from("labour_plans")
    .select("*")
    .eq("job_id", jobId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (planError) {
    if (!isMissingRelationError(planError.message)) {
      console.warn("Labour plan could not be loaded:", planError.message);
    }
    return null;
  }
  if (!plan) return null;

  const { data: entries, error: entriesError } = await supabase
    .from("labour_entries")
    .select("*, labour_people(*)")
    .eq("plan_id", plan.id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (entriesError) {
    if (!isMissingRelationError(entriesError.message)) {
      console.warn("Labour entries could not be loaded:", entriesError.message);
    }
    return { ...(plan as LabourPlanRecord), entries: [] };
  }

  const mappedEntries = ((entries as Array<Record<string, unknown>> | null) ?? []).map((entry) => ({
    ...(entry as unknown as LabourEntryRecord),
    person: (entry.labour_people as LabourPersonRecord | null) ?? null
  }));

  return { ...(plan as LabourPlanRecord), entries: mappedEntries };
}

export async function getBookings(): Promise<BookingRecord[]> {
  if (!canUseSupabase()) return [];

  const business = await getBusiness();
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("bookings")
    .select("*, jobs(*, customers(*))")
    .eq("business_id", business.id)
    .order("date", { ascending: true })
    .order("time_start", { ascending: true });

  if (error) {
    console.warn("Bookings could not be loaded:", error.message);
    return [];
  }

  return ((data as Array<Record<string, unknown>> | null) ?? []).map((booking) => ({
    ...(booking as unknown as BookingRecord),
    job: booking.jobs as Job | null,
    customer: (booking.jobs as { customers?: Customer | null } | null)?.customers ?? null
  }));
}

export async function getPaymentSchedule(jobId: string): Promise<PaymentScheduleRecord | null> {
  if (!canUseSupabase()) return null;

  const supabase = createSupabaseAdminClient();
  const { data: schedule } = await supabase.from("payment_schedules").select("*").eq("job_id", jobId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!schedule) return null;

  const { data: stages } = await supabase.from("payment_stages").select("*").eq("schedule_id", schedule.id).order("stage_number", { ascending: true });
  return { ...(schedule as PaymentScheduleRecord), stages: (stages as PaymentStageRecord[] | null) ?? [] };
}

export async function getKanbanColumns(): Promise<Array<KanbanColumn & { customer?: Customer | null; quote?: QuoteRecord | null }>> {
  const jobs = await getJobs();
  return groupJobsIntoColumns(jobs as Array<Job & { customer?: Customer | null; quote?: QuoteRecord | null }>);
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
