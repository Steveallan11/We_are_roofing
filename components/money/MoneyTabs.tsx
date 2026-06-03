"use client";

import { useState } from "react";
import type { Job, Customer, QuoteRecord, JobDocumentRecord, InvoiceRecord } from "@/lib/types";
import { currency } from "@/lib/utils";
import { getQuotePipelineValue } from "@/lib/quotes/value";

interface MoneyTabsProps {
  jobs: Array<Job & { customer?: Customer | null; quote?: QuoteRecord | null; documents?: JobDocumentRecord[]; invoices?: InvoiceRecord[] }>;
}

export function MoneyTabs({ jobs }: MoneyTabsProps) {
  const [activeTab, setActiveTab] = useState<"revenue" | "expenses" | "invoices" | "forecast">("revenue");

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

        {activeTab === "expenses" && (
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-8 text-center">
            <p className="text-[var(--text-muted)]">Expense tracking coming soon. Log expenses in Diary.</p>
          </div>
        )}

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
