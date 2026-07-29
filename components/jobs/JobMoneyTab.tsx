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
import type { InvoiceRecord, InvoiceType, JobDocumentRecord, JobExpense, JobExpenseCategory, MaterialRecord, QuoteRecord } from "@/lib/types";

type Props = {
  jobId: string;
  jobTitle: string;
  quote: QuoteRecord | null;
  invoices: InvoiceRecord[];
  expenses: JobExpense[];
  materials: MaterialRecord[];
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

const DEFAULT_VAT_RATE = 0.2;

function getMaterialEstimatedNet(material: MaterialRecord) {
  const quantity = Number(material.quantity ?? 0);
  const totalCost = material.total_cost == null ? null : Number(material.total_cost);
  if (totalCost !== null && Number.isFinite(totalCost)) return totalCost;
  const unitCost = material.unit_cost == null ? null : Number(material.unit_cost);
  if (unitCost !== null && Number.isFinite(unitCost)) return quantity * unitCost;
  const estimatedPrice = material.estimated_price == null ? null : Number(material.estimated_price);
  return estimatedPrice !== null && Number.isFinite(estimatedPrice) ? estimatedPrice : 0;
}

function getMaterialEstimatedVat(material: MaterialRecord) {
  if (material.vat_applicable === false) return 0;
  return getMaterialEstimatedNet(material) * DEFAULT_VAT_RATE;
}

function getMaterialActualGross(material: MaterialRecord) {
  const actual = material.actual_price == null ? null : Number(material.actual_price);
  return actual !== null && Number.isFinite(actual) ? actual : 0;
}

function getMaterialActualVat(material: MaterialRecord) {
  const vat = material.actual_vat_amount == null ? null : Number(material.actual_vat_amount);
  return vat !== null && Number.isFinite(vat) ? vat : 0;
}

function getMaterialProfitCostNet(material: MaterialRecord) {
  const actualGross = getMaterialActualGross(material);
  if (actualGross > 0) return Math.max(0, actualGross - getMaterialActualVat(material));
  return getMaterialEstimatedNet(material);
}

function formatExpenseCostBreakdown(expense: JobExpense) {
  const gross = Number(expense.amount ?? 0);
  const vat = Number(expense.vat_amount ?? 0);
  const net = Math.max(0, gross - vat);
  const parts = [`Net ${currency(net)}`, `VAT ${currency(vat)}`, `Gross ${currency(gross)}`];
  const cis = Number(expense.cis_deduction ?? 0);
  if (cis > 0) parts.push(`CIS held ${currency(cis)}`);
  return parts.join(" | ");
}

function formatReceiptFileSize(size: number) {
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

export function JobMoneyTab({ jobId, jobTitle, quote, invoices, expenses: initialExpenses, materials, customerName, customerEmail }: Props) {
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
    const expensesVat = expenses.reduce((sum, expense) => sum + Number(expense.vat_amount ?? 0), 0);
    const expensesNet = expensesGross - expensesVat;
    const nonMaterialExpensesGross = expenses.reduce((sum, expense) => {
      if (expense.category === "materials") return sum;
      return sum + Number(expense.amount ?? 0);
    }, 0);
    const nonMaterialExpensesVat = expenses.reduce((sum, expense) => {
      if (expense.category === "materials") return sum;
      return sum + Number(expense.vat_amount ?? 0);
    }, 0);
    const nonMaterialExpensesNet = expenses.reduce((sum, expense) => {
      if (expense.category === "materials") return sum;
      return sum + Number(expense.amount ?? 0) - Number(expense.vat_amount ?? 0);
    }, 0);
    const materialExpensesNet = expenses.reduce((sum, expense) => {
      if (expense.category !== "materials") return sum;
      return sum + Number(expense.amount ?? 0) - Number(expense.vat_amount ?? 0);
    }, 0);
    const cisDeductions = expenses.reduce((sum, expense) => sum + Number(expense.cis_deduction ?? 0), 0);
    const materialEstimatedNet = materials.reduce((sum, material) => sum + getMaterialEstimatedNet(material), 0);
    const materialEstimatedVat = materials.reduce((sum, material) => sum + getMaterialEstimatedVat(material), 0);
    const materialActualGross = materials.reduce((sum, material) => sum + getMaterialActualGross(material), 0);
    const materialActualVat = materials.reduce((sum, material) => sum + getMaterialActualVat(material), 0);
    const materialActualNet = materialActualGross - materialActualVat;
    const materialCostNet = materials.reduce((sum, material) => sum + getMaterialProfitCostNet(material), 0);
    const materialActualCount = materials.filter((material) => getMaterialActualGross(material) > 0).length;
    const materialEstimatedCount = materials.filter((material) => getMaterialEstimatedNet(material) > 0).length;
    const resolvedMaterialCostNet = materialCostNet > 0 ? materialCostNet : materialExpensesNet;
    const totalCostNet = nonMaterialExpensesNet + resolvedMaterialCostNet;
    const profit = quoteNet > 0 ? quoteNet - totalCostNet : null;
    return {
      quoteTotal,
      quoteNet,
      invoiced,
      paid,
      outstanding,
      expensesGross,
      expensesVat,
      expensesNet,
      nonMaterialExpensesGross,
      nonMaterialExpensesVat,
      nonMaterialExpensesNet,
      cisDeductions,
      materialEstimatedNet,
      materialEstimatedVat,
      materialActualGross,
      materialActualVat,
      materialActualNet,
      materialCostNet,
      materialActualCount,
      materialEstimatedCount,
      resolvedMaterialCostNet,
      totalCostNet,
      profit
    };
  }, [quote, liveInvoices, expenses, materials]);

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
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Quote value" value={summary.quoteTotal ? currency(summary.quoteTotal) : "TBC"} hint="Inc VAT" />
          <Stat label="Invoiced" value={currency(summary.invoiced)} hint={`${liveInvoices.length} invoice${liveInvoices.length === 1 ? "" : "s"}`} />
          <Stat label="Paid" value={currency(summary.paid)} hint="Received to date" />
          <Stat label="Outstanding" value={currency(summary.outstanding)} hint="Awaiting payment" />
          <Stat label="Materials est." value={currency(summary.materialEstimatedNet + summary.materialEstimatedVat)} hint={`${currency(summary.materialEstimatedNet)} net + VAT`} />
          <Stat
            label="Materials real"
            value={summary.materialActualGross > 0 ? currency(summary.materialActualGross) : "TBC"}
            hint={summary.materialActualCount > 0 ? `${currency(summary.materialActualNet)} net + VAT` : `${summary.materialEstimatedCount} estimated`}
          />
          <Stat label="Other expenses" value={currency(summary.nonMaterialExpensesGross)} hint={`${currency(summary.nonMaterialExpensesNet)} net, ${currency(summary.nonMaterialExpensesVat)} VAT`} />
          <Stat label="CIS held" value={currency(summary.cisDeductions)} hint="Labour/subcontractors" />
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
  cis_applicable: boolean;
  cis_rate: string;
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
    cis_applicable: false,
    cis_rate: "0.2",
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
  const [receiptFiles, setReceiptFiles] = useState<File[]>([]);

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
  const supportsCis = form.category === "labour" || form.category === "subcontractor";
  const formNet = Math.max(0, Number(form.amount || 0) - Number(form.vat_amount || 0));
  const cisPreview = supportsCis && form.cis_applicable ? formNet * Number(form.cis_rate || 0) : 0;
  const editingExpense = form.id ? expenses.find((expense) => expense.id === form.id) : null;
  const existingReceipts = editingExpense?.receipt_documents ?? [];

  function stageReceiptFiles(files: FileList | null) {
    if (!files?.length) return;
    const selectedFiles = Array.from(files);
    const acceptedFiles = selectedFiles.filter(
      (file) => (file.type.startsWith("image/") || file.type === "application/pdf") && file.size <= 15 * 1024 * 1024
    );
    if (acceptedFiles.length !== selectedFiles.length) {
      onNotify(null, "Only images or PDFs up to 15MB can be attached as receipts.");
    }
    setReceiptFiles((current) => [...current, ...acceptedFiles]);
  }

  function startEdit(expense: JobExpense) {
    setForm({
      id: expense.id,
      category: expense.category,
      description: expense.description,
      supplier_name: expense.supplier_name ?? "",
      amount: String(expense.amount ?? ""),
      vat_amount: expense.vat_amount ? String(expense.vat_amount) : "",
      cis_applicable: Boolean(expense.cis_applicable),
      cis_rate: String(expense.cis_rate ?? 0.2),
      expense_date: expense.expense_date,
      notes: expense.notes ?? ""
    });
    setReceiptFiles([]);
    setShowForm(true);
  }

  async function uploadReceiptDocuments(expenseId: string, files: File[]) {
    const results = await Promise.allSettled(
      files.map(async (file) => {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("expense_id", expenseId);
        formData.append("document_type", "expense_receipt");
        formData.append("display_name", file.name);

        const response = await fetch(`/api/jobs/${jobId}/documents`, {
          method: "POST",
          body: formData
        });
        const result = (await response.json().catch(() => null)) as { ok?: boolean; error?: string; document?: JobDocumentRecord } | null;
        if (!response.ok || !result?.ok || !result.document) {
          throw new Error(result?.error || `Upload failed for ${file.name}`);
        }
        return { file, document: result.document };
      })
    );

    const uploaded: JobDocumentRecord[] = [];
    const failed: File[] = [];
    const errors: string[] = [];

    results.forEach((result, index) => {
      if (result.status === "fulfilled") {
        uploaded.push(result.value.document);
        return;
      }
      failed.push(files[index]);
      errors.push(result.reason instanceof Error ? result.reason.message : `Upload failed for ${files[index].name}`);
    });

    return { uploaded, failed, errors };
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
      cis_applicable: form.cis_applicable,
      cis_rate: Number(form.cis_rate || 0),
      expense_date: form.expense_date,
      notes: form.notes || undefined
    };
    const response = await fetch(`/api/jobs/${jobId}/expenses`, {
      method: form.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = (await response.json().catch(() => null)) as { ok?: boolean; expense?: JobExpense; error?: string } | null;
    if (!response.ok || !result?.ok || !result.expense) {
      setSaving(false);
      onNotify(null, result?.error || "Expense could not be saved.");
      return;
    }

    let saved = result.expense;
    if (receiptFiles.length > 0) {
      const uploadResult = await uploadReceiptDocuments(saved.id, receiptFiles);
      saved = {
        ...saved,
        receipt_url: saved.receipt_url || (uploadResult.uploaded[0] ? `/api/documents/${uploadResult.uploaded[0].id}` : null),
        receipt_documents: [...(editingExpense?.receipt_documents ?? []), ...uploadResult.uploaded]
      };
      setReceiptFiles(uploadResult.failed);

      if (uploadResult.failed.length > 0) {
        setSaving(false);
        setForm({ ...form, id: saved.id });
        onChange(form.id ? expenses.map((expense) => (expense.id === saved.id ? saved : expense)) : [saved, ...expenses]);
        onNotify(
          uploadResult.uploaded.length > 0 ? `${uploadResult.uploaded.length} receipt${uploadResult.uploaded.length === 1 ? "" : "s"} saved.` : null,
          `${uploadResult.failed.length} receipt${uploadResult.failed.length === 1 ? "" : "s"} failed. Check the files and press Save Changes to retry.`
        );
        return;
      }
    }

    setSaving(false);
    onChange(form.id ? expenses.map((expense) => (expense.id === saved.id ? saved : expense)) : [saved, ...expenses]);
    const receiptMessage = receiptFiles.length > 0 ? ` ${receiptFiles.length} receipt${receiptFiles.length === 1 ? "" : "s"} filed against the job.` : "";
    onNotify(`${form.id ? "Expense updated." : "Expense added."}${receiptMessage}`, null);
    setForm(emptyExpenseForm());
    setReceiptFiles([]);
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
        <div className="flex flex-wrap gap-2">
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setForm(emptyExpenseForm());
              setReceiptFiles([]);
              setShowForm(true);
            }}
          >
            + Add Receipt
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setForm(emptyExpenseForm());
              setReceiptFiles([]);
              setShowForm((current) => !current);
            }}
          >
            {showForm && !form.id ? "Close" : "+ Add Expense"}
          </Button>
        </div>
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
            <div className="rounded-xl border border-[var(--border)] bg-black/10 p-3 sm:col-span-2">
              <div>
                <p className="text-sm font-semibold text-[var(--text)]">Receipt or supplier invoice</p>
                <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
                  Take a clear photo or attach an image/PDF. Files are stored privately in this job's Documents tab.
                </p>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <label className="button-primary min-h-11 cursor-pointer text-center">
                  Take Photo
                  <input
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(event) => {
                      stageReceiptFiles(event.currentTarget.files);
                      event.currentTarget.value = "";
                    }}
                    type="file"
                  />
                </label>
                <label className="button-secondary min-h-11 cursor-pointer text-center">
                  Choose Image / PDF
                  <input
                    accept="image/*,.pdf,application/pdf"
                    className="hidden"
                    multiple
                    onChange={(event) => {
                      stageReceiptFiles(event.currentTarget.files);
                      event.currentTarget.value = "";
                    }}
                    type="file"
                  />
                </label>
              </div>

              {existingReceipts.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {existingReceipts.map((document, index) => (
                    <a
                      className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-semibold text-[var(--gold)]"
                      href={`/api/documents/${document.id}`}
                      key={document.id}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Open receipt {index + 1}
                    </a>
                  ))}
                </div>
              ) : null}

              {receiptFiles.length > 0 ? (
                <div className="mt-3 space-y-2">
                  {receiptFiles.map((file, index) => (
                    <div className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-black/10 px-3 py-2" key={`${file.name}-${file.size}-${index}`}>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-[var(--text)]">{file.name}</p>
                        <p className="text-[0.68rem] text-[var(--text-muted)]">{formatReceiptFileSize(file.size)} | Ready to upload</p>
                      </div>
                      <button
                        aria-label={`Remove ${file.name}`}
                        className="min-h-11 shrink-0 rounded-lg px-3 text-xs font-semibold text-[#ff9a91]"
                        onClick={() => setReceiptFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))}
                        type="button"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
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
            {supportsCis ? (
              <div className="rounded-xl border border-[var(--border)] bg-black/10 p-3 sm:col-span-2">
                <label className="flex items-start gap-3 text-sm text-[var(--text)]">
                  <input
                    checked={form.cis_applicable}
                    className="mt-1"
                    onChange={(event) => setForm({ ...form, cis_applicable: event.target.checked })}
                    type="checkbox"
                  />
                  <span>
                    <span className="font-semibold">Apply CIS deduction</span>
                    <span className="mt-1 block text-xs text-[var(--text-muted)]">
                      Used for subcontractor/labour payments. Deduction is calculated from net cost, before VAT.
                    </span>
                  </span>
                </label>
                {form.cis_applicable ? (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <label className="block">
                      <span className="label">CIS rate</span>
                      <select className="field min-h-11" onChange={(event) => setForm({ ...form, cis_rate: event.target.value })} value={form.cis_rate}>
                        <option value="0.2">20% registered</option>
                        <option value="0.3">30% unregistered</option>
                        <option value="0">0% gross payment</option>
                      </select>
                    </label>
                    <div className="rounded-lg border border-[var(--gold)]/25 bg-[var(--gold)]/10 px-3 py-2">
                      <p className="text-[0.62rem] font-bold uppercase tracking-[0.16em] text-[var(--gold)]">CIS deduction</p>
                      <p className="mt-1 font-display text-xl text-[var(--text)]">{currency(cisPreview)}</p>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
            <label className="block sm:col-span-2">
              <span className="label">Notes (optional)</span>
              <input className="field min-h-11" onChange={(event) => setForm({ ...form, notes: event.target.value })} value={form.notes} />
            </label>
          </div>
          <div className="mt-3 flex gap-2">
            <Button variant="primary" size="sm" onClick={save} disabled={saving || !form.description.trim() || !(Number(form.amount) > 0)}>
              {saving
                ? receiptFiles.length > 0
                  ? "Saving expense & receipts..."
                  : "Saving..."
                : receiptFiles.length > 0
                  ? form.id
                    ? "Save Changes & Receipts"
                    : "Save Expense & Receipts"
                  : form.id
                    ? "Save Changes"
                    : "Add Expense"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setForm(emptyExpenseForm());
                setReceiptFiles([]);
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
              <p className="mt-1 text-xs text-[var(--text-muted)]">{formatExpenseCostBreakdown(expense)}</p>
              {expense.receipt_documents?.length ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {expense.receipt_documents.map((document, index) => (
                    <a
                      className="inline-flex min-h-11 items-center rounded-lg border border-[var(--gold)]/35 px-3 text-xs font-semibold text-[var(--gold)]"
                      href={`/api/documents/${document.id}`}
                      key={document.id}
                      rel="noreferrer"
                      target="_blank"
                    >
                      View receipt {expense.receipt_documents!.length > 1 ? index + 1 : ""}
                    </a>
                  ))}
                </div>
              ) : expense.receipt_url ? (
                <a
                  className="mt-2 inline-flex min-h-11 items-center rounded-lg border border-[var(--gold)]/35 px-3 text-xs font-semibold text-[var(--gold)]"
                  href={expense.receipt_url}
                  rel="noreferrer"
                  target="_blank"
                >
                  View receipt
                </a>
              ) : null}
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
                    Edit / Add Receipt
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
