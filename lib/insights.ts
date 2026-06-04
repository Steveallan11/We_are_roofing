import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Period = "7d" | "30d" | "90d" | "ytd";

export type BusinessMetrics = {
  totalRevenue: number;
  revenueChange: number;
  invoicedAmount: number;
  invoiceChange: number;
  avgJobValue: number;
  avgJobValueChange: number;
  conversionRate: number;
  conversionRateChange: number;
  newLeads: number;
  newLeadsChange: number;
  quotesSent: number;
  quotesAccepted: number;
  jobsCompleted: number;
  jobsCompletedChange: number;
  avgQuoteTime: number;
  avgJobDuration: number;
  revenueByJobType: Record<string, number>;
  materialsCost: number;
  labourCost: number;
  subcontractorCost: number;
};

function getPeriodDates(period: Period) {
  const now = new Date();
  let startDate = new Date();

  switch (period) {
    case "7d":
      startDate.setDate(now.getDate() - 7);
      break;
    case "30d":
      startDate.setDate(now.getDate() - 30);
      break;
    case "90d":
      startDate.setDate(now.getDate() - 90);
      break;
    case "ytd":
      startDate = new Date(now.getFullYear(), 0, 1);
      break;
  }

  return { startDate, endDate: now };
}

function getPreviousPeriodDates(period: Period) {
  const { startDate: currentStart } = getPeriodDates(period);
  const daysDiff = Math.floor((new Date().getTime() - currentStart.getTime()) / (1000 * 60 * 60 * 24));
  const prevStart = new Date();
  prevStart.setDate(prevStart.getDate() - daysDiff * 2);
  const prevEnd = new Date(currentStart);
  prevEnd.setDate(prevEnd.getDate() - 1);

  return { startDate: prevStart, endDate: prevEnd };
}

export async function getBusinessMetrics(period: Period): Promise<BusinessMetrics> {
  const supabase = createSupabaseAdminClient();
  const { startDate, endDate } = getPeriodDates(period);
  const { startDate: prevStart, endDate: prevEnd } = getPreviousPeriodDates(period);

  const startISO = startDate.toISOString();
  const endISO = endDate.toISOString();
  const prevStartISO = prevStart.toISOString();
  const prevEndISO = prevEnd.toISOString();

  // Fetch invoices for current period
  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, total_amount, balance_due, created_at, job_id")
    .gte("created_at", startISO)
    .lte("created_at", endISO)
    .returns<any[]>();

  // Fetch invoices for previous period
  const { data: prevInvoices } = await supabase
    .from("invoices")
    .select("id, total_amount, balance_due")
    .gte("created_at", prevStartISO)
    .lte("created_at", prevEndISO)
    .returns<any[]>();

  // Fetch jobs
  const { data: jobs } = await supabase
    .from("jobs")
    .select("id, job_type, status, created_at, job_ref")
    .gte("created_at", startISO)
    .lte("created_at", endISO)
    .returns<any[]>();

  // Fetch quotes
  const { data: quotes } = await supabase
    .from("quotes")
    .select("id, status, total_value, created_at, quote_ref, job_id")
    .gte("created_at", startISO)
    .lte("created_at", endISO)
    .returns<any[]>();

  // Fetch materials
  const { data: materials } = await supabase
    .from("quote_materials")
    .select("id, qty, unit_price, quote_id")
    .gte("created_at", startISO)
    .lte("created_at", endISO)
    .returns<any[]>();

  // Calculate metrics
  const totalRevenue = invoices?.reduce((sum, inv) => sum + (inv.total_amount || 0), 0) ?? 0;
  const prevRevenue = prevInvoices?.reduce((sum, inv) => sum + (inv.total_amount || 0), 0) ?? 0;
  const revenueChange = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : 0;

  const invoicedAmount = invoices?.reduce((sum, inv) => sum + (inv.balance_due >= 0 ? inv.balance_due : 0), 0) ?? 0;

  const completedJobs = jobs?.filter((j) => j.status === "Completed") ?? [];
  const newLeads = jobs?.length ?? 0;
  const quotesSent = quotes?.filter((q) => q.status === "Sent") ?? [];
  const quotesAccepted = quotes?.filter((q) => q.status === "Accepted") ?? [];

  const avgJobValue = completedJobs.length > 0 ? totalRevenue / completedJobs.length : 0;
  const prevCompletedJobs = jobs?.filter((j) => j.status === "Completed" && j.created_at < startISO).length ?? 1;
  const prevAvgJobValue = prevRevenue / Math.max(prevCompletedJobs, 1);
  const avgJobValueChange = prevAvgJobValue > 0 ? ((avgJobValue - prevAvgJobValue) / prevAvgJobValue) * 100 : 0;

  const conversionRate = newLeads > 0 ? (quotesAccepted.length / newLeads) * 100 : 0;
  const conversionRateChange = 0;

  const jobsCompleted = completedJobs.length;

  // Revenue by job type
  const revenueByJobType: Record<string, number> = {};
  jobs?.forEach((job) => {
    const jobInvoices = invoices?.filter((inv) => inv.job_id === job.id) ?? [];
    const jobRevenue = jobInvoices.reduce((sum, inv) => sum + (inv.total_amount || 0), 0);
    const type = job.job_type || "Other";
    revenueByJobType[type] = (revenueByJobType[type] || 0) + jobRevenue;
  });

  const avgQuoteTime = 4; // Placeholder
  const avgJobDuration = 7; // Placeholder
  const materialsCost = materials?.reduce((sum, m) => sum + (m.qty * m.unit_price || 0), 0) ?? 0;
  const labourCost = totalRevenue * 0.25; // Placeholder: 25% of revenue
  const subcontractorCost = totalRevenue * 0.1; // Placeholder: 10% of revenue

  return {
    totalRevenue,
    revenueChange,
    invoicedAmount,
    invoiceChange: 0,
    avgJobValue,
    avgJobValueChange,
    conversionRate,
    conversionRateChange,
    newLeads,
    newLeadsChange: 0,
    quotesSent: quotesSent.length,
    quotesAccepted: quotesAccepted.length,
    jobsCompleted,
    jobsCompletedChange: 0,
    avgQuoteTime,
    avgJobDuration,
    revenueByJobType,
    materialsCost,
    labourCost,
    subcontractorCost
  };
}
