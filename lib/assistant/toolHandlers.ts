import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { currency, formatDate } from "@/lib/utils";
import { ensureBusinessRecord, getNextJobRef } from "@/lib/workflows";
import type { AssistantRouteContext, ToolExecutionResult } from "@/lib/assistant/types";
import type { JobStatus, QuoteStatus } from "@/lib/types";

const VALID_JOB_STATUSES: JobStatus[] = [
  "New Lead",
  "Survey Needed",
  "Survey Complete",
  "Ready For AI Quote",
  "Quote Drafted",
  "Ready To Send",
  "Quote Sent",
  "Follow-Up Needed",
  "Accepted",
  "Materials Needed",
  "Booked",
  "Completed",
  "Lost",
  "Archived"
];

const VALID_QUOTE_STATUSES: QuoteStatus[] = ["Draft", "Needs Review", "Approved", "Sent", "Accepted", "Declined"];

function getSupabase() {
  return createSupabaseAdminClient();
}

async function getBusinessId() {
  const business = await ensureBusinessRecord();
  return business.id;
}

async function resolveJobByRef(jobRef: string) {
  const supabase = getSupabase();
  const { data, error } = await supabase.from("jobs").select("*").eq("job_ref", jobRef).single();
  if (error || !data) {
    throw new Error(error?.message ?? `Job ${jobRef} was not found.`);
  }
  return data;
}

async function resolveQuoteByRef(quoteRef: string) {
  const supabase = getSupabase();
  const { data, error } = await supabase.from("quotes").select("*").eq("quote_ref", quoteRef).single();
  if (error || !data) {
    throw new Error(error?.message ?? `Quote ${quoteRef} was not found.`);
  }
  return data;
}

function startOfPeriod(period: string) {
  const now = new Date();
  if (period === "this_week") {
    const day = now.getDay() || 7;
    const start = new Date(now);
    start.setDate(now.getDate() - (day - 1));
    start.setHours(0, 0, 0, 0);
    return start;
  }
  if (period === "last_month") {
    return new Date(now.getFullYear(), now.getMonth() - 1, 1);
  }
  if (period === "this_year") {
    return new Date(now.getFullYear(), 0, 1);
  }
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function endOfPeriod(period: string) {
  const now = new Date();
  if (period === "this_week") {
    const start = startOfPeriod(period);
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    return end;
  }
  if (period === "last_month") {
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }
  if (period === "this_year") {
    return new Date(now.getFullYear() + 1, 0, 1);
  }
  return new Date(now.getFullYear(), now.getMonth() + 1, 1);
}

function timestampPrefix() {
  return `[${new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date())}]`;
}

function getJoinedCustomerName(value: unknown) {
  if (!value || Array.isArray(value) || typeof value !== "object") {
    return "";
  }
  const maybeName = (value as { full_name?: unknown }).full_name;
  return typeof maybeName === "string" ? maybeName : "";
}

export async function getAssistantPromptContext(routeContext?: AssistantRouteContext) {
  const supabase = getSupabase();
  const [businessResult, jobsResult, quotesResult, currentJobSummary] = await Promise.all([
    supabase.from("businesses").select("id, business_name").limit(1).single(),
    supabase.from("jobs").select("id, status"),
    supabase.from("quotes").select("id, status"),
    routeContext?.jobId ? getCurrentJobSummary(routeContext.jobId) : Promise.resolve(null)
  ]);

  return {
    businessId: businessResult.data?.id ?? (await getBusinessId()),
    businessName: businessResult.data?.business_name ?? "We Are Roofing UK Ltd",
    openJobsCount: (jobsResult.data ?? []).filter((job) => !["Completed", "Lost", "Archived"].includes(job.status)).length,
    pendingQuotesCount: (quotesResult.data ?? []).filter((quote) => ["Draft", "Needs Review", "Approved"].includes(quote.status)).length,
    currentJobSummary
  };
}

async function getCurrentJobSummary(jobId: string) {
  const supabase = getSupabase();
  const { data } = await supabase
    .from("jobs")
    .select("job_ref, job_title, property_address, status, roof_type, job_type, customers(full_name)")
    .eq("id", jobId)
    .single();

  if (!data) return null;
  const customerName = getJoinedCustomerName((data as { customers?: unknown }).customers) || "Unknown customer";
  return `${data.job_ref ?? "WR-J-TBC"} for ${customerName} at ${data.property_address}. Status: ${data.status}. ${data.job_type ?? "Unknown job type"} / ${data.roof_type ?? "Unknown roof type"}.`;
}

export async function getAssistantStatus() {
  const overdue = await getOverdueItems();
  const overdueCount = Array.isArray(overdue.data) ? overdue.data.length : 0;
  return {
    overdueCount
  };
}

async function getJobs(input: Record<string, unknown>): Promise<ToolExecutionResult> {
  const supabase = getSupabase();
  const limit = Math.max(1, Math.min(Number(input.limit ?? 10), 50));
  const { data, error } = await supabase
    .from("jobs")
    .select("id, job_ref, job_title, property_address, status, estimated_value, follow_up_date, updated_at, customers(full_name)")
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  let rows = (data ?? []).filter((job) => {
    if (input.status && job.status !== input.status) return false;
    if (input.overdue_followup) {
      if (!job.follow_up_date) return false;
      if (new Date(job.follow_up_date) >= new Date()) return false;
    }
    if (input.customer_name) {
      const name = getJoinedCustomerName((job as { customers?: unknown }).customers);
      if (!name.toLowerCase().includes(String(input.customer_name).toLowerCase())) return false;
    }
    return true;
  });

  rows = rows.slice(0, limit);
  return {
    ok: true,
    summary: rows.length > 0 ? `Found ${rows.length} job${rows.length === 1 ? "" : "s"}.` : "No jobs matched that filter.",
    data: rows.map((job) => ({
      job_ref: job.job_ref,
      title: job.job_title,
      customer_name: getJoinedCustomerName((job as { customers?: unknown }).customers),
      status: job.status,
      property_address: job.property_address,
      estimated_value: job.estimated_value ? currency(Number(job.estimated_value)) : null,
      follow_up_date: formatDate(job.follow_up_date)
    }))
  };
}

async function getJobDetail(input: Record<string, unknown>): Promise<ToolExecutionResult> {
  const supabase = getSupabase();
  let jobId = typeof input.job_id === "string" ? input.job_id : undefined;
  if (!jobId && typeof input.job_ref === "string") {
    jobId = (await resolveJobByRef(input.job_ref)).id;
  }
  if (!jobId) {
    throw new Error("job_ref or job_id is required.");
  }

  const [jobResult, surveyResult, quoteResult, materialsResult] = await Promise.all([
    supabase
      .from("jobs")
      .select("*, customers(*)")
      .eq("id", jobId)
      .single(),
    supabase.from("surveys").select("*").eq("job_id", jobId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("quotes").select("*").eq("job_id", jobId).order("version_number", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("materials").select("*").eq("job_id", jobId).order("created_at", { ascending: true })
  ]);

  if (jobResult.error || !jobResult.data) {
    throw new Error(jobResult.error?.message ?? "Job not found.");
  }

  return {
    ok: true,
    summary: `Loaded ${jobResult.data.job_ref ?? "job"} for ${getJoinedCustomerName((jobResult.data as { customers?: unknown }).customers) || "customer"}.`,
    data: {
      job: jobResult.data,
      survey: surveyResult.data ?? null,
      quote: quoteResult.data ?? null,
      materials: materialsResult.data ?? []
    }
  };
}

async function createJob(input: Record<string, unknown>): Promise<ToolExecutionResult> {
  const supabase = getSupabase();
  const businessId = await getBusinessId();
  const customerName = String(input.customer_name ?? "").trim();
  const propertyAddress = String(input.property_address ?? "").trim();
  const phone = String(input.customer_phone ?? "").trim();
  const jobRef = await getNextJobRef();

  if (!customerName || !propertyAddress || !String(input.job_title ?? "").trim()) {
    throw new Error("customer_name, property_address, and job_title are required.");
  }

  const { data: existingCustomer } = await supabase
    .from("customers")
    .select("*")
    .eq("business_id", businessId)
    .eq("full_name", customerName)
    .eq("phone", phone || null)
    .limit(1)
    .maybeSingle();

  const customer =
    existingCustomer ??
    (
      await supabase
        .from("customers")
        .insert({
          business_id: businessId,
          full_name: customerName,
          phone: phone || null,
          email: input.customer_email ? String(input.customer_email) : null,
          address_line_1: propertyAddress,
          postcode: input.postcode ? String(input.postcode) : null
        })
        .select("*")
        .single()
    ).data;

  if (!customer) throw new Error("Unable to create the customer.");

  const { data: job, error } = await supabase
    .from("jobs")
    .insert({
      business_id: businessId,
      customer_id: customer.id,
      job_ref: jobRef,
      job_title: String(input.job_title),
      property_address: propertyAddress,
      postcode: input.postcode ? String(input.postcode) : null,
      job_type: input.job_type ? String(input.job_type) : null,
      roof_type: input.roof_type ? String(input.roof_type) : null,
      status: "New Lead",
      urgency: input.urgency ? String(input.urgency) : null,
      source: input.source ? String(input.source) : null,
      internal_notes: input.internal_notes ? String(input.internal_notes) : null,
      estimated_value: typeof input.estimated_value === "number" ? input.estimated_value : null
    })
    .select("*")
    .single();

  if (error || !job) {
    throw new Error(error?.message ?? "Unable to create the job.");
  }

  return {
    ok: true,
    summary: `Created ${job.job_ref} for ${customer.full_name}.`,
    navigation: { path: `/jobs/${job.id}` },
    data: {
      job_ref: job.job_ref,
      customer_name: customer.full_name,
      property_address: job.property_address
    }
  };
}

async function updateJobStatus(input: Record<string, unknown>): Promise<ToolExecutionResult> {
  const supabase = getSupabase();
  const jobRef = String(input.job_ref ?? "");
  const newStatus = String(input.new_status ?? "") as JobStatus;
  if (!VALID_JOB_STATUSES.includes(newStatus)) {
    throw new Error("new_status must be a valid job status.");
  }

  const job = await resolveJobByRef(jobRef);
  const patch: Record<string, unknown> = {
    status: newStatus,
    updated_at: new Date().toISOString()
  };
  if (newStatus === "Accepted") patch.accepted_at = new Date().toISOString();
  if (newStatus === "Completed") patch.completed_at = new Date().toISOString();
  if (typeof input.internal_notes === "string" && input.internal_notes.trim()) {
    patch.internal_notes = [job.internal_notes, `${timestampPrefix()} ${input.internal_notes}`].filter(Boolean).join("\n");
  }

  const { error } = await supabase.from("jobs").update(patch).eq("id", job.id);
  if (error) throw new Error(error.message);
  return {
    ok: true,
    summary: `Updated ${jobRef} to ${newStatus}.`,
    data: { job_ref: jobRef, status: newStatus }
  };
}

async function updateJobNotes(input: Record<string, unknown>): Promise<ToolExecutionResult> {
  const supabase = getSupabase();
  const jobRef = String(input.job_ref ?? "");
  const notes = String(input.notes ?? "").trim();
  const mode = String(input.mode ?? "append");
  const job = await resolveJobByRef(jobRef);
  const nextNotes = mode === "replace" ? notes : [job.internal_notes, `${timestampPrefix()} ${notes}`].filter(Boolean).join("\n");
  const { error } = await supabase.from("jobs").update({ internal_notes: nextNotes, updated_at: new Date().toISOString() }).eq("id", job.id);
  if (error) throw new Error(error.message);
  return {
    ok: true,
    summary: `${mode === "replace" ? "Replaced" : "Appended"} internal notes on ${jobRef}.`,
    data: { job_ref: jobRef, internal_notes: nextNotes }
  };
}

async function setFollowupDate(input: Record<string, unknown>): Promise<ToolExecutionResult> {
  const supabase = getSupabase();
  const jobRef = String(input.job_ref ?? "");
  const followUpDate = String(input.follow_up_date ?? "");
  const job = await resolveJobByRef(jobRef);
  const { error } = await supabase
    .from("jobs")
    .update({ follow_up_date: new Date(followUpDate).toISOString(), updated_at: new Date().toISOString() })
    .eq("id", job.id);
  if (error) throw new Error(error.message);
  return {
    ok: true,
    summary: `Set follow-up on ${jobRef} for ${formatDate(followUpDate)}.`,
    data: { job_ref: jobRef, follow_up_date: followUpDate }
  };
}

async function searchCustomers(input: Record<string, unknown>): Promise<ToolExecutionResult> {
  const supabase = getSupabase();
  const query = String(input.query ?? "").toLowerCase();
  const limit = Math.max(1, Math.min(Number(input.limit ?? 10), 50));
  const { data, error } = await supabase.from("customers").select("*").order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const rows = (data ?? [])
    .filter((customer) => {
      if (!query) return true;
      return [customer.full_name, customer.phone, customer.email, customer.postcode].some((value) => String(value ?? "").toLowerCase().includes(query));
    })
    .slice(0, limit);
  return {
    ok: true,
    summary: rows.length > 0 ? `Found ${rows.length} customer${rows.length === 1 ? "" : "s"}.` : "No customers matched that search.",
    data: rows.map((customer) => ({
      full_name: customer.full_name,
      phone: customer.phone,
      email: customer.email,
      postcode: customer.postcode
    }))
  };
}

async function getCustomerJobs(input: Record<string, unknown>): Promise<ToolExecutionResult> {
  const supabase = getSupabase();
  const customerName = String(input.customer_name ?? "").toLowerCase();
  const { data: customers, error: customerError } = await supabase.from("customers").select("*");
  if (customerError) throw new Error(customerError.message);
  const customer = (customers ?? []).find((row) => String(row.full_name ?? "").toLowerCase().includes(customerName));
  if (!customer) throw new Error(`No customer matched "${input.customer_name}".`);
  const { data: jobs, error } = await supabase.from("jobs").select("*").eq("customer_id", customer.id).order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return {
    ok: true,
    summary: `${customer.full_name} has ${(jobs ?? []).length} job${(jobs ?? []).length === 1 ? "" : "s"}.`,
    data: (jobs ?? []).map((job) => ({
      job_ref: job.job_ref,
      job_title: job.job_title,
      status: job.status,
      property_address: job.property_address
    }))
  };
}

async function getQuotes(input: Record<string, unknown>): Promise<ToolExecutionResult> {
  const supabase = getSupabase();
  const limit = Math.max(1, Math.min(Number(input.limit ?? 10), 50));
  const { data, error } = await supabase
    .from("quotes")
    .select("*, jobs(job_ref, job_title, property_address)")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  let rows = data ?? [];
  if (input.status) rows = rows.filter((quote) => quote.status === input.status);
  if (input.job_ref) rows = rows.filter((quote) => !Array.isArray(quote.jobs) && quote.jobs?.job_ref === input.job_ref);
  rows = rows.slice(0, limit);
  return {
    ok: true,
    summary: rows.length > 0 ? `Found ${rows.length} quote${rows.length === 1 ? "" : "s"}.` : "No quotes matched that filter.",
    data: rows.map((quote) => ({
      quote_ref: quote.quote_ref,
      status: quote.status,
      total: currency(Number(quote.total ?? 0)),
      job_ref: !Array.isArray(quote.jobs) ? quote.jobs?.job_ref : null,
      job_title: !Array.isArray(quote.jobs) ? quote.jobs?.job_title : null
    }))
  };
}

async function updateQuoteStatus(input: Record<string, unknown>): Promise<ToolExecutionResult> {
  const supabase = getSupabase();
  const quoteRef = String(input.quote_ref ?? "");
  const newStatus = String(input.new_status ?? "") as QuoteStatus;
  if (!VALID_QUOTE_STATUSES.includes(newStatus)) {
    throw new Error("new_status must be a valid quote status.");
  }

  const quote = await resolveQuoteByRef(quoteRef);
  const { error } = await supabase
    .from("quotes")
    .update({
      status: newStatus,
      sent_at: newStatus === "Sent" ? new Date().toISOString() : quote.sent_at,
      updated_at: new Date().toISOString()
    })
    .eq("id", quote.id);
  if (error) throw new Error(error.message);

  let jobStatus: JobStatus | null = null;
  if (newStatus === "Sent") jobStatus = "Quote Sent";
  if (newStatus === "Accepted") jobStatus = "Accepted";
  if (jobStatus) {
    await supabase.from("jobs").update({ status: jobStatus, updated_at: new Date().toISOString() }).eq("id", quote.job_id);
  }

  return {
    ok: true,
    summary: `Updated ${quoteRef} to ${newStatus}.`,
    data: { quote_ref: quoteRef, status: newStatus }
  };
}

async function getPipelineSummary(): Promise<ToolExecutionResult> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from("jobs").select("status, estimated_value");
  if (error) throw new Error(error.message);
  const summary = new Map<string, { count: number; value: number }>();
  for (const job of data ?? []) {
    const current = summary.get(job.status) ?? { count: 0, value: 0 };
    current.count += 1;
    current.value += Number(job.estimated_value ?? 0);
    summary.set(job.status, current);
  }
  return {
    ok: true,
    summary: "Loaded the current jobs pipeline summary.",
    data: [...summary.entries()].map(([status, item]) => ({
      status,
      count: item.count,
      estimated_value: currency(item.value)
    }))
  };
}

async function getRevenueSummary(input: Record<string, unknown>): Promise<ToolExecutionResult> {
  const supabase = getSupabase();
  const period = String(input.period ?? "this_month");
  const start = startOfPeriod(period);
  const end = endOfPeriod(period);

  const [jobsResult, quotesResult] = await Promise.all([
    supabase.from("jobs").select("job_ref, final_value, completed_at, estimated_value, accepted_at"),
    supabase.from("quotes").select("quote_ref, total, status, updated_at")
  ]);
  if (jobsResult.error || quotesResult.error) {
    throw new Error(jobsResult.error?.message ?? quotesResult.error?.message ?? "Unable to build revenue summary.");
  }

  const completedJobs = (jobsResult.data ?? []).filter((job) => job.completed_at && new Date(job.completed_at) >= start && new Date(job.completed_at) < end);
  const acceptedJobs = (jobsResult.data ?? []).filter((job) => job.accepted_at && new Date(job.accepted_at) >= start && new Date(job.accepted_at) < end);
  const acceptedQuotes = (quotesResult.data ?? []).filter(
    (quote) => quote.status === "Accepted" && quote.updated_at && new Date(quote.updated_at) >= start && new Date(quote.updated_at) < end
  );

  const completedValue = completedJobs.reduce((sum, job) => sum + Number(job.final_value ?? 0), 0);
  const acceptedValue =
    acceptedJobs.reduce((sum, job) => sum + Number(job.estimated_value ?? 0), 0) ||
    acceptedQuotes.reduce((sum, quote) => sum + Number(quote.total ?? 0), 0);

  return {
    ok: true,
    summary: `For ${period.replaceAll("_", " ")}, completed value is ${currency(completedValue)} and accepted value is ${currency(acceptedValue)}.`,
    data: {
      period,
      completed_jobs_value: currency(completedValue),
      accepted_work_value: currency(acceptedValue),
      completed_jobs_count: completedJobs.length,
      accepted_items_count: acceptedJobs.length || acceptedQuotes.length
    }
  };
}

async function getOverdueItems(): Promise<ToolExecutionResult> {
  const supabase = getSupabase();
  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(now.getDate() - 7);

  const [jobsResult, quotesResult] = await Promise.all([
    supabase.from("jobs").select("id, job_ref, job_title, follow_up_date, status").not("follow_up_date", "is", null),
    supabase.from("quotes").select("id, quote_ref, job_id, status, sent_at").eq("status", "Sent").not("sent_at", "is", null)
  ]);
  if (jobsResult.error || quotesResult.error) {
    throw new Error(jobsResult.error?.message ?? quotesResult.error?.message ?? "Unable to load overdue items.");
  }

  const overdueJobs = (jobsResult.data ?? [])
    .filter((job) => job.follow_up_date && new Date(job.follow_up_date) < now)
    .map((job) => ({
      type: "job_follow_up",
      ref: job.job_ref,
      title: job.job_title,
      due: formatDate(job.follow_up_date)
    }));

  const overdueQuotes = (quotesResult.data ?? [])
    .filter((quote) => quote.sent_at && new Date(quote.sent_at) < sevenDaysAgo)
    .map((quote) => ({
      type: "quote_follow_up",
      ref: quote.quote_ref,
      due: formatDate(quote.sent_at)
    }));

  const items = [...overdueJobs, ...overdueQuotes];
  return {
    ok: true,
    summary: items.length > 0 ? `Found ${items.length} overdue item${items.length === 1 ? "" : "s"}.` : "No overdue items right now.",
    data: items
  };
}

async function navigateTo(input: Record<string, unknown>, routeContext?: AssistantRouteContext): Promise<ToolExecutionResult> {
  let path = String(input.path ?? "");
  const destination = typeof input.destination === "string" ? input.destination : "";
  const jobRef = typeof input.job_ref === "string" && input.job_ref.trim() ? input.job_ref.trim() : "";
  const job = jobRef ? await resolveJobByRef(jobRef) : null;
  const jobId = job?.id ?? routeContext?.jobId ?? null;

  if (!path && destination) {
    if (destination === "dashboard") path = "/dashboard";
    if (destination === "jobs") path = "/crm";
    if (destination === "new_job") path = "/jobs/new";
    if (destination === "knowledge") path = "/knowledge";
    if (destination === "job" && jobId) path = `/jobs/${jobId}`;
    if (destination === "survey" && jobId) path = `/jobs/${jobId}/survey`;
    if (destination === "roof_survey" && jobId) path = `/jobs/${jobId}/roof-survey`;
    if (destination === "quote" && jobId) path = `/jobs/${jobId}/quote`;
  }

  if (!path) throw new Error("path or destination is required.");

  if (jobId) {
    path = path.replace("[jobId]", jobId).replace("[id]", jobId);
  }

  if (path.startsWith("/admin")) {
    path = path
      .replace("/admin/jobs/new", "/jobs/new")
      .replace("/admin/jobs", "/crm")
      .replace("/admin/quotes", "/crm")
      .replace("/admin/customers", "/crm")
      .replace("/admin/knowledge", "/knowledge");
  }

  if (path === "/quotes" || path === "/quotes/new" || path.startsWith("/quotes/")) {
    path = jobId ? `/jobs/${jobId}/quote` : "/crm";
  }

  if (path === "/admin/quotes/new" || path === "/admin/quotes") {
    path = jobId ? `/jobs/${jobId}/quote` : "/crm";
  }

  return {
    ok: true,
    summary: `Navigating to ${path}.`,
    navigation: { path },
    data: { path }
  };
}

export async function executeToolCall(toolName: string, input: Record<string, unknown>, routeContext?: AssistantRouteContext): Promise<ToolExecutionResult> {
  switch (toolName) {
    case "get_jobs":
      return getJobs(input);
    case "get_job_detail":
      return getJobDetail(input);
    case "create_job":
      return createJob(input);
    case "update_job_status":
      return updateJobStatus(input);
    case "update_job_notes":
      return updateJobNotes(input);
    case "set_followup_date":
      return setFollowupDate(input);
    case "search_customers":
      return searchCustomers(input);
    case "get_customer_jobs":
      return getCustomerJobs(input);
    case "get_quotes":
      return getQuotes(input);
    case "update_quote_status":
      return updateQuoteStatus(input);
    case "get_pipeline_summary":
      return getPipelineSummary();
    case "get_revenue_summary":
      return getRevenueSummary(input);
    case "get_overdue_items":
      return getOverdueItems();
    case "navigate_to":
      return navigateTo(input, routeContext);
    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}
