"use client";

import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { SendInvoiceModal } from "@/components/invoices/SendInvoiceModal";
import { Badge, Button, PageSection, Stat } from "@/components/ui/primitives";
import { getInvoicePdfHref } from "@/lib/documents";
import { getFirmQuoteLines } from "@/lib/quotes/provisional";
import { currency, formatDate } from "@/lib/utils";
import type { InvoiceRecord, InvoiceType, JobExpense, JobExpenseCategory, QuoteRecord } from "@/lib/types";

type Props = {
  jobId: string;
  jobTitle: string;
  quote: QuoteRecord | null;
  invoices: InvoiceRecord[];
  expenses: JobExpense[];
  customerName: string;
  customerEmail: string | null | undefined;
};

const EXPENSE_CATEGORIES: Array<{ value: JobExpenseCategory; label: string }> = [
  { value: "materials", label: "Materials" },
  { value: "labour", label: "Labour" },
  { value: "subcontractor", label: "Subcontractor" },
  { value: "plant_hire", label: "Plant Hire" },
  { value: "skip_hire", label: "Skip Hire" },
  { value: "scaffolding", label: "Scaffolding" },
  { value: "fuel", label: "Fuel / Travel" },
  { value: "waste", label: "Waste" },
  { value: "other", label: "Other" }
];

const PAYMENT_METHODS = ["Bank Transfer", "Cash", "Card", "Cheque", "Other"];

const INVOICE_TYPE_LABELS: Record<string, string> = {
  deposit: "Deposit",
  interim: "Interim",
  final: "Final Balance",
  standard: "Full Invoice"
};

export function JobMoneyTab({ jobId, jobTitle, quote, invoices, expenses: initialExpenses, customerName, customerEmail }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [expenses, setExpenses] = useState<JobExpense[]>(initialExpenses);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [showDepositForm, setShowDepositForm] = useState(false);
  const [depositPct, setDepositPct] = useState("30");
  const [showInterimForm, setShowInterimForm] = useState(false);
  const [interimMode, setInterimMode] = useState<"fixed" | "percentage">("fixed");
  const [interimValue, setInterimValue] = useState("");
  const [interimDescription, setInterimDescription] = useState("");
  const [sendInvoice, setSendInvoice] = useState<InvoiceRecord | null>(null);
  const [paymentInvoice, setPaymentInvoice] = useState<InvoiceRecord | null>(null);

  const liveInvoices = invoices.filter((invoice) => invoice.status !== "Void");
  const invoiceableQuoteTotal = quote ? calculateFirmQuoteTotal(quote) : 0;
  const summary = useMemo(() => {
    const quoteTotal = Number(quote?.total ?? 0);
    const quoteNet = Number(quote?.subtotal ?? 0);
    const invoiced = liveInvoices.reduce((sum, invoice) => sum + Number(invoice.total ?? 0), 0);
    const paid = liveInvoices.reduce((sum, invoice) => sum + Number(invoice.amount_paid ?? 0), 0);
    const outstanding = liveInvoices.reduce((sum, invoice) => sum + Number(invoice.balance_due ?? 0), 0);
    const expensesGross = expenses.reduce((sum, expense) => sum + Number(expense.amount ?? 0), 0);
    const expensesNet = expenses.reduce((sum, expense) => sum + Number(expense.amount ?? 0) - Number(expense.vat_amount ?? 0), 0);
    const profit = quoteNet > 0 ? quoteNet - expensesNet : null;
    return { quoteTotal, quoteNet, invoiced, paid, outstanding, expensesGross, expensesNet, profit };
  }, [quote, liveInvoices, expenses]);

  function notify(nextMessage: string | null, nextError: string | null) {
    setMessage(nextMessage);
    setError(nextError);
  }

  async function createInvoice(type: InvoiceType, depositPercentage?: number) {
    notify(null, null);
    setBusy(`create-${type}`);
    const response = await fetch(`/api/jobs/${jobId}/invoices`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, deposit_percentage: depositPercentage })
    });
    const result = (await response.json().catch(() => null)) as { ok?: boolean; message?: string; error?: string; warning?: string } | null;
    setBusy(null);
    if (!response.ok || !result?.ok) {
      notify(null, result?.error || "Invoice could not be created.");
      return;
    }
    setShowDepositForm(false);
    notify([result.message, result.warning].filter(Boolean).join(" "), null);
    startTransition(() => router.refresh());
  }

  async function createInterimInvoice() {
    notify(null, null);
    setBusy("create-interim");
    const value = Number(interimValue);
    const body: Record<string, unknown> = { type: "interim", description: interimDescription.trim() || undefined };
    if (interimMode === "fixed") body.amount = value;
    else body.percentage = value;
    const response = await fetch(`/api/jobs/${jobId}/invoices`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const result = (await response.json().catch(() => null)) as { ok?: boolean; message?: string; error?: string; warning?: string } | null;
    setBusy(null);
    if (!response.ok || !result?.ok) {
      notify(null, result?.error || "Invoice could not be created.");
      return;
    }
    setShowInterimForm(false);
    setInterimValue("");
    setInterimDescription("");
    notify([result.message, result.warning].filter(Boolean).join(" "), null);
    startTransition(() => router.refresh());
  }

  async function voidInvoice(invoice: InvoiceRecord) {
    if (!window.confirm(`Void ${invoice.invoice_ref}? It will be excluded from totals.`)) return;
    notify(null, null);
    setBusy(invoice.id);
    const response = await fetch(`/api/invoices/${invoice.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "Void" })
    });
    const result = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
    setBusy(null);
    if (!response.ok || !result?.ok) {
      notify(null, result?.error || "Invoice could not be voided.");
      return;
    }
    notify(`${invoice.invoice_ref} voided.`, null);
    startTransition(() => router.refresh());
  }

  async function deleteVoidInvoice(invoice: InvoiceRecord) {
    if (invoice.status !== "Void") return;
    if (!window.confirm(`Permanently delete void invoice ${invoice.invoice_ref}? This is only for removing test/void invoices.`)) return;
    notify(null, null);
    setBusy(invoice.id);
    const response = await fetch(`/api/invoices/${invoice.id}`, { method: "DELETE" });
    const result = (await response.json().catch(() => null)) as { ok?: boolean; message?: string; error?: string } | null;
    setBusy(null);
    if (!response.ok || !result?.ok) {
      notify(null, result?.error || "Void invoice could not be deleted.");
      return;
    }
    notify(result.message || `${invoice.invoice_ref} deleted.`, null);
    startTransition(() => router.refresh());
  }

  async function regeneratePdf(invoice: InvoiceRecord) {
    notify(null, null);
    setBusy(invoice.id);
    const response = await fetch(`/api/invoices/${invoice.id}/pdf`, { method: "POST" });
    const result = (await response.json().catch(() => null)) as { ok?: boolean; message?: string; error?: string } | null;
    setBusy(null);
    if (!response.ok || !result?.ok) {
      notify(null, result?.error || "PDF could not be regenerated.");
      return;
    }
    notify(result.message || "PDF regenerated.", null);
    startTransition(() => router.refresh());
  }

  const hasDeposit = liveInvoices.some((invoice) => invoice.invoice_type === "deposit");
  const hasFinal = liveInvoices.some((invoice) => invoice.invoice_type === "final");

  return (
    <div className="stack">
      <PageSection kicker="Job Money" title="Financial summary" description="Quote value, invoicing progress, and costs for this job.">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
          <Stat label="Quote value" value={summary.quoteTotal ? currency(summary.quoteTotal) : "TBC"} hint="Inc VAT" />
          <Stat label="Invoiced" value={currency(summary.invoiced)} hint={`${liveInvoices.length} invoice${liveInvoices.length === 1 ? "" : "s"}`} />
          <Stat label="Paid" value={currency(summary.paid)} hint="Received to date" />
          <Stat label="Outstanding" value={currency(summary.outstanding)} hint="Awaiting payment" />
          <Stat label="Expenses" value={currency(summary.expensesGross)} hint={`${expenses.length} logged`} />
          <Stat
            label="Est. profit"
            value={summary.profit === null ? "TBC" : currency(summary.profit)}
            hint="Quote net − costs net"
          />
        </div>
      </PageSection>

      <PageSection
        kicker="Invoicing"
        title="Raise & track invoices"
        description="Deposit up front, progress payments as the job moves, final balance on completion — or one full invoice. Record payments as they land."
      >
        {!quote ? (
          <p className="text-sm text-[#ffcf7d]">Create a quote first — invoices are raised from the approved quote.</p>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => setShowDepositForm((current) => !current)} disabled={hasDeposit || busy !== null}>
              {hasDeposit ? "Deposit Raised ✓" : "Raise Deposit Invoice"}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setShowInterimForm((current) => !current)} disabled={busy !== null}>
              Raise Custom Invoice
            </Button>
            <Button variant="secondary" size="sm" onClick={() => createInvoice("final")} disabled={hasFinal || busy !== null}>
              {busy === "create-final" ? "Creating..." : hasFinal ? "Final Raised ✓" : "Raise Final Balance"}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => createInvoice("standard")} disabled={busy !== null}>
              {busy === "create-standard" ? "Creating..." : "Full Invoice"}
            </Button>
          </div>
        )}

        {showDepositForm && quote ? (
          <div className="mt-3 rounded-xl border border-[var(--border)] p-4">
            <p className="text-sm font-semibold text-[var(--text)]">Deposit amount</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {["25", "30", "50"].map((pct) => (
                <button
                  key={pct}
                  className={`rounded-lg border px-3 py-2 text-sm ${
                    depositPct === pct ? "border-[var(--gold)] text-[var(--gold)]" : "border-[var(--border)] text-[var(--text-muted)]"
                  }`}
                  onClick={() => setDepositPct(pct)}
                  type="button"
                >
                  {pct}%
                </button>
              ))}
              <input
                className="field w-20 min-h-11 text-center"
                inputMode="numeric"
                onChange={(event) => setDepositPct(event.target.value)}
                value={depositPct}
              />
              <span className="text-sm text-[var(--text-muted)]">
                = {currency((invoiceableQuoteTotal * (Number(depositPct) || 0)) / 100)}
              </span>
            </div>
            <div className="mt-3 flex gap-2">
              <Button
                variant="primary"
                size="sm"
                onClick={() => createInvoice("deposit", Number(depositPct))}
                disabled={busy !== null || !(Number(depositPct) > 0 && Number(depositPct) < 100)}
              >
                {busy === "create-deposit" ? "Creating..." : `Create ${depositPct}% Deposit Invoice`}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setShowDepositForm(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : null}

        {showInterimForm && quote ? (
          <div className="mt-3 rounded-xl border border-[var(--border)] p-4">
            <p className="text-sm font-semibold text-[var(--text)]">Custom invoice</p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Raise a one-off payment at any point in the job — scaffold up, materials landed, a stage of work complete. Raise as many of
              these as the job needs.
            </p>

            <label className="mt-3 block">
              <span className="label">What's this for?</span>
              <input
                className="field min-h-11"
                onChange={(event) => setInterimDescription(event.target.value)}
                placeholder="e.g. Scaffolding up — stage payment"
                type="text"
                value={interimDescription}
              />
            </label>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <div className="flex overflow-hidden rounded-lg border border-[var(--border)]">
                <button
                  className={`px-3 py-2 text-sm ${interimMode === "fixed" ? "bg-[var(--gold)] text-black" : "text-[var(--text-muted)]"}`}
                  onClick={() => setInterimMode("fixed")}
                  type="button"
                >
                  £ Amount
                </button>
                <button
                  className={`px-3 py-2 text-sm ${interimMode === "percentage" ? "bg-[var(--gold)] text-black" : "text-[var(--text-muted)]"}`}
                  onClick={() => setInterimMode("percentage")}
                  type="button"
                >
                  % of quote
                </button>
              </div>
              <input
                className="field w-28 min-h-11 text-center"
                inputMode="decimal"
                onChange={(event) => setInterimValue(event.target.value)}
                placeholder={interimMode === "fixed" ? "0.00" : "0"}
                value={interimValue}
              />
              {interimMode === "percentage" ? (
                <span className="text-sm text-[var(--text-muted)]">
                  = {currency((invoiceableQuoteTotal * (Number(interimValue) || 0)) / 100)}
                </span>
              ) : null}
            </div>

            <div className="mt-3 flex gap-2">
              <Button
                variant="primary"
                size="sm"
                onClick={createInterimInvoice}
                disabled={busy !== null || !(Number(interimValue) > 0)}
              >
                {busy === "create-interim" ? "Creating..." : "Create Invoice"}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setShowInterimForm(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : null}

        <div className="mt-4 space-y-3">
          {invoices.length === 0 ? <p className="text-sm text-[var(--text-muted)]">No invoices raised yet.</p> : null}
          {invoices.map((invoice) => (
            <div className="rounded-2xl border border-[var(--border)] p-3" key={invoice.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-[var(--text)]">{invoice.invoice_ref}</p>
                    <Badge size="sm">{INVOICE_TYPE_LABELS[invoice.invoice_type ?? "standard"]}</Badge>
                    <Badge size="sm" variant={invoice.status === "Paid" ? "complete" : invoice.status === "Overdue" ? "alert" : invoice.status === "Part Paid" ? "active" : "pending"}>
                      {invoice.status}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-[var(--text-muted)]">
                    Due {formatDate(invoice.due_date)} · Paid {currency(invoice.amount_paid ?? 0)} · Balance {currency(invoice.balance_due ?? 0)}
                  </p>
                </div>
                <p className="text-right font-display text-2xl text-[var(--gold-l)]">{currency(invoice.total ?? 0)}</p>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/jobs/${jobId}/invoice/${invoice.id}/preview` as Route}>Preview</Link>
                </Button>
                {invoice.pdf_url ? (
                  <Button variant="ghost" size="sm" asChild>
                    <a href={getInvoicePdfHref(invoice.id)} rel="noreferrer" target="_blank">
                      PDF
                    </a>
                  </Button>
                ) : null}
                {invoice.status !== "Void" ? (
                  <Button variant="ghost" size="sm" onClick={() => regeneratePdf(invoice)} disabled={busy !== null}>
                    {busy === invoice.id ? "..." : "Regenerate PDF"}
                  </Button>
                ) : null}
                {invoice.status !== "Paid" && invoice.status !== "Void" ? (
                  <>
                    <Button variant="secondary" size="sm" onClick={() => setSendInvoice(invoice)} disabled={busy !== null}>
                      {invoice.status === "Sent" || invoice.status === "Part Paid" || invoice.status === "Overdue" ? "Resend" : "Send"}
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => setPaymentInvoice(invoice)} disabled={busy !== null}>
                      Record Payment
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => voidInvoice(invoice)} disabled={busy !== null}>
                      Void
                    </Button>
                  </>
                ) : null}
                {invoice.status === "Void" ? (
                  <Button variant="ghost" size="sm" onClick={() => deleteVoidInvoice(invoice)} disabled={busy !== null}>
                    {busy === invoice.id ? "Deleting..." : "Delete Void Invoice"}
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </PageSection>

      <ExpensesSection
        jobId={jobId}
        expenses={expenses}
        onChange={setExpenses}
        onNotify={notify}
      />

      {message ? <p className="text-sm text-[#7ce3a6]">{message}</p> : null}
      {error ? <p className="text-sm text-[#ff9a91]">{error}</p> : null}

      {sendInvoice ? (
        <SendInvoiceModal
          customerEmail={customerEmail}
          customerName={customerName}
          invoiceId={sendInvoice.id}
          invoiceRef={sendInvoice.invoice_ref}
          jobTitle={jobTitle}
          onClose={() => setSendInvoice(null)}
          onSent={(nextMessage) => {
            setSendInvoice(null);
            notify(nextMessage, null);
            startTransition(() => router.refresh());
          }}
          total={Number(sendInvoice.total ?? 0)}
        />
      ) : null}

      {paymentInvoice ? (
        <RecordPaymentModal
          invoice={paymentInvoice}
          onClose={() => setPaymentInvoice(null)}
          onRecorded={(nextMessage) => {
            setPaymentInvoice(null);
            notify(nextMessage, null);
            startTransition(() => router.refresh());
          }}
        />
      ) : null}
    </div>
  );
}

function calculateFirmQuoteTotal(quote: QuoteRecord) {
  const firmLines = getFirmQuoteLines(quote.cost_breakdown);
  const subtotal = firmLines.reduce((sum, line) => sum + Number(line.cost ?? 0), 0);
  const vat = firmLines.filter((line) => line.vat_applicable).reduce((sum, line) => sum + Number(line.cost ?? 0) * 0.2, 0);
  return Math.round((subtotal + vat) * 100) / 100;
}

/* -----------------  Record payment modal  ----------------- */

function RecordPaymentModal({
  invoice,
  onClose,
  onRecorded
}: {
  invoice: InvoiceRecord;
  onClose: () => void;
  onRecorded: (message: string) => void;
}) {
  const [amount, setAmount] = useState(String(invoice.balance_due ?? invoice.total ?? 0));
  const [method, setMethod] = useState("Bank Transfer");
  const [reference, setReference] = useState("");
  const [paidDate, setPaidDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    setSaving(true);
    const response = await fetch(`/api/invoices/${invoice.id}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: Number(amount),
        payment_method: method,
        payment_reference: reference || undefined,
        paid_at: paidDate || undefined
      })
    });
    const result = (await response.json().catch(() => null)) as { ok?: boolean; message?: string; error?: string } | null;
    setSaving(false);
    if (!response.ok || !result?.ok) {
      setError(result?.error || "Payment could not be recorded.");
      return;
    }
    onRecorded(result.message || "Payment recorded.");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose} role="dialog">
      <div className="card w-full max-w-md p-5" onClick={(event) => event.stopPropagation()}>
        <p className="section-kicker text-[0.65rem] uppercase">Record Payment</p>
        <p className="mt-1 font-semibold text-[var(--text)]">
          {invoice.invoice_ref} · Balance {currency(invoice.balance_due ?? 0)}
        </p>
        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="label">Amount (£)</span>
            <input className="field min-h-11" inputMode="decimal" onChange={(event) => setAmount(event.target.value)} type="number" step="0.01" min="0" value={amount} />
          </label>
          <label className="block">
            <span className="label">Method</span>
            <select className="field min-h-11" onChange={(event) => setMethod(event.target.value)} value={method}>
              {PAYMENT_METHODS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="label">Reference (optional)</span>
            <input className="field min-h-11" onChange={(event) => setReference(event.target.value)} placeholder="e.g. bank ref" value={reference} />
          </label>
          <label className="block">
            <span className="label">Date received</span>
            <input className="field min-h-11" onChange={(event) => setPaidDate(event.target.value)} type="date" value={paidDate} />
          </label>
        </div>
        {error ? <p className="mt-3 text-sm text-[#ff9a91]">{error}</p> : null}
        <div className="mt-4 flex gap-2">
          <Button variant="primary" size="sm" onClick={save} disabled={saving || !(Number(amount) > 0)}>
            {saving ? "Saving..." : "Record Payment"}
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

/* -----------------  Expenses  ----------------- */

type ExpenseFormState = {
  id: string | null;
  category: JobExpenseCategory;
  description: string;
  supplier_name: string;
  amount: string;
  vat_amount: string;
  expense_date: string;
  notes: string;
};

function emptyExpenseForm(): ExpenseFormState {
  return {
    id: null,
    category: "materials",
    description: "",
    supplier_name: "",
    amount: "",
    vat_amount: "",
    expense_date: new Date().toISOString().slice(0, 10),
    notes: ""
  };
}

function ExpensesSection({
  jobId,
  expenses,
  onChange,
  onNotify
}: {
  jobId: string;
  expenses: JobExpense[];
  onChange: (expenses: JobExpense[]) => void;
  onNotify: (message: string | null, error: string | null) => void;
}) {
  const [form, setForm] = useState<ExpenseFormState>(emptyExpenseForm());
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const totals = useMemo(() => {
    const byCategory = new Map<string, number>();
    let gross = 0;
    for (const expense of expenses) {
      gross += Number(expense.amount ?? 0);
      const label = EXPENSE_CATEGORIES.find((category) => category.value === expense.category)?.label ?? "Other";
      byCategory.set(label, (byCategory.get(label) ?? 0) + Number(expense.amount ?? 0));
    }
    return { gross, byCategory: [...byCategory.entries()].sort((a, b) => b[1] - a[1]) };
  }, [expenses]);

  function startEdit(expense: JobExpense) {
    setForm({
      id: expense.id,
      category: expense.category,
      description: expense.description,
      supplier_name: expense.supplier_name ?? "",
      amount: String(expense.amount ?? ""),
      vat_amount: expense.vat_amount ? String(expense.vat_amount) : "",
      expense_date: expense.expense_date,
      notes: expense.notes ?? ""
    });
    setShowForm(true);
  }

  async function save() {
    onNotify(null, null);
    setSaving(true);
    const payload = {
      expense_id: form.id ?? undefined,
      category: form.category,
      description: form.description,
      supplier_name: form.supplier_name || undefined,
      amount: Number(form.amount),
      vat_amount: form.vat_amount ? Number(form.vat_amount) : 0,
      expense_date: form.expense_date,
      notes: form.notes || undefined
    };
    const response = await fetch(`/api/jobs/${jobId}/expenses`, {
      method: form.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = (await response.json().catch(() => null)) as { ok?: boolean; expense?: JobExpense; error?: string } | null;
    setSaving(false);
    if (!response.ok || !result?.ok || !result.expense) {
      onNotify(null, result?.error || "Expense could not be saved.");
      return;
    }
    const saved = result.expense;
    onChange(form.id ? expenses.map((expense) => (expense.id === saved.id ? saved : expense)) : [saved, ...expenses]);
    onNotify(form.id ? "Expense updated." : "Expense added.", null);
    setForm(emptyExpenseForm());
    setShowForm(false);
  }

  async function remove(expense: JobExpense) {
    if (!window.confirm(`Delete "${expense.description}" (${currency(expense.amount)})?`)) return;
    onNotify(null, null);
    setDeletingId(expense.id);
    const response = await fetch(`/api/jobs/${jobId}/expenses`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expense_id: expense.id })
    });
    const result = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
    setDeletingId(null);
    if (!response.ok || !result?.ok) {
      onNotify(null, result?.error || "Expense could not be deleted.");
      return;
    }
    onChange(expenses.filter((item) => item.id !== expense.id));
    onNotify("Expense deleted.", null);
  }

  return (
    <PageSection
      kicker="Expenses"
      title="Job costs"
      description="Log materials, labour, hire, and other costs against this job to see the real margin."
      actions={
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            setForm(emptyExpenseForm());
            setShowForm((current) => !current);
          }}
        >
          {showForm && !form.id ? "Close" : "+ Add Expense"}
        </Button>
      }
    >
      {totals.byCategory.length > 0 ? (
        <div className="flex flex-wrap gap-2 text-xs text-[var(--text-muted)]">
          {totals.byCategory.map(([label, value]) => (
            <span className="rounded-full border border-[var(--border)] px-3 py-1" key={label}>
              {label}: {currency(value)}
            </span>
          ))}
          <span className="rounded-full border border-[var(--gold)] px-3 py-1 font-semibold text-[var(--gold)]">Total: {currency(totals.gross)}</span>
        </div>
      ) : null}

      {showForm ? (
        <div className="mt-4 rounded-xl border border-[var(--border)] p-4">
          <p className="text-sm font-semibold text-[var(--text)]">{form.id ? "Edit expense" : "New expense"}</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="label">Date</span>
              <input className="field min-h-11" onChange={(event) => setForm({ ...form, expense_date: event.target.value })} type="date" value={form.expense_date} />
            </label>
            <label className="block">
              <span className="label">Category</span>
              <select className="field min-h-11" onChange={(event) => setForm({ ...form, category: event.target.value as JobExpenseCategory })} value={form.category}>
                {EXPENSE_CATEGORIES.map((category) => (
                  <option key={category.value} value={category.value}>
                    {category.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block sm:col-span-2">
              <span className="label">Description</span>
              <input
                className="field min-h-11"
                onChange={(event) => setForm({ ...form, description: event.target.value })}
                placeholder="e.g. Welsh slate x 300"
                value={form.description}
              />
            </label>
            <label className="block">
              <span className="label">Supplier (optional)</span>
              <input
                className="field min-h-11"
                onChange={(event) => setForm({ ...form, supplier_name: event.target.value })}
                placeholder="e.g. SIG Roofing"
                value={form.supplier_name}
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="label">Amount inc VAT (£)</span>
                <input className="field min-h-11" inputMode="decimal" onChange={(event) => setForm({ ...form, amount: event.target.value })} type="number" step="0.01" min="0" value={form.amount} />
              </label>
              <label className="block">
                <span className="label">of which VAT (£)</span>
                <input className="field min-h-11" inputMode="decimal" onChange={(event) => setForm({ ...form, vat_amount: event.target.value })} type="number" step="0.01" min="0" value={form.vat_amount} />
              </label>
            </div>
            <label className="block sm:col-span-2">
              <span className="label">Notes (optional)</span>
              <input className="field min-h-11" onChange={(event) => setForm({ ...form, notes: event.target.value })} value={form.notes} />
            </label>
          </div>
          <div className="mt-3 flex gap-2">
            <Button variant="primary" size="sm" onClick={save} disabled={saving || !form.description.trim() || !(Number(form.amount) > 0)}>
              {saving ? "Saving..." : form.id ? "Save Changes" : "Add Expense"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setForm(emptyExpenseForm());
                setShowForm(false);
              }}
              disabled={saving}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      <div className="mt-4 space-y-2">
        {expenses.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">No expenses logged yet. Add the first one to start tracking the job margin.</p>
        ) : null}
        {expenses.map((expense) => (
          <div className="flex flex-col gap-2 rounded-lg border border-[var(--border)] p-3 sm:flex-row sm:items-center sm:justify-between" key={`${expense.source}-${expense.id}`}>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[var(--text)]">{expense.description}</p>
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                {formatDate(expense.expense_date)} · {EXPENSE_CATEGORIES.find((category) => category.value === expense.category)?.label ?? "Other"}
                {expense.supplier_name ? ` · ${expense.supplier_name}` : ""}
                {expense.source === "diary" ? " · From diary" : ""}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <p className="font-display text-lg text-[var(--text)]">{currency(expense.amount)}</p>
              {expense.source !== "diary" ? (
                <>
                  <Button variant="ghost" size="sm" onClick={() => startEdit(expense)}>
                    Edit
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => remove(expense)} disabled={deletingId === expense.id}>
                    {deletingId === expense.id ? "..." : "Delete"}
                  </Button>
                </>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </PageSection>
  );
}
