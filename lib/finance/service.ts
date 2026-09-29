import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { AssistantRouteContext, ToolExecutionResult } from "@/lib/assistant/types";
import {
  ageingBucket,
  calculateProfitability,
  groupDirectCosts,
  invoiceOutstandingPence,
  summariseSales,
  type FinancialCredit,
  type FinancialInvoice
} from "@/lib/finance/calculations";
import { decimalMultiply, formatGbp, fromPence, sumPence, toPence } from "@/lib/finance/money";
import { updateVariationInvoiceStatus } from "@/lib/variations/invoicing";
import { calculateSubcontractorAmounts } from "@/lib/finance/subcontractors";
import { createHash, randomUUID } from "node:crypto";
import { bankFingerprintSource, classifyBankTransaction, type BankTransactionType } from "@/lib/finance/bankStatements";

type Input = Record<string, unknown>;
type Row = Record<string, any>;

const CANCELLED_INVOICE_STATUSES = new Set(["Draft", "Cancelled", "Void"]);
const CANCELLED_PURCHASE_STATUSES = new Set(["Draft", "Cancelled", "Credited"]);

function requireContext(context?: AssistantRouteContext) {
  if (!context?.businessId) throw new Error("This finance tool requires an authenticated workspace.");
  return { businessId: context.businessId, actorId: context.actorId ?? null };
}

function limitOf(input: Input, fallback = 50) {
  return Math.max(1, Math.min(100, Number(input.limit ?? fallback)));
}

function isoDate(value: unknown, field: string, required = false) {
  if (!value) {
    if (required) throw new Error(`${field} is required.`);
    return null;
  }
  const text = String(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || Number.isNaN(Date.parse(`${text}T00:00:00Z`))) {
    throw new Error(`${field} must be an ISO date in YYYY-MM-DD format.`);
  }
  return text;
}

function assertRange(start: string | null, end: string | null) {
  if (start && end && start > end) throw new Error("start_date must be on or before end_date.");
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function text(value: unknown) {
  return String(value ?? "").trim();
}

function like(value: unknown, query: unknown) {
  return !query || String(value ?? "").toLowerCase().includes(text(query).toLowerCase());
}

async function getLookupMaps(businessId: string) {
  const supabase = createSupabaseAdminClient();
  const [jobsResult, customersResult, suppliersResult] = await Promise.all([
    supabase.from("jobs").select("id, business_id, job_ref, job_title, status, customer_id, estimated_value, final_value").eq("business_id", businessId),
    supabase.from("customers").select("id, business_id, full_name").eq("business_id", businessId),
    supabase.from("suppliers").select("id, business_id, name").eq("business_id", businessId)
  ]);
  const error = jobsResult.error ?? customersResult.error ?? suppliersResult.error;
  if (error) throw new Error(error.message);
  return {
    jobs: new Map((jobsResult.data ?? []).map((row: Row) => [String(row.id), row])),
    customers: new Map((customersResult.data ?? []).map((row: Row) => [String(row.id), row])),
    suppliers: new Map((suppliersResult.data ?? []).map((row: Row) => [String(row.id), row]))
  };
}

function enrichInvoice(row: Row, maps: Awaited<ReturnType<typeof getLookupMaps>>): FinancialInvoice & Row {
  const job = maps.jobs.get(String(row.job_id ?? ""));
  const customer = maps.customers.get(String(row.customer_id ?? job?.customer_id ?? ""));
  return {
    ...row,
    invoice_date: row.invoice_date ?? row.issue_date,
    customer_name: customer?.full_name ?? null,
    job_ref: job?.job_ref ?? null,
    job_title: job?.job_title ?? null
  } as FinancialInvoice & Row;
}

function publicInvoice(row: FinancialInvoice & Row) {
  return {
    invoice_id: row.id,
    invoice_number: row.invoice_ref,
    invoice_date: row.invoice_date ?? row.issue_date,
    tax_point_date: row.tax_point_date ?? row.issue_date,
    due_date: row.due_date,
    customer: row.customer_name,
    job_ref: row.job_ref,
    job_title: row.job_title,
    subtotal: fromPence(toPence(row.subtotal)),
    vat: fromPence(toPence(row.vat_amount)),
    total: fromPence(toPence(row.total)),
    amount_paid: fromPence(toPence(row.amount_paid)),
    amount_outstanding: fromPence(invoiceOutstandingPence(row)),
    status: row.status,
    currency: row.currency ?? "GBP"
  };
}

async function loadInvoices(businessId: string, input: Input = {}) {
  const start = isoDate(input.start_date, "start_date");
  const end = isoDate(input.end_date, "end_date");
  assertRange(start, end);
  const supabase = createSupabaseAdminClient();
  let query = supabase.from("invoices").select("*").eq("business_id", businessId).order("invoice_date", { ascending: false });
  if (start) query = query.gte("invoice_date", start);
  if (end) query = query.lte("invoice_date", end);
  if (input.status) query = query.eq("status", text(input.status));
  if (input.invoice_number) query = query.ilike("invoice_ref", `%${text(input.invoice_number)}%`);
  const { data, error } = await query.limit(5000);
  if (error) throw new Error(error.message);
  const maps = await getLookupMaps(businessId);
  return (data ?? []).map((row: Row) => enrichInvoice(row, maps)).filter((row: FinancialInvoice & Row) => {
    if (!like(row.customer_name, input.customer_name)) return false;
    if (!like(row.job_ref, input.job_ref)) return false;
    const outstanding = invoiceOutstandingPence(row);
    if (input.unpaid_only === true && outstanding <= 0) return false;
    if (input.overdue_only === true && !(outstanding > 0 && row.due_date && row.due_date < today())) return false;
    return true;
  });
}

async function loadSubcontractorCosts(businessId: string, input: Input = {}) {
  const start = isoDate(input.start_date, "start_date");
  const end = isoDate(input.end_date, "end_date");
  assertRange(start, end);
  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from("subcontractor_payments")
    .select("*")
    .eq("business_id", businessId)
    .in("status", ["Approved", "Part Paid", "Paid"])
    .order("work_date", { ascending: false });
  if (start) query = query.gte("work_date", start);
  if (end) query = query.lte("work_date", end);
  if (input.job_id) query = query.eq("job_id", text(input.job_id));
  const { data, error } = await query.limit(5000);
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function getInvoices(input: Input, context?: AssistantRouteContext): Promise<ToolExecutionResult> {
  const { businessId } = requireContext(context);
  const rows = (await loadInvoices(businessId, input)).slice(0, limitOf(input));
  const total = sumPence(rows.map((row) => row.total));
  const outstanding = rows.reduce((sum, row) => sum + invoiceOutstandingPence(row), 0);
  return {
    ok: true,
    summary: rows.length
      ? `Found ${rows.length} invoice${rows.length === 1 ? "" : "s"} totalling ${formatGbp(fromPence(total))}, with ${formatGbp(fromPence(outstanding))} outstanding.`
      : "No invoices matched those filters.",
    data: { invoices: rows.map(publicInvoice), totals: { gross: fromPence(total), outstanding: fromPence(outstanding) }, basis: "invoice_date (inclusive)" }
  };
}

async function getInvoiceDetail(input: Input, context?: AssistantRouteContext): Promise<ToolExecutionResult> {
  const { businessId } = requireContext(context);
  const supabase = createSupabaseAdminClient();
  let query = supabase.from("invoices").select("*").eq("business_id", businessId);
  if (input.invoice_id) query = query.eq("id", text(input.invoice_id));
  else if (input.invoice_number) query = query.eq("invoice_ref", text(input.invoice_number));
  else throw new Error("invoice_id or invoice_number is required.");
  const { data: invoice, error } = await query.maybeSingle();
  if (error || !invoice) throw new Error(error?.message ?? "Invoice not found in this workspace.");
  const maps = await getLookupMaps(businessId);
  const enriched = enrichInvoice(invoice, maps);
  const [lines, payments, credits] = await Promise.all([
    supabase.from("invoice_lines").select("*").eq("invoice_id", invoice.id).order("sort_order"),
    supabase.from("invoice_payments").select("*").eq("business_id", businessId).eq("invoice_id", invoice.id).order("payment_date", { ascending: false }),
    supabase.from("credit_notes").select("*").eq("business_id", businessId).eq("invoice_id", invoice.id).order("credit_note_date", { ascending: false })
  ]);
  const childError = lines.error ?? payments.error ?? credits.error;
  if (childError) throw new Error(childError.message);
  const invoiceLines = (lines.data ?? []).length ? lines.data : invoice.line_items ?? [];
  return {
    ok: true,
    summary: `${invoice.invoice_ref} totals ${formatGbp(invoice.total)} with ${formatGbp(fromPence(invoiceOutstandingPence(enriched)))} outstanding.`,
    data: {
      ...publicInvoice(enriched),
      notes: invoice.notes,
      payment_terms: invoice.payment_terms,
      lines: invoiceLines,
      payments: payments.data ?? [],
      credit_notes: credits.data ?? []
    }
  };
}

async function getPayments(input: Input, context?: AssistantRouteContext): Promise<ToolExecutionResult> {
  const { businessId } = requireContext(context);
  const start = isoDate(input.start_date, "start_date");
  const end = isoDate(input.end_date, "end_date");
  assertRange(start, end);
  const supabase = createSupabaseAdminClient();
  let query = supabase.from("invoice_payments").select("*").eq("business_id", businessId).order("payment_date", { ascending: false });
  if (start) query = query.gte("payment_date", start);
  if (end) query = query.lte("payment_date", end);
  if (input.payment_method) query = query.eq("payment_method", text(input.payment_method));
  const { data, error } = await query.limit(5000);
  if (error) throw new Error(error.message);
  const invoiceIds = [...new Set((data ?? []).map((row: Row) => row.invoice_id).filter(Boolean))];
  const invoiceResult = invoiceIds.length
    ? await supabase.from("invoices").select("*").eq("business_id", businessId).in("id", invoiceIds)
    : { data: [], error: null };
  if (invoiceResult.error) throw new Error(invoiceResult.error.message);
  const maps = await getLookupMaps(businessId);
  const invoices = new Map((invoiceResult.data ?? []).map((row: Row) => [String(row.id), enrichInvoice(row, maps)]));
  const rows = (data ?? []).map((payment: Row) => {
    const invoice = invoices.get(String(payment.invoice_id));
    return { ...payment, invoice_number: invoice?.invoice_ref, customer: invoice?.customer_name, job_ref: invoice?.job_ref };
  }).filter((row: Row) => like(row.customer, input.customer_name) && like(row.job_ref, input.job_ref) && like(row.invoice_number, input.invoice_number)).slice(0, limitOf(input));
  const total = sumPence(rows.map((row: Row) => row.amount));
  return {
    ok: true,
    summary: rows.length ? `Received ${formatGbp(fromPence(total))} across ${rows.length} payment${rows.length === 1 ? "" : "s"} during this period.` : "No customer payments matched those filters.",
    data: { payments: rows, total_received: fromPence(total), basis: "payment_date (inclusive)" }
  };
}

async function loadSupplierBills(businessId: string, input: Input = {}): Promise<Row[]> {
  const start = isoDate(input.start_date, "start_date");
  const end = isoDate(input.end_date, "end_date");
  assertRange(start, end);
  const supabase = createSupabaseAdminClient();
  let query = supabase.from("supplier_bills").select("*").eq("business_id", businessId).order("bill_date", { ascending: false });
  if (start) query = query.gte("bill_date", start);
  if (end) query = query.lte("bill_date", end);
  if (input.status) query = query.eq("status", text(input.status));
  if (input.expense_category) query = query.ilike("expense_category", `%${text(input.expense_category)}%`);
  const { data, error } = await query.limit(5000);
  if (error) throw new Error(error.message);
  const maps = await getLookupMaps(businessId);
  return (data ?? []).map((row: Row) => ({ ...row, supplier: maps.suppliers.get(String(row.supplier_id))?.name ?? null, job_ref: maps.jobs.get(String(row.job_id))?.job_ref ?? null } as Row))
    .filter((row: Row) => like(row.supplier, input.supplier_name) && like(row.job_ref, input.job_ref))
    .filter((row: Row) => input.unpaid_only !== true || toPence(row.amount_outstanding) > 0)
    .filter((row: Row) => input.overdue_only !== true || (toPence(row.amount_outstanding) > 0 && row.due_date && row.due_date < today()));
}

async function getSupplierBills(input: Input, context?: AssistantRouteContext): Promise<ToolExecutionResult> {
  const { businessId } = requireContext(context);
  const rows = (await loadSupplierBills(businessId, input)).slice(0, limitOf(input));
  const gross = sumPence(rows.map((row) => row.total));
  const outstanding = sumPence(rows.map((row) => row.amount_outstanding));
  return { ok: true, summary: rows.length ? `Found ${rows.length} supplier bill${rows.length === 1 ? "" : "s"} totalling ${formatGbp(fromPence(gross))}, with ${formatGbp(fromPence(outstanding))} unpaid.` : "No supplier bills matched those filters.", data: { supplier_bills: rows, totals: { gross: fromPence(gross), outstanding: fromPence(outstanding) }, basis: "bill_date (inclusive)" } };
}

async function loadExpenses(businessId: string, input: Input = {}): Promise<Row[]> {
  const start = isoDate(input.start_date, "start_date");
  const end = isoDate(input.end_date, "end_date");
  assertRange(start, end);
  const supabase = createSupabaseAdminClient();
  let query = supabase.from("job_expenses").select("*").eq("business_id", businessId).order("expense_date", { ascending: false });
  if (start) query = query.gte("expense_date", start);
  if (end) query = query.lte("expense_date", end);
  if (input.category) query = query.ilike("category", `%${text(input.category)}%`);
  const { data, error } = await query.limit(5000);
  if (error) throw new Error(error.message);
  const maps = await getLookupMaps(businessId);
  return (data ?? []).map((row: Row) => ({
    ...row,
    supplier: maps.suppliers.get(String(row.supplier_id))?.name ?? row.supplier_name ?? null,
    job_ref: maps.jobs.get(String(row.job_id))?.job_ref ?? null,
    net_amount: row.net_amount ?? row.amount,
    gross_amount: row.gross_amount ?? fromPence(toPence(row.amount) + toPence(row.vat_amount))
  } as Row)).filter((row: Row) => like(row.supplier, input.supplier_name) && like(row.job_ref, input.job_ref));
}

async function getExpenses(input: Input, context?: AssistantRouteContext): Promise<ToolExecutionResult> {
  const { businessId } = requireContext(context);
  const rows = (await loadExpenses(businessId, input)).slice(0, limitOf(input));
  const net = sumPence(rows.map((row) => row.net_amount));
  const vat = sumPence(rows.map((row) => row.vat_amount));
  return { ok: true, summary: rows.length ? `Found ${rows.length} expense${rows.length === 1 ? "" : "s"} with ${formatGbp(fromPence(net))} net cost and ${formatGbp(fromPence(vat))} VAT.` : "No expenses matched those filters.", data: { expenses: rows, totals: { net: fromPence(net), vat: fromPence(vat), gross: fromPence(net + vat) }, basis: "expense_date (inclusive)" } };
}

async function loadCredits(businessId: string, start?: string | null, end?: string | null) {
  const supabase = createSupabaseAdminClient();
  let query = supabase.from("credit_notes").select("*").eq("business_id", businessId);
  if (start) query = query.gte("tax_point_date", start);
  if (end) query = query.lte("tax_point_date", end);
  const { data, error } = await query.limit(5000);
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function loadPaymentsTotal(businessId: string, start?: string | null, end?: string | null) {
  const supabase = createSupabaseAdminClient();
  let query = supabase.from("invoice_payments").select("amount").eq("business_id", businessId);
  if (start) query = query.gte("payment_date", start);
  if (end) query = query.lte("payment_date", end);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return sumPence((data ?? []).map((row: Row) => row.amount));
}

async function getSalesSummary(input: Input, context?: AssistantRouteContext): Promise<ToolExecutionResult> {
  const { businessId } = requireContext(context);
  const start = isoDate(input.start_date, "start_date", true)!;
  const end = isoDate(input.end_date, "end_date", true)!;
  assertRange(start, end);
  const [invoices, credits, paymentsPence] = await Promise.all([loadInvoices(businessId, { start_date: start, end_date: end }), loadCredits(businessId, start, end), loadPaymentsTotal(businessId, start, end)]);
  const totals = summariseSales(invoices, credits as FinancialCredit[], paymentsPence);
  const groupBy = text(input.group_by);
  const grouped = groupBy ? groupSales(invoices, credits, groupBy) : [];
  return { ok: true, summary: `Net adjusted sales were ${formatGbp(totals.net_adjusted_sales)} with ${formatGbp(totals.output_vat - totals.credit_note_vat)} net output VAT.`, data: { ...totals, grouped, group_by: groupBy || null, basis: "invoice/tax-point basis; payments use payment_date" } };
}

function groupSales(invoices: (FinancialInvoice & Row)[], credits: Row[], groupBy: string) {
  const groups = new Map<string, { invoices: FinancialInvoice[]; credits: FinancialCredit[] }>();
  for (const invoice of invoices) {
    const date = String(invoice.tax_point_date ?? invoice.invoice_date ?? invoice.issue_date ?? "");
    let key = groupBy === "customer" ? String(invoice.customer_name ?? "Unknown") : groupBy === "job" ? String(invoice.job_ref ?? "Unlinked") : date;
    if (groupBy === "month") key = date.slice(0, 7);
    if (groupBy === "week") {
      const parsed = new Date(`${date.slice(0, 10)}T00:00:00Z`);
      parsed.setUTCDate(parsed.getUTCDate() - ((parsed.getUTCDay() + 6) % 7));
      key = parsed.toISOString().slice(0, 10);
    }
    const entry = groups.get(key) ?? { invoices: [], credits: [] };
    entry.invoices.push(invoice);
    groups.set(key, entry);
  }
  for (const credit of credits) {
    const key = groupBy === "job" ? String(credit.job_id ?? "Unlinked") : String(credit.tax_point_date ?? credit.credit_note_date ?? "").slice(0, groupBy === "month" ? 7 : 10);
    const entry = groups.get(key) ?? { invoices: [], credits: [] };
    entry.credits.push(credit);
    groups.set(key, entry);
  }
  return [...groups.entries()].map(([group, value]) => ({ group, ...summariseSales(value.invoices, value.credits, 0) }));
}

async function getVatSummary(input: Input, context?: AssistantRouteContext): Promise<ToolExecutionResult> {
  const { businessId } = requireContext(context);
  const start = isoDate(input.start_date, "start_date", true)!;
  const end = isoDate(input.end_date, "end_date", true)!;
  assertRange(start, end);
  const [invoices, credits, bills, expenses, subcontractorCosts] = await Promise.all([
    loadInvoices(businessId, { start_date: start, end_date: end }), loadCredits(businessId, start, end), loadSupplierBills(businessId, { start_date: start, end_date: end }), loadExpenses(businessId, { start_date: start, end_date: end }), loadSubcontractorCosts(businessId, { start_date: start, end_date: end })
  ]);
  const activeInvoices = invoices.filter((row) => !CANCELLED_INVOICE_STATUSES.has(String(row.status)));
  const activeCredits = credits.filter((row: Row) => !["Draft", "Cancelled"].includes(String(row.status)));
  const activeBills = bills.filter((row) => !CANCELLED_PURCHASE_STATUSES.has(String(row.status)));
  const salesNet = sumPence(activeInvoices.map((row) => row.subtotal));
  const outputVat = sumPence(activeInvoices.map((row) => row.vat_amount));
  const creditNet = sumPence(activeCredits.map((row: Row) => row.subtotal));
  const creditVat = sumPence(activeCredits.map((row: Row) => row.vat_amount));
  const purchaseNet = sumPence(activeBills.map((row) => row.subtotal)) + sumPence(expenses.map((row) => row.net_amount)) + sumPence(subcontractorCosts.map((row) => row.net_amount));
  const inputVat = sumPence(activeBills.map((row) => row.vat_amount)) + sumPence(expenses.map((row) => row.vat_amount)) + sumPence(subcontractorCosts.map((row) => row.vat_amount));
  const payable = outputVat - creditVat - inputVat;
  return {
    ok: true,
    summary: payable >= 0 ? `Estimated VAT payable is ${formatGbp(fromPence(payable))}.` : `Estimated VAT repayment position is ${formatGbp(fromPence(Math.abs(payable)))}.`,
    data: { sales_net: fromPence(salesNet), output_vat: fromPence(outputVat), purchase_net: fromPence(purchaseNet), input_vat: fromPence(inputVat), credit_note_adjustments: { net: fromPence(creditNet), vat: fromPence(creditVat) }, vat_payable: fromPence(payable), basis: "stored tax-point and VAT amounts", warning: "Reporting only. Review with the accountant before formal VAT submission." }
  };
}

async function getOutstanding(input: Input, context: AssistantRouteContext | undefined, kind: "debtors" | "creditors"): Promise<ToolExecutionResult> {
  const { businessId } = requireContext(context);
  const asOf = isoDate(input.as_of_date, "as_of_date") ?? today();
  const minimum = toPence(input.minimum_outstanding as number | undefined);
  let rows: Array<{ party: string; reference: string; due_date: string | null; outstanding: number; ageing_bucket: string; job_ref: string | null }>;
  if (kind === "debtors") {
    const [invoices, credits] = await Promise.all([
      loadInvoices(businessId, { unpaid_only: true, customer_name: input.customer_name }),
      loadCredits(businessId, null, asOf)
    ]);
    const creditsByInvoice = new Map<string, number>();
    for (const credit of credits.filter((row: Row) => !["Draft", "Cancelled"].includes(String(row.status)))) {
      creditsByInvoice.set(String(credit.invoice_id), (creditsByInvoice.get(String(credit.invoice_id)) ?? 0) + toPence(credit.total));
    }
    rows = invoices.map((row) => ({ row, outstandingPence: Math.max(0, invoiceOutstandingPence(row) - (creditsByInvoice.get(String(row.id)) ?? 0)) }))
      .filter(({ row, outstandingPence }) => (row.invoice_date ?? row.issue_date ?? "") <= asOf && outstandingPence >= minimum && outstandingPence > 0)
      .map(({ row, outstandingPence }) => ({ party: row.customer_name ?? "Unknown", reference: row.invoice_ref, due_date: row.due_date ?? null, outstanding: fromPence(outstandingPence), ageing_bucket: ageingBucket(row.due_date, asOf), job_ref: row.job_ref ?? null }));
  } else {
    rows = (await loadSupplierBills(businessId, { unpaid_only: true, supplier_name: input.supplier_name }))
      .filter((row) => row.bill_date <= asOf && toPence(row.amount_outstanding) >= minimum)
      .map((row) => ({ party: row.supplier ?? "Unknown", reference: row.bill_number, due_date: row.due_date ?? null, outstanding: fromPence(toPence(row.amount_outstanding)), ageing_bucket: ageingBucket(row.due_date, asOf), job_ref: row.job_ref ?? null }));
  }
  const byParty = new Map<string, { totalPence: number; buckets: Record<string, number> }>();
  for (const row of rows) {
    const current = byParty.get(row.party) ?? { totalPence: 0, buckets: {} };
    const pence = toPence(row.outstanding);
    current.totalPence += pence;
    current.buckets[row.ageing_bucket] = (current.buckets[row.ageing_bucket] ?? 0) + pence;
    byParty.set(row.party, current);
  }
  const total = rows.reduce((sum, row) => sum + toPence(row.outstanding), 0);
  return { ok: true, summary: `${kind === "debtors" ? "Customers owe" : "The business owes suppliers"} ${formatGbp(fromPence(total))} as at ${asOf}.`, data: { as_of_date: asOf, total_outstanding: fromPence(total), parties: [...byParty.entries()].map(([party, value]) => ({ party, total_outstanding: fromPence(value.totalPence), ageing: Object.fromEntries(Object.entries(value.buckets).map(([key, pence]) => [key, fromPence(pence)])) })), items: rows } };
}

async function buildJobFinancial(businessId: string, job: Row) {
  const supabase = createSupabaseAdminClient();
  const [invoicesResult, creditsResult, expensesResult, billsResult, subcontractorResult, paymentsResult, quotesResult, variationsResult] = await Promise.all([
    supabase.from("invoices").select("*").eq("business_id", businessId).eq("job_id", job.id),
    supabase.from("credit_notes").select("*").eq("business_id", businessId).eq("job_id", job.id),
    supabase.from("job_expenses").select("*").eq("business_id", businessId).eq("job_id", job.id),
    supabase.from("supplier_bills").select("*").eq("business_id", businessId).eq("job_id", job.id),
    supabase.from("subcontractor_payments").select("*").eq("business_id", businessId).eq("job_id", job.id).in("status", ["Approved", "Part Paid", "Paid"]),
    supabase.from("invoice_payments").select("*").eq("business_id", businessId).eq("job_id", job.id),
    supabase.from("quotes").select("*").eq("business_id", businessId).eq("job_id", job.id).order("created_at", { ascending: false }),
    supabase.from("job_variations").select("*").eq("business_id", businessId).eq("job_id", job.id).eq("status", "Accepted")
  ]);
  const error = invoicesResult.error ?? creditsResult.error ?? expensesResult.error ?? billsResult.error ?? subcontractorResult.error ?? paymentsResult.error ?? quotesResult.error ?? variationsResult.error;
  if (error) throw new Error(error.message);
  const invoices = (invoicesResult.data ?? []).filter((row: Row) => !CANCELLED_INVOICE_STATUSES.has(String(row.status)));
  const credits = (creditsResult.data ?? []).filter((row: Row) => !["Draft", "Cancelled"].includes(String(row.status)));
  const billCosts = (billsResult.data ?? []).filter((row: Row) => !CANCELLED_PURCHASE_STATUSES.has(String(row.status))).map((row: Row) => ({ ...row, net_amount: row.subtotal, category: row.expense_category }));
  const subcontractorCosts = (subcontractorResult.data ?? []).map((row: Row) => ({ ...row, category: "Subcontractor" }));
  const costs = [...(expensesResult.data ?? []), ...billCosts, ...subcontractorCosts];
  const groupedCosts = groupDirectCosts(costs);
  const netInvoiced = sumPence(invoices.map((row: Row) => row.subtotal));
  const creditNet = sumPence(credits.map((row: Row) => row.subtotal));
  const vatInvoiced = sumPence(invoices.map((row: Row) => row.vat_amount)) - sumPence(credits.map((row: Row) => row.vat_amount));
  const grossInvoiced = sumPence(invoices.map((row: Row) => row.total)) - sumPence(credits.map((row: Row) => row.total));
  const paid = sumPence((paymentsResult.data ?? []).map((row: Row) => row.amount));
  const quote = (quotesResult.data ?? []).find((row: Row) => row.status === "Accepted") ?? (quotesResult.data ?? [])[0];
  const acceptedContract = toPence(quote?.total ?? job.final_value ?? 0);
  const variations = sumPence((variationsResult.data ?? []).map((row: Row) => row.subtotal ?? row.total));
  const netRevenue = netInvoiced - creditNet;
  return {
    job_ref: job.job_ref,
    job_title: job.job_title,
    job_status: job.status,
    quoted_value: fromPence(toPence(quote?.total ?? job.estimated_value)),
    accepted_contract_value: fromPence(acceptedContract),
    approved_variations: fromPence(variations),
    revised_contract_value: fromPence(acceptedContract + variations),
    sales: { net_invoiced: fromPence(netRevenue), vat_invoiced: fromPence(vatInvoiced), gross_invoiced: fromPence(grossInvoiced), total_credit_notes: fromPence(sumPence(credits.map((row: Row) => row.total))), payments_received: fromPence(paid), amount_outstanding: fromPence(Math.max(0, grossInvoiced - paid)) },
    costs: groupedCosts,
    profitability: calculateProfitability(netRevenue, groupedCosts.total_direct_costs_pence),
    invoices,
    payments: paymentsResult.data ?? [],
    credit_notes: credits,
    subcontractor_costs: subcontractorResult.data ?? [],
    costs_detail: costs
  };
}

async function getJobFinancials(input: Input, context?: AssistantRouteContext): Promise<ToolExecutionResult> {
  const { businessId } = requireContext(context);
  const supabase = createSupabaseAdminClient();
  const { data: job, error } = await supabase.from("jobs").select("*").eq("business_id", businessId).eq("job_ref", text(input.job_ref)).maybeSingle();
  if (error || !job) throw new Error(error?.message ?? `Job ${text(input.job_ref)} was not found in this workspace.`);
  const maps = await getLookupMaps(businessId);
  const report = await buildJobFinancial(businessId, job);
  const customer = maps.customers.get(String(job.customer_id))?.full_name ?? null;
  return { ok: true, summary: `${job.job_ref} has ${formatGbp(report.sales.net_invoiced)} net invoiced, ${formatGbp(report.costs.total_direct_costs)} direct costs and ${formatGbp(report.profitability.gross_profit)} gross profit.`, data: { ...report, customer } };
}

async function getProfitabilityReport(input: Input, context?: AssistantRouteContext): Promise<ToolExecutionResult> {
  const { businessId } = requireContext(context);
  const maps = await getLookupMaps(businessId);
  let jobs = [...maps.jobs.values()];
  if (input.job_ref) jobs = jobs.filter((row) => like(row.job_ref, input.job_ref));
  if (input.customer_name) jobs = jobs.filter((row) => like(maps.customers.get(String(row.customer_id))?.full_name, input.customer_name));
  if (input.include_open_jobs === false) jobs = jobs.filter((row) => row.status === "Completed");
  jobs = jobs.slice(0, limitOf(input));
  const reports = await Promise.all(jobs.map((job) => buildJobFinancial(businessId, job)));
  const start = isoDate(input.start_date, "start_date");
  const end = isoDate(input.end_date, "end_date");
  assertRange(start, end);
  const filtered = reports.filter((report) => {
    if (!start && !end) return true;
    return report.invoices.some((invoice: Row) => (!start || (invoice.invoice_date ?? invoice.issue_date) >= start) && (!end || (invoice.invoice_date ?? invoice.issue_date) <= end));
  });
  const net = sumPence(filtered.map((row) => row.sales.net_invoiced));
  const costs = sumPence(filtered.map((row) => row.costs.total_direct_costs));
  return { ok: true, summary: `Across ${filtered.length} job${filtered.length === 1 ? "" : "s"}, gross profit is ${formatGbp(fromPence(net - costs))}.`, data: { jobs: filtered.map((row) => { const sourceJob = [...maps.jobs.values()].find((job) => job.job_ref === row.job_ref); return { job_ref: row.job_ref, job_title: row.job_title, customer: maps.customers.get(String(sourceJob?.customer_id ?? ""))?.full_name ?? null, contract_value: row.revised_contract_value, net_invoiced: row.sales.net_invoiced, payments_received: row.sales.payments_received, direct_costs: row.costs.total_direct_costs, gross_profit: row.profitability.gross_profit, gross_margin_percent: row.profitability.gross_margin_percent }; }), totals: { net_invoiced: fromPence(net), direct_costs: fromPence(costs), ...calculateProfitability(net, costs) } } };
}

async function getFinancialSummary(input: Input, context?: AssistantRouteContext): Promise<ToolExecutionResult> {
  const { businessId } = requireContext(context);
  const start = isoDate(input.start_date, "start_date", true)!;
  const end = isoDate(input.end_date, "end_date", true)!;
  const [sales, vat, profitability, debtors, bills, expenses] = await Promise.all([
    getSalesSummary({ start_date: start, end_date: end }, context), getVatSummary({ start_date: start, end_date: end }, context), getProfitabilityReport({ start_date: start, end_date: end, include_open_jobs: true, limit: 100 }, context), getOutstanding({}, context, "debtors"), loadSupplierBills(businessId, { start_date: start, end_date: end }), loadExpenses(businessId, { start_date: start, end_date: end })
  ]);
  const supabase = createSupabaseAdminClient();
  const [quotesResult, jobsResult] = await Promise.all([
    supabase.from("quotes").select("total, status, created_at, updated_at").eq("business_id", businessId).gte("created_at", `${start}T00:00:00Z`).lte("created_at", `${end}T23:59:59Z`),
    supabase.from("jobs").select("estimated_value, accepted_at").eq("business_id", businessId).gte("accepted_at", `${start}T00:00:00Z`).lte("accepted_at", `${end}T23:59:59Z`)
  ]);
  if (quotesResult.error || jobsResult.error) throw new Error(quotesResult.error?.message ?? jobsResult.error?.message ?? "Unable to load pipeline metrics.");
  const quoted = sumPence((quotesResult.data ?? []).map((row: Row) => row.total));
  const accepted = sumPence((jobsResult.data ?? []).map((row: Row) => row.estimated_value));
  const salesData = sales.data as Row;
  const vatData = vat.data as Row;
  const profitData = profitability.data as Row;
  return { ok: true, summary: `Net invoiced sales were ${formatGbp(salesData.net_adjusted_sales)} and gross profit was ${formatGbp(profitData.totals.gross_profit)} for the period.`, data: { period: { start_date: start, end_date: end }, pipeline_metrics_not_turnover: { quoted_work: fromPence(quoted), accepted_contract_value: fromPence(accepted) }, accounting_metrics: { net_invoiced: salesData.net_adjusted_sales, vat_invoiced: salesData.output_vat - salesData.credit_note_vat, gross_invoiced: salesData.gross_sales - salesData.credit_notes, payments_received: salesData.payments_received, customer_debt_outstanding: (debtors.data as Row).total_outstanding, supplier_bills: fromPence(sumPence(bills.map((row) => row.total))), expenses: fromPence(sumPence(expenses.map((row) => row.gross_amount))), direct_job_costs: profitData.totals.direct_costs, gross_profit: profitData.totals.gross_profit, gross_margin_percent: profitData.totals.gross_margin_percent, input_vat: vatData.input_vat, estimated_vat_payable: vatData.vat_payable }, warning: vatData.warning } };
}

async function getAccountantPack(input: Input, context?: AssistantRouteContext): Promise<ToolExecutionResult> {
  const start = isoDate(input.start_date, "start_date", true)!;
  const end = isoDate(input.end_date, "end_date", true)!;
  const { businessId } = requireContext(context);
  const [sales, invoices, payments, bills, expenses, vat, debtors, creditors, profitability, credits, subcontractorCosts, bankReconciliation] = await Promise.all([
    getSalesSummary({ start_date: start, end_date: end }, context), getInvoices({ start_date: start, end_date: end, limit: 100 }, context), getPayments({ start_date: start, end_date: end, limit: 100 }, context), getSupplierBills({ start_date: start, end_date: end, limit: 100 }, context), getExpenses({ start_date: start, end_date: end, limit: 100 }, context), getVatSummary({ start_date: start, end_date: end }, context), getOutstanding({}, context, "debtors"), getOutstanding({}, context, "creditors"), getProfitabilityReport({ start_date: start, end_date: end, include_open_jobs: true, limit: 100 }, context), loadCredits(businessId, start, end), loadSubcontractorCosts(businessId, { start_date: start, end_date: end }), getBankReconciliationSummary({ start_date: start, end_date: end }, context)
  ]);
  return { ok: true, summary: `Prepared the structured accountant pack for ${start} to ${end}.`, data: { period: { start_date: start, end_date: end }, sales_summary: sales.data, invoice_register: (invoices.data as Row).invoices, credit_note_register: credits, payment_register: (payments.data as Row).payments, purchase_register: (bills.data as Row).supplier_bills, expense_register: (expenses.data as Row).expenses, subcontractor_cost_register: subcontractorCosts, vat_summary: vat.data, outstanding_debtors: debtors.data, outstanding_creditors: creditors.data, job_profitability_summary: profitability.data, bank_reconciliation: bankReconciliation.data, export: { available: false, note: "Structured JSON is returned; provider-neutral CSV/XLSX export is not enabled yet." } } };
}

const VAT_RATES: Record<string, number> = { "0": 0, "5": 5, "20": 20, exempt: 0, outside_scope: 0 };

function requireConfirmation(input: Input) {
  if (input.confirmed !== true) throw new Error("confirmed must be true after the user reviews this financial change.");
}

function financeLines(value: unknown, priceField: "unit_price" | "unit_cost") {
  if (!Array.isArray(value) || value.length === 0) throw new Error("At least one line item is required.");
  return value.map((raw, index) => {
    const line = raw as Row;
    const description = text(line.description);
    if (!description) throw new Error(`Line ${index + 1} requires a description.`);
    const quantity = Number(line.quantity ?? 1);
    if (!Number.isFinite(quantity) || quantity <= 0) throw new Error(`Line ${index + 1} quantity must be greater than zero.`);
    const unitValue = line[priceField];
    if (toPence(unitValue) < 0) throw new Error(`Line ${index + 1} ${priceField} cannot be negative.`);
    const vatCode = text(line.vat_code || "20").toLowerCase().replace("%", "");
    if (!(vatCode in VAT_RATES)) throw new Error(`Line ${index + 1} has an unsupported VAT code.`);
    const netPence = decimalMultiply(quantity, unitValue);
    const vatPence = Math.round((netPence * VAT_RATES[vatCode]) / 100);
    const common = {
      description,
      quantity,
      unit: text(line.unit) || null,
      [priceField]: fromPence(toPence(unitValue)),
      net_amount: fromPence(netPence),
      vat_rate: VAT_RATES[vatCode],
      vat_code: vatCode,
      vat_amount: fromPence(vatPence),
      gross_amount: fromPence(netPence + vatPence),
      job_cost_code: text(line.job_cost_code) || null,
      sort_order: index
    };
    return priceField === "unit_cost"
      ? { ...common, expense_category: text(line.expense_category || line.category) || null }
      : { ...common, category: text(line.category || line.expense_category) || null };
  });
}

async function resolveScopedJob(businessId: string, jobRef: unknown, required = true) {
  if (!jobRef && !required) return null;
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.from("jobs").select("*").eq("business_id", businessId).eq("job_ref", text(jobRef)).maybeSingle();
  if (error || !data) throw new Error(error?.message ?? `Job ${text(jobRef)} was not found in this workspace.`);
  return data as Row;
}

async function resolveScopedSupplier(businessId: string, supplierName: unknown) {
  const name = text(supplierName);
  if (!name) throw new Error("supplier_name is required.");
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.from("suppliers").select("*").eq("business_id", businessId).ilike("name", name).limit(2);
  if (error) throw new Error(error.message);
  const exact = (data ?? []).filter((row: Row) => String(row.name).toLowerCase() === name.toLowerCase());
  if (exact.length !== 1) throw new Error(`Supplier "${name}" was not found uniquely in this workspace.`);
  return exact[0] as Row;
}

async function resolveScopedSubcontractor(businessId: string, subcontractorName: unknown) {
  const name = text(subcontractorName);
  if (!name) throw new Error("subcontractor_name is required.");
  const { data, error } = await createSupabaseAdminClient()
    .from("labour_people")
    .select("*")
    .eq("business_id", businessId)
    .eq("worker_type", "subcontractor")
    .ilike("full_name", name)
    .limit(2);
  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error(`Subcontractor ${name} was not found in this workspace.`);
  if (data.length > 1) throw new Error(`More than one subcontractor is named ${name}; update the register so each subcontractor has a unique name.`);
  return data[0] as Row;
}

async function audit(businessId: string, actorId: string | null, action: string, entityType: string, entityId: string, visibleReference: string, details: Row) {
  const { error } = await createSupabaseAdminClient().from("finance_audit_log").insert({ business_id: businessId, actor_id: actorId, action, entity_type: entityType, entity_id: entityId, visible_reference: visibleReference, details });
  if (error) throw new Error(`Financial record was saved but its audit entry failed: ${error.message}`);
}

async function getSubcontractors(input: Input, context?: AssistantRouteContext): Promise<ToolExecutionResult> {
  const { businessId } = requireContext(context);
  const supabase = createSupabaseAdminClient();
  let query = supabase.from("labour_people").select("*").eq("business_id", businessId).eq("worker_type", "subcontractor").order("full_name");
  if (input.active_only !== false) query = query.eq("is_active", true);
  if (input.name) query = query.ilike("full_name", `%${text(input.name)}%`);
  const { data, error } = await query.limit(limitOf(input));
  if (error) throw new Error(error.message);
  const rows = (data ?? []).map((row: Row) => ({
    name: row.full_name,
    company_name: row.company_name,
    phone: row.phone,
    email: row.email,
    primary_role: row.primary_role,
    day_rate_cost: row.day_rate_cost,
    hourly_rate_cost: row.hourly_rate_cost,
    utr_number: row.utr_number,
    cis_status: row.cis_status,
    vat_registered: row.vat_registered,
    vat_number: row.vat_number,
    payment_terms_days: row.payment_terms_days,
    bank_account_name: row.bank_account_name,
    bank_sort_code: row.bank_sort_code,
    bank_account_last_four: row.bank_account_number ? String(row.bank_account_number).slice(-4) : null,
    public_liability_expiry: row.public_liability_expiry,
    employers_liability_expiry: row.employers_liability_expiry,
    verification_notes: row.verification_notes,
    is_active: row.is_active
  }));
  return { ok: true, summary: `Found ${rows.length} subcontractor${rows.length === 1 ? "" : "s"}.`, data: { subcontractors: rows } };
}

async function saveSubcontractor(input: Input, context?: AssistantRouteContext): Promise<ToolExecutionResult> {
  requireConfirmation(input);
  const { businessId, actorId } = requireContext(context);
  const name = text(input.subcontractor_name);
  if (!name) throw new Error("subcontractor_name is required.");
  const supabase = createSupabaseAdminClient();
  const lookupName = text(input.existing_name || name);
  const existingResult = await supabase.from("labour_people").select("*").eq("business_id", businessId).eq("worker_type", "subcontractor").ilike("full_name", lookupName).limit(2);
  if (existingResult.error) throw new Error(existingResult.error.message);
  if ((existingResult.data ?? []).length > 1) throw new Error(`More than one subcontractor is named ${lookupName}.`);
  const cisStatus = text(input.cis_status || "not_registered");
  if (!["gross", "net_20", "net_30", "not_registered"].includes(cisStatus)) throw new Error("cis_status must be gross, net_20, net_30 or not_registered.");
  const payload = {
    business_id: businessId,
    full_name: name,
    worker_type: "subcontractor",
    company_name: text(input.company_name) || null,
    primary_role: text(input.primary_role) || "Subcontractor",
    phone: text(input.phone) || null,
    email: text(input.email) || null,
    day_rate_cost: input.day_rate_cost == null ? null : fromPence(toPence(input.day_rate_cost)),
    hourly_rate_cost: input.hourly_rate_cost == null ? null : fromPence(toPence(input.hourly_rate_cost)),
    utr_number: text(input.utr_number) || null,
    cis_status: cisStatus,
    vat_registered: input.vat_registered === true,
    vat_number: input.vat_registered === true ? text(input.vat_number) || null : null,
    payment_terms_days: Math.max(0, Math.min(365, Number(input.payment_terms_days ?? 7))),
    bank_account_name: text(input.bank_account_name) || null,
    bank_sort_code: text(input.bank_sort_code) || null,
    bank_account_number: text(input.bank_account_number) || null,
    public_liability_expiry: isoDate(input.public_liability_expiry, "public_liability_expiry"),
    employers_liability_expiry: isoDate(input.employers_liability_expiry, "employers_liability_expiry"),
    verification_notes: text(input.verification_notes) || null,
    notes: text(input.notes) || null,
    is_active: input.is_active !== false,
    updated_at: new Date().toISOString()
  };
  const existing = (existingResult.data ?? [])[0] as Row | undefined;
  const result = existing
    ? await supabase.from("labour_people").update(payload).eq("id", existing.id).eq("business_id", businessId).select("*").single()
    : await supabase.from("labour_people").insert(payload).select("*").single();
  if (result.error || !result.data) throw new Error(result.error?.message ?? "Unable to save the subcontractor.");
  await audit(businessId, actorId, existing ? "update_subcontractor" : "create_subcontractor", "subcontractor", result.data.id, name, { cis_status: cisStatus, vat_registered: payload.vat_registered });
  return { ok: true, summary: `${existing ? "Updated" : "Added"} subcontractor ${name}.`, data: { name, company_name: result.data.company_name, cis_status: result.data.cis_status, vat_registered: result.data.vat_registered, payment_terms_days: result.data.payment_terms_days } };
}

async function recordSubcontractorCost(input: Input, context?: AssistantRouteContext): Promise<ToolExecutionResult> {
  requireConfirmation(input);
  const { businessId, actorId } = requireContext(context);
  const [subcontractor, job] = await Promise.all([resolveScopedSubcontractor(businessId, input.subcontractor_name), resolveScopedJob(businessId, input.job_ref)]);
  const workDate = isoDate(input.work_date, "work_date", true)!;
  const quantity = Number(input.quantity ?? 1);
  const unitRate = Number(input.unit_rate);
  const description = text(input.description);
  const unit = text(input.unit || "day");
  if (!description) throw new Error("description is required.");
  if (!["hour", "day", "item", "fixed"].includes(unit)) throw new Error("unit must be hour, day, item or fixed.");
  if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitRate) || unitRate < 0) throw new Error("quantity and unit_rate must be valid positive values.");
  const vatRate = subcontractor.vat_registered ? Number(input.vat_rate ?? 20) : 0;
  const cisRate = Number(input.cis_rate ?? (subcontractor.cis_status === "net_20" ? 20 : subcontractor.cis_status === "net_30" ? 30 : 0));
  if (![0, 5, 20].includes(vatRate) || ![0, 20, 30].includes(cisRate)) throw new Error("VAT or CIS rate is not supported.");
  const amounts = calculateSubcontractorAmounts({ quantity, unitRate, vatRate: vatRate as 0 | 5 | 20, cisRate: cisRate as 0 | 20 | 30 });
  const costReference = `WR-SUB-${workDate.replaceAll("-", "")}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
  const dueDate = isoDate(input.due_date, "due_date") ?? (() => { const date = new Date(`${workDate}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + Number(subcontractor.payment_terms_days ?? 7)); return date.toISOString().slice(0, 10); })();
  const inserted = await createSupabaseAdminClient().from("subcontractor_payments").insert({ business_id: businessId, subcontractor_id: subcontractor.id, job_id: job!.id, cost_reference: costReference, work_date: workDate, period_end_date: isoDate(input.period_end_date, "period_end_date"), invoice_reference: text(input.invoice_reference) || null, description, quantity, unit, unit_rate: unitRate, net_amount: amounts.net, vat_rate: vatRate, vat_amount: amounts.vat, gross_amount: amounts.gross, cis_rate: cisRate, cis_deduction: amounts.cisDeduction, amount_payable: amounts.payable, amount_paid: 0, amount_outstanding: amounts.payable, due_date: dueDate, status: "Approved", notes: text(input.notes) || null, created_by: actorId, approved_by: actorId, approved_at: new Date().toISOString() }).select("*").single();
  if (inserted.error || !inserted.data) throw new Error(inserted.error?.message ?? "Unable to record the subcontractor cost.");
  await audit(businessId, actorId, "create_subcontractor_cost", "subcontractor_payment", inserted.data.id, costReference, { job_ref: job!.job_ref, subcontractor: subcontractor.full_name, ...amounts });
  return { ok: true, summary: `Recorded ${formatGbp(amounts.net)} subcontractor cost on ${job!.job_ref}; ${formatGbp(amounts.payable)} is payable after CIS.`, data: { cost_reference: costReference, job_ref: job!.job_ref, subcontractor: subcontractor.full_name, ...amounts, due_date: dueDate, status: "Approved" } };
}

async function recordSubcontractorPaymentTool(input: Input, context?: AssistantRouteContext): Promise<ToolExecutionResult> {
  requireConfirmation(input);
  const { businessId, actorId } = requireContext(context);
  const supabase = createSupabaseAdminClient();
  const cost = await supabase.from("subcontractor_payments").select("*").eq("business_id", businessId).eq("cost_reference", text(input.cost_reference)).maybeSingle();
  if (cost.error || !cost.data) throw new Error(cost.error?.message ?? "Subcontractor cost not found in this workspace.");
  const amount = fromPence(toPence(input.amount));
  if (amount <= 0) throw new Error("amount must be greater than zero.");
  const paymentDate = isoDate(input.payment_date, "payment_date", true)!;
  const { data, error } = await supabase.rpc("record_subcontractor_payment", { p_business_id: businessId, p_payment_id: cost.data.id, p_amount: amount, p_payment_date: paymentDate, p_payment_method: text(input.payment_method), p_reference: text(input.reference) || null, p_actor_id: actorId });
  if (error) throw new Error(error.message);
  return { ok: true, summary: `Recorded ${formatGbp(amount)} paid against ${text(input.cost_reference)}.`, data };
}

async function createInvoice(input: Input, context?: AssistantRouteContext): Promise<ToolExecutionResult> {
  requireConfirmation(input);
  const { businessId, actorId } = requireContext(context);
  const invoiceDate = isoDate(input.invoice_date, "invoice_date", true)!;
  const dueDate = isoDate(input.due_date, "due_date", true)!;
  const taxPoint = isoDate(input.tax_point_date, "tax_point_date") ?? invoiceDate;
  if (dueDate < invoiceDate) throw new Error("due_date cannot be before invoice_date.");
  const job = await resolveScopedJob(businessId, input.job_ref);
  const lines = financeLines(input.lines, "unit_price");
  const subtotal = sumPence(lines.map((line) => line.net_amount));
  const vat = sumPence(lines.map((line) => line.vat_amount));
  const total = subtotal + vat;
  const status = text(input.status || "Draft");
  if (!["Draft", "Sent"].includes(status)) throw new Error("New invoices may only be Draft or Sent.");
  const supabase = createSupabaseAdminClient();
  const additionalWorkRef = text(input.additional_work_ref);
  let variation: Row | null = null;
  if (additionalWorkRef) {
    const variationLookup = await supabase
      .from("job_variations")
      .select("*")
      .eq("business_id", businessId)
      .eq("job_id", job!.id)
      .eq("variation_ref", additionalWorkRef)
      .maybeSingle();
    if (variationLookup.error || !variationLookup.data) {
      throw new Error(`Additional work ${additionalWorkRef} was not found on ${job!.job_ref} in this workspace.`);
    }
    variation = variationLookup.data as Row;
    if (!["Accepted", "Invoiced"].includes(String(variation.status))) {
      throw new Error(`Additional work ${additionalWorkRef} must be approved before it can be invoiced.`);
    }
    const linkedInvoices = await supabase
      .from("invoices")
      .select("status,total")
      .eq("business_id", businessId)
      .eq("variation_id", variation.id);
    if (linkedInvoices.error) throw new Error(linkedInvoices.error.message);
    const alreadyInvoiced = sumPence((linkedInvoices.data ?? []).filter((row: Row) => row.status !== "Void").map((row: Row) => row.total));
    const remaining = Math.max(0, toPence(variation.total) - alreadyInvoiced);
    if (total > remaining) {
      throw new Error(`Invoice total exceeds the ${formatGbp(fromPence(remaining))} remaining on ${additionalWorkRef}.`);
    }
  }
  const inserted = await supabase.from("invoices").insert({
    business_id: businessId, job_id: job!.id, customer_id: job!.customer_id, quote_id: null,
    variation_id: variation?.id ?? null,
    invoice_ref: input.invoice_number ? text(input.invoice_number) : null,
    invoice_date: invoiceDate, issue_date: invoiceDate, tax_point_date: taxPoint, due_date: dueDate,
    status, currency: "GBP", line_items: lines, subtotal: fromPence(subtotal), vat_amount: fromPence(vat), total: fromPence(total),
    amount_paid: 0, balance_due: fromPence(total), notes: text(input.notes) || null, payment_terms: text(input.payment_terms) || null,
    sent_at: status === "Sent" ? new Date().toISOString() : null
  }).select("*").single();
  if (inserted.error || !inserted.data) throw new Error(inserted.error?.message ?? "Unable to create the invoice.");
  const lineInsert = await supabase.from("invoice_lines").insert(lines.map((line) => ({ ...line, invoice_id: inserted.data.id })));
  if (lineInsert.error) {
    await supabase.from("invoices").delete().eq("id", inserted.data.id).eq("business_id", businessId);
    throw new Error(`Invoice lines could not be saved: ${lineInsert.error.message}`);
  }
  await audit(businessId, actorId, "create_invoice", "invoice", inserted.data.id, inserted.data.invoice_ref, { total: fromPence(total), job_ref: job!.job_ref });
  if (variation) await updateVariationInvoiceStatus(supabase, variation.id);
  return { ok: true, summary: `Created ${status.toLowerCase()} invoice ${inserted.data.invoice_ref} for ${formatGbp(fromPence(total))}.`, data: publicInvoice(enrichInvoice(inserted.data, await getLookupMaps(businessId))) };
}

async function recordCustomerPayment(input: Input, context?: AssistantRouteContext): Promise<ToolExecutionResult> {
  requireConfirmation(input);
  const { businessId, actorId } = requireContext(context);
  const amountPence = toPence(input.amount);
  if (amountPence <= 0) throw new Error("amount must be greater than zero.");
  const paymentDate = isoDate(input.payment_date, "payment_date", true)!;
  const { data, error } = await createSupabaseAdminClient().rpc("record_customer_payment_finance", { p_business_id: businessId, p_invoice_ref: text(input.invoice_number), p_amount: fromPence(amountPence), p_payment_date: paymentDate, p_payment_method: text(input.payment_method), p_reference: text(input.reference) || null, p_notes: text(input.notes) || null, p_actor_id: actorId });
  if (error) throw new Error(error.message);
  return { ok: true, summary: `Recorded ${formatGbp(fromPence(amountPence))} against ${text(input.invoice_number)}.`, data };
}

async function createSupplierBill(input: Input, context?: AssistantRouteContext): Promise<ToolExecutionResult> {
  requireConfirmation(input);
  const { businessId, actorId } = requireContext(context);
  const supplier = await resolveScopedSupplier(businessId, input.supplier_name);
  const job = await resolveScopedJob(businessId, input.job_ref, false);
  const billDate = isoDate(input.bill_date, "bill_date", true)!;
  const taxPoint = isoDate(input.tax_point_date, "tax_point_date") ?? billDate;
  const dueDate = isoDate(input.due_date, "due_date");
  const lines = financeLines(input.lines, "unit_cost");
  const subtotal = sumPence(lines.map((line) => line.net_amount));
  const vat = sumPence(lines.map((line) => line.vat_amount));
  const total = subtotal + vat;
  const supabase = createSupabaseAdminClient();
  const inserted = await supabase.from("supplier_bills").insert({ business_id: businessId, supplier_id: supplier.id, job_id: job?.id ?? null, bill_number: input.bill_number ? text(input.bill_number) : null, supplier_reference: text(input.supplier_reference) || null, bill_date: billDate, tax_point_date: taxPoint, due_date: dueDate, status: "Received", currency: "GBP", subtotal: fromPence(subtotal), vat_amount: fromPence(vat), total: fromPence(total), amount_paid: 0, amount_outstanding: fromPence(total), expense_category: text(input.expense_category) || null, notes: text(input.notes) || null }).select("*").single();
  if (inserted.error || !inserted.data) throw new Error(inserted.error?.message ?? "Unable to create the supplier bill.");
  const lineInsert = await supabase.from("supplier_bill_lines").insert(lines.map((line) => ({ ...line, supplier_bill_id: inserted.data.id })));
  if (lineInsert.error) {
    await supabase.from("supplier_bills").delete().eq("id", inserted.data.id).eq("business_id", businessId);
    throw new Error(`Supplier bill lines could not be saved: ${lineInsert.error.message}`);
  }
  await audit(businessId, actorId, "create_supplier_bill", "supplier_bill", inserted.data.id, inserted.data.bill_number, { total: fromPence(total), supplier: supplier.name });
  return { ok: true, summary: `Created supplier bill ${inserted.data.bill_number} for ${formatGbp(fromPence(total))}.`, data: inserted.data };
}

async function recordSupplierPayment(input: Input, context?: AssistantRouteContext): Promise<ToolExecutionResult> {
  requireConfirmation(input);
  const { businessId, actorId } = requireContext(context);
  const amountPence = toPence(input.amount);
  if (amountPence <= 0) throw new Error("amount must be greater than zero.");
  const paymentDate = isoDate(input.payment_date, "payment_date", true)!;
  const { data, error } = await createSupabaseAdminClient().rpc("record_supplier_payment_finance", { p_business_id: businessId, p_bill_number: text(input.bill_number), p_amount: fromPence(amountPence), p_payment_date: paymentDate, p_payment_method: text(input.payment_method), p_reference: text(input.reference) || null, p_notes: text(input.notes) || null, p_actor_id: actorId });
  if (error) throw new Error(error.message);
  return { ok: true, summary: `Recorded supplier payment of ${formatGbp(fromPence(amountPence))} against ${text(input.bill_number)}.`, data };
}

async function createExpense(input: Input, context?: AssistantRouteContext): Promise<ToolExecutionResult> {
  requireConfirmation(input);
  const { businessId, actorId } = requireContext(context);
  const job = await resolveScopedJob(businessId, input.job_ref, false);
  const supplier = input.supplier_name ? await resolveScopedSupplier(businessId, input.supplier_name) : null;
  const expenseDate = isoDate(input.expense_date, "expense_date", true)!;
  const net = toPence(input.net_amount);
  if (net < 0) throw new Error("net_amount cannot be negative.");
  const vatCode = text(input.vat_code || "20").toLowerCase().replace("%", "");
  if (!(vatCode in VAT_RATES)) throw new Error("Unsupported VAT code.");
  const vat = input.vat_amount === undefined ? Math.round((net * VAT_RATES[vatCode]) / 100) : toPence(input.vat_amount);
  const supabase = createSupabaseAdminClient();
  const inserted = await supabase.from("job_expenses").insert({ business_id: businessId, job_id: job?.id ?? null, supplier_id: supplier?.id ?? null, supplier_name: supplier?.name ?? (text(input.supplier_name) || null), expense_date: expenseDate, description: text(input.description), category: text(input.category || "Other"), amount: fromPence(net), net_amount: fromPence(net), vat_rate: VAT_RATES[vatCode], vat_code: vatCode, vat_amount: fromPence(vat), gross_amount: fromPence(net + vat), payment_method: text(input.payment_method) || null, reference: text(input.reference) || null, receipt_url: text(input.receipt_url) || null, notes: text(input.notes) || null }).select("*").single();
  if (inserted.error || !inserted.data) throw new Error(inserted.error?.message ?? "Unable to create the expense.");
  await audit(businessId, actorId, "create_expense", "expense", inserted.data.id, inserted.data.id, { gross: fromPence(net + vat), job_ref: job?.job_ref ?? null });
  return { ok: true, summary: `Recorded ${formatGbp(fromPence(net + vat))} expense for ${text(input.description)}.`, data: inserted.data };
}

async function createCreditNote(input: Input, context?: AssistantRouteContext): Promise<ToolExecutionResult> {
  requireConfirmation(input);
  const { businessId, actorId } = requireContext(context);
  const supabase = createSupabaseAdminClient();
  const invoiceQuery = await supabase.from("invoices").select("*").eq("business_id", businessId).eq("invoice_ref", text(input.invoice_number)).maybeSingle();
  if (invoiceQuery.error || !invoiceQuery.data) throw new Error(invoiceQuery.error?.message ?? "Invoice not found in this workspace.");
  const invoice = invoiceQuery.data as Row;
  const date = isoDate(input.credit_note_date, "credit_note_date", true)!;
  const lines = financeLines(input.lines, "unit_price");
  const subtotal = sumPence(lines.map((line) => line.net_amount));
  const vat = sumPence(lines.map((line) => line.vat_amount));
  const total = subtotal + vat;
  if (total > toPence(invoice.total)) throw new Error("Credit note cannot exceed the original invoice total.");
  const inserted = await supabase.from("credit_notes").insert({ business_id: businessId, customer_id: invoice.customer_id, job_id: invoice.job_id, invoice_id: invoice.id, credit_note_number: input.credit_note_number ? text(input.credit_note_number) : null, credit_note_date: date, tax_point_date: isoDate(input.tax_point_date, "tax_point_date") ?? date, currency: "GBP", subtotal: fromPence(subtotal), vat_amount: fromPence(vat), total: fromPence(total), reason: text(input.reason), status: "Issued", notes: text(input.notes) || null }).select("*").single();
  if (inserted.error || !inserted.data) throw new Error(inserted.error?.message ?? "Unable to create the credit note.");
  const lineInsert = await supabase.from("credit_note_lines").insert(lines.map((line) => ({ ...line, credit_note_id: inserted.data.id })));
  if (lineInsert.error) {
    await supabase.from("credit_notes").delete().eq("id", inserted.data.id).eq("business_id", businessId);
    throw new Error(`Credit note lines could not be saved: ${lineInsert.error.message}`);
  }
  await audit(businessId, actorId, "create_credit_note", "credit_note", inserted.data.id, inserted.data.credit_note_number, { total: fromPence(total), invoice_number: invoice.invoice_ref });
  return { ok: true, summary: `Created credit note ${inserted.data.credit_note_number} for ${formatGbp(fromPence(total))}.`, data: inserted.data };
}

async function previewBankStatementImport(input: Input, context?: AssistantRouteContext): Promise<ToolExecutionResult> {
  const { businessId, actorId } = requireContext(context);
  const rows = Array.isArray(input.transactions) ? input.transactions as Row[] : [];
  if (!rows.length) throw new Error("At least one bank transaction is required.");
  if (rows.length > 500) throw new Error("A statement import is limited to 500 transactions. Split larger statements into separate imports.");
  const sourceName = text(input.source_name);
  if (!sourceName) throw new Error("source_name is required.");
  const accountLastFour = text(input.account_last_four);
  if (accountLastFour && !/^\d{4}$/.test(accountLastFour)) throw new Error("account_last_four must contain exactly four digits.");
  const accountKey = `${text(input.account_name)}|${accountLastFour}`;
  const importRef = `WR-BANK-${today().replaceAll("-", "")}-${randomUUID().slice(0, 6).toUpperCase()}`;
  const prepared = rows.map((row, index) => {
    const transactionDate = isoDate(row.transaction_date, `transactions[${index}].transaction_date`, true)!;
    const description = text(row.description);
    const amount = fromPence(toPence(row.amount));
    if (!description || amount === 0) throw new Error(`Transaction ${index + 1} requires a description and non-zero signed amount.`);
    const suggestion = classifyBankTransaction(description, amount);
    const fingerprint = createHash("sha256").update(bankFingerprintSource({ accountKey, date: transactionDate, amount, description, reference: row.reference })).digest("hex");
    return { row, index, transactionDate, description, amount, suggestion, fingerprint };
  });
  const supabase = createSupabaseAdminClient();
  const existingTransactions: Row[] = [];
  const fingerprints = prepared.map((row) => row.fingerprint);
  for (let offset = 0; offset < fingerprints.length; offset += 100) {
    const fingerprintResult = await supabase
      .from("bank_transactions")
      .select("id,fingerprint,transaction_ref,review_status")
      .eq("business_id", businessId)
      .in("fingerprint", fingerprints.slice(offset, offset + 100));
    if (fingerprintResult.error) throw new Error(fingerprintResult.error.message);
    existingTransactions.push(...((fingerprintResult.data ?? []) as Row[]));
  }
  const existingByFingerprint = new Map(
    existingTransactions
      .filter((row) => !["Rejected", "Duplicate"].includes(String(row.review_status)))
      .map((row) => [String(row.fingerprint), row]),
  );
  const debitTotal = sumPence(prepared.filter((row) => row.amount < 0).map((row) => Math.abs(row.amount)));
  const creditTotal = sumPence(prepared.filter((row) => row.amount > 0).map((row) => row.amount));
  const dates = prepared.map((row) => row.transactionDate).sort();
  const insertedImport = await supabase.from("bank_statement_imports").insert({ business_id: businessId, import_ref: importRef, source_name: sourceName, original_filename: text(input.original_filename) || null, account_name: text(input.account_name) || null, account_last_four: accountLastFour || null, period_start: isoDate(input.period_start, "period_start") ?? dates[0], period_end: isoDate(input.period_end, "period_end") ?? dates[dates.length - 1], status: "Review", row_count: rows.length, debit_total: fromPence(debitTotal), credit_total: fromPence(creditTotal), notes: text(input.notes) || null, created_by: actorId }).select("*").single();
  if (insertedImport.error || !insertedImport.data) throw new Error(insertedImport.error?.message ?? "Unable to create statement import.");
  const seen = new Map<string, string>();
  const transactionRows = prepared.map(({ row, index, transactionDate, description, amount, suggestion, fingerprint }) => {
    const existing = existingByFingerprint.get(fingerprint);
    const withinImport = seen.get(fingerprint);
    const transactionRef = `BT-${String(index + 1).padStart(4, "0")}`;
    if (!seen.has(fingerprint)) seen.set(fingerprint, transactionRef);
    const duplicate = Boolean(existing || withinImport);
    const gross = Math.abs(amount);
    return {
      business_id: businessId, import_id: insertedImport.data.id, transaction_ref: transactionRef, row_index: index + 1,
      transaction_date: transactionDate, description, reference: text(row.reference) || null, amount,
      direction: amount > 0 ? "money_in" : "money_out", balance: row.balance == null ? null : fromPence(toPence(row.balance)), currency: "GBP", fingerprint,
      proposed_type: text(row.proposed_type) || suggestion.proposedType, category: text(row.category || suggestion.category) || null,
      vat_code: "outside_scope", net_amount: gross, vat_amount: 0, gross_amount: gross,
      proposed_supplier_name: text(row.supplier_name) || null, proposed_job_ref: text(row.job_ref) || null,
      proposed_invoice_number: text(row.invoice_number) || null, proposed_bill_number: text(row.bill_number) || null,
      confidence: suggestion.confidence, reasoning: duplicate ? `Possible duplicate of ${existing?.transaction_ref ?? withinImport}.` : suggestion.reasoning,
      review_status: duplicate ? "Duplicate" : "Needs Review", duplicate_of: existing?.id ?? null
    };
  });
  const insertedRows = await supabase.from("bank_transactions").insert(transactionRows).select("*").order("row_index");
  if (insertedRows.error) {
    await supabase.from("bank_statement_imports").delete().eq("id", insertedImport.data.id).eq("business_id", businessId);
    throw new Error(`Statement transactions could not be staged: ${insertedRows.error.message}`);
  }
  await audit(businessId, actorId, "preview_bank_statement_import", "bank_statement_import", insertedImport.data.id, importRef, { row_count: rows.length, debit_total: fromPence(debitTotal), credit_total: fromPence(creditTotal) });
  const duplicateCount = transactionRows.filter((row) => row.review_status === "Duplicate").length;
  return { ok: true, summary: `Staged ${rows.length} bank transactions in ${importRef}; ${duplicateCount} possible duplicate${duplicateCount === 1 ? "" : "s"} and ${rows.length - duplicateCount} require review. No accounting records were created.`, data: { import: insertedImport.data, transactions: insertedRows.data ?? [], safety: "Preview only. VAT defaults to Outside Scope and every non-duplicate row requires review before commit." } };
}

async function findBankTransaction(businessId: string, importRef: unknown, transactionRef: unknown) {
  const supabase = createSupabaseAdminClient();
  const importResult = await supabase.from("bank_statement_imports").select("*").eq("business_id", businessId).eq("import_ref", text(importRef)).maybeSingle();
  if (importResult.error || !importResult.data) throw new Error(importResult.error?.message ?? "Statement import not found in this workspace.");
  if (importResult.data.status === "Committed") throw new Error("This statement import has already been committed.");
  const txResult = await supabase.from("bank_transactions").select("*").eq("business_id", businessId).eq("import_id", importResult.data.id).eq("transaction_ref", text(transactionRef)).maybeSingle();
  if (txResult.error || !txResult.data) throw new Error(txResult.error?.message ?? "Bank transaction not found in this import.");
  return { supabase, statementImport: importResult.data as Row, transaction: txResult.data as Row };
}

async function reviewBankTransaction(input: Input, context?: AssistantRouteContext): Promise<ToolExecutionResult> {
  requireConfirmation(input);
  const { businessId, actorId } = requireContext(context);
  const { supabase, statementImport, transaction } = await findBankTransaction(businessId, input.import_ref, input.transaction_ref);
  const action = text(input.action || "approve");
  if (action === "reject" || action === "duplicate") {
    const reviewStatus = action === "reject" ? "Rejected" : "Duplicate";
    const updated = await supabase.from("bank_transactions").update({ review_status: reviewStatus, reasoning: text(input.reasoning) || transaction.reasoning, reviewed_by: actorId, reviewed_at: new Date().toISOString() }).eq("id", transaction.id).eq("business_id", businessId).select("*").single();
    if (updated.error) throw new Error(updated.error.message);
    return { ok: true, summary: `${transaction.transaction_ref} marked ${reviewStatus.toLowerCase()}.`, data: updated.data };
  }
  if (action !== "approve") throw new Error("action must be approve, reject or duplicate.");
  const proposedType = text(input.proposed_type || transaction.proposed_type) as BankTransactionType;
  if (!["expense", "customer_payment", "supplier_payment", "transfer", "ignore"].includes(proposedType)) throw new Error("Approved rows must be an expense, customer payment, supplier payment, transfer or ignore item.");
  const gross = Math.abs(fromPence(toPence(input.gross_amount ?? transaction.gross_amount ?? transaction.amount)));
  const vatCode = text(input.vat_code || transaction.vat_code || "outside_scope").toLowerCase().replace("%", "");
  if (!(vatCode in VAT_RATES)) throw new Error("Unsupported VAT code.");
  const vat = proposedType === "expense" ? fromPence(toPence(input.vat_amount ?? transaction.vat_amount ?? 0)) : 0;
  const net = proposedType === "expense" ? fromPence(toPence(input.net_amount ?? (gross - vat))) : gross;
  if (proposedType === "expense" && (transaction.direction !== "money_out" || !text(input.category || transaction.category))) throw new Error("An expense must be money out and have a category.");
  if (proposedType === "expense" && (net < 0 || vat < 0 || Math.abs(net + vat - gross) > 0.009)) throw new Error("Expense net plus VAT must equal the bank transaction amount.");
  const job = (input.job_ref || transaction.proposed_job_ref) ? await resolveScopedJob(businessId, input.job_ref || transaction.proposed_job_ref, false) : null;
  const supplier = (input.supplier_name || transaction.proposed_supplier_name) ? await resolveScopedSupplier(businessId, input.supplier_name || transaction.proposed_supplier_name) : null;
  let invoice: Row | null = null;
  let bill: Row | null = null;
  if (proposedType === "customer_payment") {
    if (transaction.direction !== "money_in") throw new Error("Customer payments must be money in.");
    const invoiceNumber = text(input.invoice_number || transaction.proposed_invoice_number);
    const result = await supabase.from("invoices").select("*").eq("business_id", businessId).eq("invoice_ref", invoiceNumber).maybeSingle();
    if (result.error || !result.data) throw new Error(result.error?.message ?? "Matched invoice not found in this workspace.");
    if (["Draft", "Void", "Cancelled"].includes(result.data.status)) throw new Error("This invoice cannot receive a payment.");
    if (toPence(gross) > invoiceOutstandingPence(result.data)) throw new Error("Bank receipt exceeds the invoice outstanding amount.");
    invoice = result.data;
  }
  if (proposedType === "supplier_payment") {
    if (transaction.direction !== "money_out") throw new Error("Supplier payments must be money out.");
    const billNumber = text(input.bill_number || transaction.proposed_bill_number);
    const result = await supabase.from("supplier_bills").select("*").eq("business_id", businessId).eq("bill_number", billNumber).maybeSingle();
    if (result.error || !result.data) throw new Error(result.error?.message ?? "Matched supplier bill not found in this workspace.");
    if (toPence(gross) > toPence(result.data.amount_outstanding)) throw new Error("Bank payment exceeds the supplier bill outstanding amount.");
    bill = result.data;
  }
  const patch = {
    proposed_type: proposedType, category: proposedType === "expense" ? text(input.category || transaction.category) : null,
    vat_code: proposedType === "expense" ? vatCode : "outside_scope", net_amount: net, vat_amount: vat, gross_amount: gross,
    job_id: job?.id ?? (invoice?.job_id || bill?.job_id || null), supplier_id: supplier?.id ?? bill?.supplier_id ?? null,
    invoice_id: invoice?.id ?? null, supplier_bill_id: bill?.id ?? null,
    proposed_supplier_name: supplier?.name ?? (text(input.supplier_name || transaction.proposed_supplier_name) || null),
    proposed_job_ref: job?.job_ref ?? (text(input.job_ref || transaction.proposed_job_ref) || null),
    proposed_invoice_number: invoice?.invoice_ref ?? null, proposed_bill_number: bill?.bill_number ?? null,
    review_status: "Approved", reviewed_by: actorId, reviewed_at: new Date().toISOString(), reasoning: text(input.reasoning) || transaction.reasoning
  };
  const updated = await supabase.from("bank_transactions").update(patch).eq("id", transaction.id).eq("business_id", businessId).select("*").single();
  if (updated.error || !updated.data) throw new Error(updated.error?.message ?? "Unable to review the bank transaction.");
  await audit(businessId, actorId, "review_bank_transaction", "bank_transaction", transaction.id, transaction.transaction_ref, { import_ref: statementImport.import_ref, action, proposed_type: proposedType });
  return { ok: true, summary: `${transaction.transaction_ref} approved as ${proposedType.replaceAll("_", " ")}. Nothing has been posted yet.`, data: updated.data };
}

async function commitBankStatementImport(input: Input, context?: AssistantRouteContext): Promise<ToolExecutionResult> {
  requireConfirmation(input);
  const { businessId, actorId } = requireContext(context);
  const decisions = Array.isArray(input.decisions) ? input.decisions as Row[] : [];
  for (const decision of decisions) await reviewBankTransaction({ ...decision, import_ref: input.import_ref, confirmed: true }, context);
  const { data, error } = await createSupabaseAdminClient().rpc("commit_bank_statement_import", { p_business_id: businessId, p_import_ref: text(input.import_ref), p_actor_id: actorId });
  if (error) throw new Error(error.message);
  return { ok: true, summary: `Committed reviewed bank statement ${text(input.import_ref)}.`, data };
}

async function getUnmatchedBankTransactions(input: Input, context?: AssistantRouteContext): Promise<ToolExecutionResult> {
  const { businessId } = requireContext(context);
  const supabase = createSupabaseAdminClient();
  let importsQuery = supabase.from("bank_statement_imports").select("*").eq("business_id", businessId).order("created_at", { ascending: false });
  if (input.import_ref) importsQuery = importsQuery.eq("import_ref", text(input.import_ref));
  const imports = await importsQuery.limit(limitOf(input));
  if (imports.error) throw new Error(imports.error.message);
  const importIds = (imports.data ?? []).map((row: Row) => row.id);
  let transactions: Row[] = [];
  if (importIds.length) {
    let query = supabase.from("bank_transactions").select("*").eq("business_id", businessId).in("import_id", importIds).order("transaction_date", { ascending: false });
    if (input.review_status) query = query.eq("review_status", text(input.review_status));
    else query = query.eq("review_status", "Needs Review");
    const result = await query.limit(limitOf(input));
    if (result.error) throw new Error(result.error.message);
    transactions = result.data ?? [];
  }
  return { ok: true, summary: `Found ${transactions.length} bank transaction${transactions.length === 1 ? "" : "s"} requiring the selected review state.`, data: { imports: imports.data ?? [], transactions } };
}

async function getBankReconciliationSummary(input: Input, context?: AssistantRouteContext): Promise<ToolExecutionResult> {
  const { businessId } = requireContext(context);
  const supabase = createSupabaseAdminClient();
  let importQuery = supabase.from("bank_statement_imports").select("*").eq("business_id", businessId).order("created_at", { ascending: false });
  if (input.import_ref) importQuery = importQuery.eq("import_ref", text(input.import_ref));
  const imports = await importQuery.limit(limitOf(input));
  if (imports.error) throw new Error(imports.error.message);
  const ids = (imports.data ?? []).map((row: Row) => row.id);
  const txResult = ids.length ? await supabase.from("bank_transactions").select("*").eq("business_id", businessId).in("import_id", ids) : { data: [], error: null };
  if (txResult.error) throw new Error(txResult.error.message);
  const transactions = txResult.data ?? [];
  const statusCounts = transactions.reduce((acc: Record<string, number>, row: Row) => { acc[row.review_status] = (acc[row.review_status] ?? 0) + 1; return acc; }, {});
  return { ok: true, summary: `${imports.data?.length ?? 0} statement import${imports.data?.length === 1 ? "" : "s"}; ${statusCounts["Needs Review"] ?? 0} transactions still need review.`, data: { imports: imports.data ?? [], totals: { money_in: fromPence(sumPence(transactions.filter((row: Row) => row.amount > 0).map((row: Row) => row.amount))), money_out: fromPence(sumPence(transactions.filter((row: Row) => row.amount < 0).map((row: Row) => Math.abs(row.amount)))) }, status_counts: statusCounts } };
}

export async function executeFinanceTool(toolName: string, input: Input, context?: AssistantRouteContext): Promise<ToolExecutionResult> {
  switch (toolName) {
    case "preview_bank_statement_import": return previewBankStatementImport(input, context);
    case "get_unmatched_transactions": return getUnmatchedBankTransactions(input, context);
    case "categorise_bank_transaction": return reviewBankTransaction(input, context);
    case "link_transaction_to_job": return reviewBankTransaction({ ...input, action: input.action || "approve" }, context);
    case "match_customer_payment": return reviewBankTransaction({ ...input, action: "approve", proposed_type: "customer_payment" }, context);
    case "reconcile_supplier_payment": return reviewBankTransaction({ ...input, action: "approve", proposed_type: "supplier_payment" }, context);
    case "commit_bank_statement_import": return commitBankStatementImport(input, context);
    case "get_bank_reconciliation_summary": return getBankReconciliationSummary(input, context);
    case "get_subcontractors": return getSubcontractors(input, context);
    case "save_subcontractor": return saveSubcontractor(input, context);
    case "record_subcontractor_cost": return recordSubcontractorCost(input, context);
    case "record_subcontractor_payment": return recordSubcontractorPaymentTool(input, context);
    case "get_invoices": return getInvoices(input, context);
    case "get_invoice_detail": return getInvoiceDetail(input, context);
    case "get_payments": return getPayments(input, context);
    case "get_supplier_bills": return getSupplierBills(input, context);
    case "get_expenses": return getExpenses(input, context);
    case "get_job_financials": return getJobFinancials(input, context);
    case "get_sales_summary": return getSalesSummary(input, context);
    case "get_vat_summary": return getVatSummary(input, context);
    case "get_outstanding_debtors": return getOutstanding(input, context, "debtors");
    case "get_outstanding_creditors": return getOutstanding(input, context, "creditors");
    case "get_profitability_report": return getProfitabilityReport(input, context);
    case "get_financial_summary": return getFinancialSummary(input, context);
    case "get_accountant_pack": return getAccountantPack(input, context);
    case "create_invoice": return createInvoice(input, context);
    case "record_customer_payment": return recordCustomerPayment(input, context);
    case "create_supplier_bill": return createSupplierBill(input, context);
    case "record_supplier_payment": return recordSupplierPayment(input, context);
    case "create_expense": return createExpense(input, context);
    case "create_credit_note": return createCreditNote(input, context);
    default: throw new Error(`Unknown finance tool: ${toolName}`);
  }
}
