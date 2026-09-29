"use client";

import { useMemo, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type {
  BankStatementImportRecord,
  BankTransactionRecord,
  Customer,
  InvoiceRecord,
  Job,
  SupplierBillRecord,
} from "@/lib/types";
import { BANK_EXPENSE_CATEGORIES } from "@/lib/finance/bankStatements";
import { currency } from "@/lib/utils";

type FinanceJob = Job & {
  customer?: Customer | null;
  invoices?: InvoiceRecord[];
};
type Draft = {
  proposed_type: string;
  category: string;
  job_ref: string;
  vat_code: string;
  vat_amount: number;
  invoice_number: string;
  bill_number: string;
};

export function BankReconciliationTab({
  imports,
  jobs,
  supplierBills,
}: {
  imports: BankStatementImportRecord[];
  jobs: FinanceJob[];
  supplierBills: SupplierBillRecord[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selectedRef, setSelectedRef] = useState(
    imports.find((item) => item.status !== "Committed")?.import_ref ??
      imports[0]?.import_ref ??
      "",
  );
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [feedback, setFeedback] = useState<string | null>(null);
  const selected = imports.find((item) => item.import_ref === selectedRef);
  const invoices = useMemo(
    () =>
      jobs.flatMap((job) =>
        (job.invoices ?? [])
          .filter(
            (invoice) =>
              !["Draft", "Void", "Cancelled"].includes(invoice.status) &&
              Number(invoice.balance_due ?? 0) > 0,
          )
          .map((invoice) => ({ invoice, job })),
      ),
    [jobs],
  );

  function draftFor(tx: BankTransactionRecord): Draft {
    return (
      drafts[tx.id] ?? {
        proposed_type:
          tx.proposed_type === "unmatched"
            ? tx.direction === "money_in"
              ? "customer_payment"
              : "expense"
            : tx.proposed_type,
        category: tx.category || "Other",
        job_ref: tx.proposed_job_ref || "",
        vat_code: tx.vat_code || "outside_scope",
        vat_amount: Number(tx.vat_amount || 0),
        invoice_number: tx.proposed_invoice_number || "",
        bill_number: tx.proposed_bill_number || "",
      }
    );
  }

  function update(tx: BankTransactionRecord, patch: Partial<Draft>) {
    setDrafts((current) => ({
      ...current,
      [tx.id]: { ...draftFor(tx), ...patch },
    }));
  }

  async function review(
    tx: BankTransactionRecord,
    action: "approve" | "reject" | "duplicate",
  ) {
    if (!selected) return;
    const draft = draftFor(tx);
    const gross = Math.abs(Number(tx.amount));
    const vat =
      draft.proposed_type === "expense" ? Number(draft.vat_amount || 0) : 0;
    setFeedback(null);
    const response = await fetch("/api/finance/bank-reconciliation", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        import_ref: selected.import_ref,
        transaction_ref: tx.transaction_ref,
        action,
        proposed_type: draft.proposed_type,
        category: draft.category,
        job_ref: draft.job_ref || undefined,
        vat_code: draft.vat_code,
        vat_amount: vat,
        net_amount: gross - vat,
        gross_amount: gross,
        invoice_number: draft.invoice_number || undefined,
        bill_number: draft.bill_number || undefined,
      }),
    });
    const result = await response.json().catch(() => null);
    setFeedback(result?.summary || result?.error || "Review saved.");
    if (response.ok) startTransition(() => router.refresh());
  }

  async function commit() {
    if (
      !selected ||
      !window.confirm(
        `Commit every approved row in ${selected.import_ref}? This will create real accounting entries.`,
      )
    )
      return;
    const response = await fetch("/api/finance/bank-reconciliation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ import_ref: selected.import_ref }),
    });
    const result = await response.json().catch(() => null);
    setFeedback(result?.summary || result?.error || "Commit finished.");
    if (response.ok) startTransition(() => router.refresh());
  }

  if (!imports.length)
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <h2 className="font-semibold">Bank statement review</h2>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Upload a CSV, spreadsheet or PDF statement in ChatGPT and ask it to
          preview the statement with the We Are Roofing MCP. Nothing posts to
          the accounts until you approve and commit it.
        </p>
      </div>
    );
  const transactions = selected?.transactions ?? [];
  const needsReview = transactions.filter(
    (tx) => tx.review_status === "Needs Review",
  ).length;
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <label className="min-w-72">
            <span className="label">Statement import</span>
            <select
              className="field mt-2"
              value={selectedRef}
              onChange={(event) => setSelectedRef(event.target.value)}
            >
              {imports.map((item) => (
                <option key={item.id} value={item.import_ref}>
                  {item.import_ref} — {item.source_name} — {item.status}
                </option>
              ))}
            </select>
          </label>
          <button
            className="button-primary"
            disabled={
              pending ||
              !selected ||
              selected.status === "Committed" ||
              needsReview > 0
            }
            onClick={commit}
            type="button"
          >
            Commit reviewed statement
          </button>
        </div>
        {selected ? (
          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Metric label="Money out" value={selected.debit_total} />
            <Metric label="Money in" value={selected.credit_total} />
            <Metric label="Rows" text={String(selected.row_count)} />
            <Metric label="Needs review" text={String(needsReview)} />
          </div>
        ) : null}
        <p className="mt-3 text-xs text-[var(--text-muted)]">
          VAT starts as Outside Scope. Only use 5% or 20% when a valid VAT
          invoice or receipt supports it. Possible duplicates should not be
          approved.
        </p>
        {feedback ? (
          <p className="mt-3 text-sm text-[var(--gold)]">{feedback}</p>
        ) : null}
      </div>
      <div className="space-y-3">
        {transactions.map((tx) => {
          const draft = draftFor(tx);
          const editable =
            tx.review_status !== "Committed" &&
            selected?.status !== "Committed";
          return (
            <div
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
              key={tx.id}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{tx.description}</p>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    {tx.transaction_date} · {tx.transaction_ref} ·{" "}
                    {tx.reasoning}
                  </p>
                </div>
                <div className="text-right">
                  <p
                    className={`text-lg font-bold ${tx.amount > 0 ? "text-green-500" : "text-[var(--text)]"}`}
                  >
                    {currency(tx.amount)}
                  </p>
                  <span className="text-xs text-[var(--text-muted)]">
                    {tx.review_status}
                  </span>
                </div>
              </div>
              {editable && tx.review_status !== "Duplicate" ? (
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <Field label="Type">
                    <select
                      className="field"
                      value={draft.proposed_type}
                      onChange={(e) =>
                        update(tx, { proposed_type: e.target.value })
                      }
                    >
                      <option value="expense">Expense</option>
                      <option value="customer_payment">Customer payment</option>
                      <option value="supplier_payment">Supplier payment</option>
                      <option value="transfer">Internal transfer</option>
                      <option value="ignore">Ignore / non-ledger</option>
                    </select>
                  </Field>
                  {draft.proposed_type === "expense" ? (
                    <>
                      <Field label="Category">
                        <select
                          className="field"
                          value={draft.category}
                          onChange={(e) =>
                            update(tx, { category: e.target.value })
                          }
                        >
                          {BANK_EXPENSE_CATEGORIES.map((category) => (
                            <option key={category}>{category}</option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Job">
                        <select
                          className="field"
                          value={draft.job_ref}
                          onChange={(e) =>
                            update(tx, { job_ref: e.target.value })
                          }
                        >
                          <option value="">Overhead / no job</option>
                          {jobs.map((job) => (
                            <option key={job.id} value={job.job_ref || ""}>
                              {job.job_ref} — {job.job_title}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="VAT">
                        <select
                          className="field"
                          value={draft.vat_code}
                          onChange={(e) => {
                            const code = e.target.value;
                            const gross = Math.abs(Number(tx.amount));
                            const rate =
                              code === "20" ? 20 : code === "5" ? 5 : 0;
                            update(tx, {
                              vat_code: code,
                              vat_amount: rate
                                ? Number(
                                    (gross - gross / (1 + rate / 100)).toFixed(
                                      2,
                                    ),
                                  )
                                : 0,
                            });
                          }}
                        >
                          <option value="outside_scope">Outside Scope</option>
                          <option value="0">0%</option>
                          <option value="5">5%</option>
                          <option value="20">20%</option>
                          <option value="exempt">Exempt</option>
                        </select>
                      </Field>
                    </>
                  ) : null}
                  {draft.proposed_type === "customer_payment" ? (
                    <Field label="Invoice">
                      <select
                        className="field"
                        value={draft.invoice_number}
                        onChange={(e) =>
                          update(tx, { invoice_number: e.target.value })
                        }
                      >
                        <option value="">Choose invoice...</option>
                        {invoices.map(({ invoice, job }) => (
                          <option key={invoice.id} value={invoice.invoice_ref}>
                            {invoice.invoice_ref} — {job.customer?.full_name} —{" "}
                            {currency(invoice.balance_due)}
                          </option>
                        ))}
                      </select>
                    </Field>
                  ) : null}
                  {draft.proposed_type === "supplier_payment" ? (
                    <Field label="Supplier bill">
                      <select
                        className="field"
                        value={draft.bill_number}
                        onChange={(e) =>
                          update(tx, { bill_number: e.target.value })
                        }
                      >
                        <option value="">Choose bill...</option>
                        {supplierBills
                          .filter((bill) => Number(bill.amount_outstanding) > 0)
                          .map((bill) => (
                            <option key={bill.id} value={bill.bill_number}>
                              {bill.bill_number} — {bill.supplier?.name} —{" "}
                              {currency(bill.amount_outstanding)}
                            </option>
                          ))}
                      </select>
                    </Field>
                  ) : null}
                </div>
              ) : null}
              {editable ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    className="button-primary"
                    onClick={() => review(tx, "approve")}
                    type="button"
                  >
                    Approve
                  </button>
                  <button
                    className="button-secondary"
                    onClick={() => review(tx, "reject")}
                    type="button"
                  >
                    Reject
                  </button>
                  <button
                    className="button-ghost"
                    onClick={() => review(tx, "duplicate")}
                    type="button"
                  >
                    Mark duplicate
                  </button>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label>
      <span className="label">{label}</span>
      <span className="mt-2 block">{children}</span>
    </label>
  );
}
function Metric({
  label,
  value,
  text,
}: {
  label: string;
  value?: number;
  text?: string;
}) {
  return (
    <div className="rounded-lg border border-[var(--border)] p-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
        {label}
      </p>
      <p className="mt-2 text-lg font-bold">{text ?? currency(value || 0)}</p>
    </div>
  );
}
