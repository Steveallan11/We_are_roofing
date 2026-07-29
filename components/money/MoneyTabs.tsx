"use client";

import Link from "next/link";
import type { Route } from "next";
import { useState } from "react";
import type {
  Job,
  Customer,
  QuoteRecord,
  JobDocumentRecord,
  InvoiceRecord,
  JobExpense,
  JobFinancialSnapshot,
  ReceiptInboxRecord
} from "@/lib/types";
import { currency } from "@/lib/utils";
import { getQuotePipelineValue } from "@/lib/quotes/value";
import { ReceiptInbox } from "@/components/money/ReceiptInbox";

type ExpenseWithJob = JobExpense & { job?: { id: string; job_title: string; job_ref?: string | null } | null };

interface MoneyTabsProps {
  jobs: Array<Job & { customer?: Customer | null; quote?: QuoteRecord | null; documents?: JobDocumentRecord[]; invoices?: InvoiceRecord[] }>;
  expenses?: ExpenseWithJob[];
  receiptInbox?: ReceiptInboxRecord[];
  jobFinancials?: JobFinancialSnapshot[];
}

const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  materials: "Materials",
  labour: "Labour",
  subcontractor: "Subcontractor",
  plant_hire: "Plant Hire",
  skip_hire: "Skip Hire",
  scaffolding: "Scaffolding",
  fuel: "Fuel / Travel",
  waste: "Waste",
  other: "Other"
};

export function MoneyTabs({ jobs, expenses = [], receiptInbox = [], jobFinancials = [] }: MoneyTabsProps) {
  const [activeTab, setActiveTab] = useState<"revenue" | "jobProfit" | "expenses" | "invoices" | "forecast">("revenue");

  const quotes = jobs.flatMap((job) => (job.quote ? [job.quote] : []));
  const invoicesWithJobs = jobs.flatMap((job) =>
    (job.invoices ?? []).map((inv) => ({ invoice: inv, job }))
  );
  const invoices = invoicesWithJobs.map((item) => item.invoice);

  const quotePipeline = quotes.reduce((sum, quote) => sum + Number(getQuotePipelineValue(quote) ?? 0), 0);
  const outstanding = invoicesWithJobs
    .filter((item) => !["Paid", "Void"].includes(item.invoice.status))
    .reduce((sum, item) => sum + Number(item.invoice.balance_due), 0);

  const invoicesByStatus = {
    paid: invoicesWithJobs.filter((item) => item.invoice.status === "Paid"),
    partPaid: invoicesWithJobs.filter((item) => item.invoice.status === "Part Paid"),
    sent: invoicesWithJobs.filter((item) => item.invoice.status === "Sent"),
    overdue: invoicesWithJobs.filter((item) => item.invoice.status === "Overdue"),
  };

  const paidTotal = invoicesByStatus.paid.reduce((sum, item) => sum + Number(item.invoice.total ?? 0), 0);
  const partPaidTotal = invoicesByStatus.partPaid.reduce((sum, item) => sum + Number(item.invoice.balance_due ?? 0), 0);
  const sentTotal = invoicesByStatus.sent.reduce((sum, item) => sum + Number(item.invoice.total ?? 0), 0);
  const overdueTotal = invoicesByStatus.overdue.reduce((sum, item) => sum + Number(item.invoice.total ?? 0), 0);

  const pipelineQuoted = quotes.filter((q) => q.status === "Draft").reduce((sum, q) => sum + Number(q.total ?? 0), 0);
  const pipelineSent = quotes.filter((q) => q.status === "Sent").reduce((sum, q) => sum + Number(q.total ?? 0), 0);
  const pipelineAccepted = quotes.filter((q) => q.status === "Accepted").reduce((sum, q) => sum + Number(q.total ?? 0), 0);

  const tabs = [
    { id: "revenue" as const, label: "Revenue" },
    { id: "jobProfit" as const, label: "Job Profit" },
    { id: "expenses" as const, label: "Expenses" },
    { id: "invoices" as const, label: "Invoices" },
    { id: "forecast" as const, label: "Forecast" },
  ];

  return (
    <div>
      <div className="sticky top-0 border-b border-[var(--border)] bg-[var(--surface)] z-10">
        <div className="flex gap-1 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
                activeTab === tab.id
                  ? "border-[var(--gold)] text-[var(--text)]"
                  : "border-transparent text-[var(--text-muted)] hover:text-[var(--text)]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="pt-4">
        {activeTab === "revenue" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Paid</p>
                <p className="mt-2 text-2xl font-bold text-green-600">{currency(paidTotal)}</p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">{invoicesByStatus.paid.length} invoices</p>
              </div>
              <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Part Paid</p>
                <p className="mt-2 text-2xl font-bold text-blue-600">{currency(partPaidTotal)}</p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">{invoicesByStatus.partPaid.length} invoices</p>
              </div>
              <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Sent</p>
                <p className="mt-2 text-2xl font-bold text-yellow-600">{currency(sentTotal)}</p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">{invoicesByStatus.sent.length} invoices</p>
              </div>
              <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Overdue</p>
                <p className="mt-2 text-2xl font-bold text-red-600">{currency(overdueTotal)}</p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">{invoicesByStatus.overdue.length} invoices</p>
              </div>
            </div>

            {invoicesWithJobs.length > 0 ? (
              <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--border)] bg-[var(--surface-raised)]">
                        <th className="px-4 py-3 text-left font-medium text-[var(--text-muted)]">Invoice</th>
                        <th className="px-4 py-3 text-left font-medium text-[var(--text-muted)]">Customer</th>
                        <th className="px-4 py-3 text-right font-medium text-[var(--text-muted)]">Total</th>
                        <th className="px-4 py-3 text-left font-medium text-[var(--text-muted)]">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoicesWithJobs.map(({ invoice, job }) => (
                        <tr key={invoice.id} className="border-b border-[var(--border)] hover:bg-[var(--surface-raised)]">
                          <td className="px-4 py-3 font-medium text-[var(--text)]">{invoice.invoice_ref}</td>
                          <td className="px-4 py-3 text-[var(--text-muted)]">{job.customer?.full_name}</td>
                          <td className="px-4 py-3 text-right font-medium text-[var(--text)]">{currency(invoice.total ?? 0)}</td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                                invoice.status === "Paid"
                                  ? "bg-green-100 text-green-800"
                                  : invoice.status === "Part Paid"
                                    ? "bg-blue-100 text-blue-800"
                                    : invoice.status === "Sent"
                                      ? "bg-yellow-100 text-yellow-800"
                                      : invoice.status === "Overdue"
                                        ? "bg-red-100 text-red-800"
                                        : "bg-gray-100 text-gray-800"
                              }`}
                            >
                              {invoice.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-8 text-center">
                <p className="text-[var(--text-muted)]">No invoices yet</p>
              </div>
            )}
          </div>
        )}

        {activeTab === "jobProfit" && <JobProfitTab jobs={jobs} expenses={expenses} jobFinancials={jobFinancials} />}

        {activeTab === "expenses" && <ExpensesTab expenses={expenses} jobs={jobs} receiptInbox={receiptInbox} />}

        {activeTab === "invoices" && (
          <div className="space-y-4">
            {invoicesWithJobs.length > 0 ? (
              <div className="grid gap-3">
                {invoicesWithJobs.map(({ invoice, job }) => (
                  <div key={invoice.id} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 hover:border-[var(--gold)] transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <p className="font-semibold text-[var(--text)]">{invoice.invoice_ref}</p>
                        <p className="text-sm text-[var(--text-muted)] mt-1">{job.customer?.full_name}</p>
                        <p className="text-xs text-[var(--text-muted)] mt-1">
                          Due {new Date(invoice.due_date ?? "").toLocaleDateString("en-GB")}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-lg text-[var(--text)]">{currency(invoice.total ?? 0)}</p>
                        <span
                          className={`inline-block px-2 py-1 rounded text-xs font-medium mt-2 ${
                            invoice.status === "Paid"
                              ? "bg-green-100 text-green-800"
                              : invoice.status === "Part Paid"
                                ? "bg-blue-100 text-blue-800"
                                : invoice.status === "Sent"
                                  ? "bg-yellow-100 text-yellow-800"
                                  : invoice.status === "Overdue"
                                    ? "bg-red-100 text-red-800"
                                    : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {invoice.status}
                        </span>
                      </div>
                    </div>
                    {invoice.balance_due && invoice.balance_due > 0 && (
                      <p className="mt-3 text-sm font-medium text-red-600">
                        {currency(invoice.balance_due)} outstanding
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-8 text-center">
                <p className="text-[var(--text-muted)]">No invoices yet</p>
              </div>
            )}
          </div>
        )}

        {activeTab === "forecast" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Quoted</p>
                <p className="mt-2 text-2xl font-bold text-[var(--text)]">{currency(pipelineQuoted)}</p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">{quotes.filter((q) => q.status === "Draft").length} quotes</p>
              </div>
              <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Sent (Awaiting)</p>
                <p className="mt-2 text-2xl font-bold text-[var(--gold)]">{currency(pipelineSent)}</p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">{quotes.filter((q) => q.status === "Sent").length} quotes</p>
              </div>
              <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Accepted (Pipeline)</p>
                <p className="mt-2 text-2xl font-bold text-green-600">{currency(pipelineAccepted)}</p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">{quotes.filter((q) => q.status === "Accepted").length} quotes</p>
              </div>
            </div>

            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6">
              <h3 className="font-semibold text-[var(--text)] mb-4">Expected Revenue Breakdown</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center pb-3 border-b border-[var(--border)]">
                  <span className="text-[var(--text-muted)]">Already Paid</span>
                  <span className="font-semibold text-[var(--text)]">{currency(paidTotal)}</span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b border-[var(--border)]">
                  <span className="text-[var(--text-muted)]">Outstanding Invoices</span>
                  <span className="font-semibold text-[var(--text)]">{currency(outstanding)}</span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b border-[var(--border)]">
                  <span className="text-[var(--text-muted)]">From Accepted Quotes</span>
                  <span className="font-semibold text-[var(--text)]">{currency(pipelineAccepted)}</span>
                </div>
                <div className="flex justify-between items-center pt-2 bg-[var(--surface-raised)] px-3 py-2 rounded">
                  <span className="font-semibold text-[var(--text)]">Total Potential</span>
                  <span className="font-bold text-lg text-[var(--gold)]">{currency(paidTotal + outstanding + pipelineAccepted)}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

type JobProfitRow = {
  job: MoneyTabsProps["jobs"][number];
  quoteNet: number;
  invoiced: number;
  paid: number;
  outstanding: number;
  materials: number;
  materialsRecorded: number;
  materialsEstimated: boolean;
  labour: number;
  labourRecorded: number;
  labourEstimated: boolean;
  otherCosts: number;
  costsNet: number;
  recordedCosts: number;
  costVat: number;
  cisHeld: number;
  profit: number | null;
  cashPosition: number;
};

function JobProfitTab({
  jobs,
  expenses,
  jobFinancials
}: {
  jobs: MoneyTabsProps["jobs"];
  expenses: ExpenseWithJob[];
  jobFinancials: JobFinancialSnapshot[];
}) {
  const snapshotsByJob = new Map(jobFinancials.map((snapshot) => [snapshot.job_id, snapshot]));
  const expensesByJob = new Map<string, ExpenseWithJob[]>();
  for (const expense of expenses) {
    const list = expensesByJob.get(expense.job_id) ?? [];
    list.push(expense);
    expensesByJob.set(expense.job_id, list);
  }

  const rows: JobProfitRow[] = jobs
    .map((job) => {
      const jobExpenses = expensesByJob.get(job.id) ?? [];
      const snapshot = snapshotsByJob.get(job.id);
      const liveInvoices = (job.invoices ?? []).filter((invoice) => invoice.status !== "Void");
      const sumExpenses = (categories: string[], field: "gross" | "vat" | "net") =>
        jobExpenses
          .filter((expense) => categories.includes(expense.category))
          .reduce((sum, expense) => {
            const gross = Number(expense.amount ?? 0);
            const vat = Number(expense.vat_amount ?? 0);
            if (field === "gross") return sum + gross;
            if (field === "vat") return sum + vat;
            return sum + Math.max(0, gross - vat);
          }, 0);

      const materialExpenseGross = sumExpenses(["materials"], "gross");
      const materialExpenseNet = sumExpenses(["materials"], "net");
      const labourExpenseGross = sumExpenses(["labour", "subcontractor"], "gross");
      const labourExpenseNet = sumExpenses(["labour", "subcontractor"], "net");
      const otherCategories = ["plant_hire", "skip_hire", "scaffolding", "fuel", "waste", "other"];
      const otherGross = sumExpenses(otherCategories, "gross");
      const otherNet = sumExpenses(otherCategories, "net");
      const otherVat = sumExpenses(otherCategories, "vat");
      const materialHasActuals = Number(snapshot?.material_actual_gross ?? 0) > 0;
      const materialHasReceipts = materialExpenseGross > 0;
      const materials = materialHasActuals
        ? Number(snapshot?.material_resolved_net ?? 0)
        : materialHasReceipts
          ? materialExpenseNet
          : Number(snapshot?.material_resolved_net ?? 0);
      const materialsRecorded = materialHasActuals
        ? Number(snapshot?.material_actual_gross ?? 0)
        : materialExpenseGross;
      const labourHasReceipts = labourExpenseGross > 0;
      const labourHasActuals = Number(snapshot?.labour_actual_net ?? 0) > 0;
      const labour = labourHasReceipts
        ? labourExpenseNet
        : Number(snapshot?.labour_resolved_net ?? 0);
      const labourRecorded = labourHasReceipts
        ? labourExpenseGross
        : Number(snapshot?.labour_actual_net ?? 0);
      const materialVat = materialHasActuals
        ? Number(snapshot?.material_actual_vat ?? 0)
        : materialHasReceipts
          ? sumExpenses(["materials"], "vat")
          : 0;
      const labourVat = labourHasReceipts ? sumExpenses(["labour", "subcontractor"], "vat") : 0;
      const quoteNet = Number(job.quote?.subtotal ?? 0);
      const invoiced = liveInvoices.reduce((sum, invoice) => sum + Number(invoice.total ?? 0), 0);
      const paid = liveInvoices.reduce((sum, invoice) => sum + Number(invoice.amount_paid ?? 0), 0);
      const outstanding = liveInvoices.reduce((sum, invoice) => sum + Number(invoice.balance_due ?? 0), 0);
      const costsNet = materials + labour + otherNet;
      const recordedCosts = materialsRecorded + labourRecorded + otherGross;
      const costVat = materialVat + labourVat + otherVat;
      const cisHeld = jobExpenses.reduce((sum, expense) => sum + Number(expense.cis_deduction ?? 0), 0);

      return {
        job,
        quoteNet,
        invoiced,
        paid,
        outstanding,
        materials,
        materialsRecorded,
        materialsEstimated: !materialHasReceipts && Number(snapshot?.material_estimated_count ?? 0) > 0,
        labour,
        labourRecorded,
        labourEstimated: !labourHasReceipts && Number(snapshot?.labour_estimated_count ?? 0) > 0,
        otherCosts: otherNet,
        costsNet,
        recordedCosts,
        costVat,
        cisHeld,
        profit: quoteNet > 0 ? quoteNet - costsNet : null,
        cashPosition: paid - Math.max(0, recordedCosts - cisHeld)
      };
    })
    .filter((row) => row.quoteNet > 0 || row.invoiced > 0 || row.costsNet > 0 || row.recordedCosts > 0);

  const totalPaid = rows.reduce((sum, row) => sum + row.paid, 0);
  const totalOutstanding = rows.reduce((sum, row) => sum + row.outstanding, 0);
  const totalRecordedCosts = rows.reduce((sum, row) => sum + row.recordedCosts, 0);
  const totalProfit = rows.reduce((sum, row) => sum + (row.profit ?? 0), 0);

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center">
        <p className="font-semibold text-[var(--text)]">No job financials yet</p>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Quotes, invoices, labour, materials, and assigned receipts will appear here by job.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[var(--gold)]/40 bg-[var(--surface)] p-4">
        <p className="text-sm font-semibold text-[var(--text)]">A complete view of money in and costs out</p>
        <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
          Paid in comes from invoice payments. Recorded costs come from receipts, expenses, material actuals, and labour actuals.
          Estimates are marked and never added on top of a matching recorded expense.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MoneySummaryCard label="Paid in" value={totalPaid} tone="positive" />
        <MoneySummaryCard label="Still due" value={totalOutstanding} tone="attention" />
        <MoneySummaryCard label="Recorded costs" value={totalRecordedCosts} tone="negative" />
        <MoneySummaryCard label="Est. profit" value={totalProfit} tone={totalProfit >= 0 ? "positive" : "negative"} />
      </div>

      <div className="space-y-4">
        {rows.map((row) => {
          const margin = row.profit !== null && row.quoteNet > 0 ? (row.profit / row.quoteNet) * 100 : null;
          const costPercent = row.quoteNet > 0 ? Math.min(100, Math.max(0, (row.costsNet / row.quoteNet) * 100)) : 0;
          return (
            <article key={row.job.id} className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
              <div className="flex flex-col gap-3 border-b border-[var(--border)] bg-[var(--surface-raised)] p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-[var(--text)]">{row.job.job_ref || row.job.job_title}</p>
                    <span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)]">
                      {row.job.status}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-[var(--text-muted)]">
                    {row.job.customer?.full_name || "No customer"} · {row.job.job_title}
                  </p>
                </div>
                <Link
                  href={`/jobs/${row.job.id}?tab=money` as Route}
                  className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[var(--gold)] px-4 text-sm font-bold text-black transition-opacity hover:opacity-90"
                >
                  Open job money
                </Link>
              </div>

              <div className="grid gap-4 p-4 lg:grid-cols-3">
                <MoneyDetailGroup title="Money coming in" accent="green">
                  <MoneyDetailRow label="Paid in" value={row.paid} strong />
                  <MoneyDetailRow label="Invoiced" value={row.invoiced} />
                  <MoneyDetailRow label="Still due" value={row.outstanding} />
                </MoneyDetailGroup>

                <MoneyDetailGroup title="Costs going out" accent="red">
                  <MoneyDetailRow label="Materials" value={row.materials} estimated={row.materialsEstimated} />
                  <MoneyDetailRow label="Labour & subbies" value={row.labour} estimated={row.labourEstimated} />
                  <MoneyDetailRow label="Scaffold, hire & other" value={row.otherCosts} />
                  {row.costVat > 0 ? <MoneyDetailRow label="VAT recorded" value={row.costVat} subtle /> : null}
                  {row.cisHeld > 0 ? <MoneyDetailRow label="CIS held" value={row.cisHeld} subtle /> : null}
                </MoneyDetailGroup>

                <MoneyDetailGroup title="Job position" accent="gold">
                  <MoneyDetailRow label="Quote before VAT" value={row.quoteNet} />
                  <MoneyDetailRow label="Costs before VAT" value={row.costsNet} />
                  <MoneyDetailRow label="Estimated profit" value={row.profit} strong />
                  <MoneyDetailRow label="Cash position today" value={row.cashPosition} subtle />
                </MoneyDetailGroup>
              </div>

              {row.quoteNet > 0 ? (
                <div className="border-t border-[var(--border)] px-4 py-3">
                  <div className="mb-2 flex items-center justify-between gap-3 text-xs">
                    <span className="text-[var(--text-muted)]">Cost used against quoted value</span>
                    <span className={`font-bold ${margin !== null && margin < 0 ? "text-red-600" : "text-[var(--text)]"}`}>
                      {margin === null ? "TBC" : `${margin.toFixed(1)}% margin`}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-raised)]">
                    <div
                      className={`h-full rounded-full ${row.profit !== null && row.profit < 0 ? "bg-red-500" : "bg-[var(--gold)]"}`}
                      style={{ width: `${costPercent}%` }}
                    />
                  </div>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </div>
  );
}

function MoneySummaryCard({
  label,
  value,
  tone
}: {
  label: string;
  value: number;
  tone: "positive" | "attention" | "negative";
}) {
  const toneClass =
    tone === "positive" ? "text-green-600" : tone === "negative" ? "text-red-600" : "text-[var(--gold)]";
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">{label}</p>
      <p className={`mt-2 text-xl font-bold sm:text-2xl ${toneClass}`}>{currency(value)}</p>
    </div>
  );
}

function MoneyDetailGroup({
  title,
  accent,
  children
}: {
  title: string;
  accent: "green" | "red" | "gold";
  children: React.ReactNode;
}) {
  const borderClass =
    accent === "green" ? "border-l-green-500" : accent === "red" ? "border-l-red-500" : "border-l-[var(--gold)]";
  return (
    <section className={`rounded-lg border border-[var(--border)] border-l-4 ${borderClass} bg-[var(--surface-raised)] p-4`}>
      <h3 className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-[var(--text)]">{title}</h3>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function MoneyDetailRow({
  label,
  value,
  estimated = false,
  strong = false,
  subtle = false
}: {
  label: string;
  value: number | null;
  estimated?: boolean;
  strong?: boolean;
  subtle?: boolean;
}) {
  return (
    <div className={`flex items-start justify-between gap-3 text-sm ${strong ? "border-t border-[var(--border)] pt-2 first:border-0 first:pt-0" : ""}`}>
      <span className={subtle ? "text-[var(--text-muted)]" : "text-[var(--text)]"}>
        {label}
        {estimated ? (
          <span className="ml-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-900">
            Estimate
          </span>
        ) : null}
      </span>
      <span className={`${strong ? "font-bold text-[var(--text)]" : "font-semibold text-[var(--text)]"} whitespace-nowrap`}>
        {value === null ? "TBC" : currency(value)}
      </span>
    </div>
  );
}

function ExpensesTab({
  expenses,
  jobs,
  receiptInbox
}: {
  expenses: ExpenseWithJob[];
  jobs: MoneyTabsProps["jobs"];
  receiptInbox: ReceiptInboxRecord[];
}) {
  const now = new Date();
  const monthKey = now.toISOString().slice(0, 7);
  const totalAll = expenses.reduce((sum, expense) => sum + Number(expense.amount ?? 0), 0);
  const totalThisMonth = expenses
    .filter((expense) => (expense.expense_date || "").startsWith(monthKey))
    .reduce((sum, expense) => sum + Number(expense.amount ?? 0), 0);

  const byCategory = new Map<string, number>();
  for (const expense of expenses) {
    const label = EXPENSE_CATEGORY_LABELS[expense.category] ?? "Other";
    byCategory.set(label, (byCategory.get(label) ?? 0) + Number(expense.amount ?? 0));
  }
  const topCategories = [...byCategory.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);

  return (
    <div className="space-y-4">
      <ReceiptInbox initialReceipts={receiptInbox} jobs={jobs} />

      {expenses.length === 0 ? (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-8 text-center">
          <p className="text-[var(--text-muted)]">
            No expenses logged yet. Add a receipt above, or open a job and use its <span className="font-semibold text-[var(--text)]">Money</span> tab.
          </p>
        </div>
      ) : (
        <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">This Month</p>
          <p className="mt-2 text-2xl font-bold text-[var(--text)]">{currency(totalThisMonth)}</p>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">All Time</p>
          <p className="mt-2 text-2xl font-bold text-[var(--text)]">{currency(totalAll)}</p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">{expenses.length} expenses</p>
        </div>
        {topCategories.slice(0, 2).map(([label, value]) => (
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4" key={label}>
            <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">{label}</p>
            <p className="mt-2 text-2xl font-bold text-[var(--text)]">{currency(value)}</p>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--surface-raised)]">
                <th className="px-4 py-3 text-left font-medium text-[var(--text-muted)]">Date</th>
                <th className="px-4 py-3 text-left font-medium text-[var(--text-muted)]">Job</th>
                <th className="px-4 py-3 text-left font-medium text-[var(--text-muted)]">Category</th>
                <th className="px-4 py-3 text-left font-medium text-[var(--text-muted)]">Description</th>
                <th className="px-4 py-3 text-right font-medium text-[var(--text-muted)]">Amount</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((expense) => (
                <tr key={`${expense.source}-${expense.id}`} className="border-b border-[var(--border)] hover:bg-[var(--surface-raised)]">
                  <td className="px-4 py-3 whitespace-nowrap text-[var(--text-muted)]">
                    {expense.expense_date ? new Date(expense.expense_date).toLocaleDateString("en-GB") : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {expense.job ? (
                      <Link className="text-[var(--gold)] underline-offset-4 hover:underline" href={`/jobs/${expense.job.id}?tab=money` as Route}>
                        {expense.job.job_title}
                      </Link>
                    ) : (
                      <span className="text-[var(--text-muted)]">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[var(--text-muted)]">{EXPENSE_CATEGORY_LABELS[expense.category] ?? "Other"}</td>
                  <td className="px-4 py-3 text-[var(--text)]">
                    {expense.description}
                    {expense.supplier_name ? <span className="text-[var(--text-muted)]"> · {expense.supplier_name}</span> : null}
                    {expense.source === "diary" ? <span className="ml-2 rounded bg-[var(--surface-raised)] px-1.5 py-0.5 text-xs text-[var(--text-muted)]">Diary</span> : null}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-[var(--text)]">{currency(expense.amount ?? 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
        </>
      )}
    </div>
  );
}
