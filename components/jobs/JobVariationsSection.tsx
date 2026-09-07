"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, PageSection } from "@/components/ui/primitives";
import { SendVariationQuoteModal, type VariationEmailDraft } from "@/components/variations/SendVariationQuoteModal";
import type { InvoiceRecord, JobVariationRecord } from "@/lib/types";
import { currency, formatDate } from "@/lib/utils";
import { getVariationInvoiceProgress } from "@/lib/variations/invoicing";

type DraftLine = {
  id: string;
  description: string;
  quantity: string;
  unit: string;
  unit_price: string;
  vat_applicable: boolean;
};

type Props = {
  jobId: string;
  customerName: string;
  customerEmail?: string | null;
  variations: JobVariationRecord[];
  invoices: InvoiceRecord[];
};

type EmailTarget =
  | { type: "single"; variation: JobVariationRecord }
  | { type: "combined"; variationIds: string[]; total: number; reference: string; groupLeadId?: string };

const newLine = (): DraftLine => ({
  id: crypto.randomUUID(),
  description: "",
  quantity: "1",
  unit: "item",
  unit_price: "",
  vat_applicable: false
});

export function JobVariationsSection({ jobId, customerName, customerEmail, variations, invoices }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [approvalMode, setApprovalMode] = useState<"formal" | "verbal">("formal");
  const [approvedBy, setApprovedBy] = useState(customerName);
  const [lines, setLines] = useState<DraftLine[]>(() => [newLine()]);
  const [invoiceVariationId, setInvoiceVariationId] = useState<string | null>(null);
  const [invoiceDueDate, setInvoiceDueDate] = useState(addDays(7));
  const [invoiceAmountMode, setInvoiceAmountMode] = useState<"remaining" | "custom">("remaining");
  const [invoiceAmount, setInvoiceAmount] = useState("");
  const [selectedVariationIds, setSelectedVariationIds] = useState<string[]>([]);
  const [emailTarget, setEmailTarget] = useState<EmailTarget | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const draftSubtotal = lines.reduce((sum, line) => sum + (Number(line.quantity) || 0) * (Number(line.unit_price) || 0), 0);
  const draftVat = lines.reduce((sum, line) => sum + (line.vat_applicable ? (Number(line.quantity) || 0) * (Number(line.unit_price) || 0) * 0.2 : 0), 0);

  function refresh(nextMessage: string) {
    setMessage(nextMessage);
    setError(null);
    startTransition(() => router.refresh());
  }

  function updateLine(id: string, patch: Partial<DraftLine>) {
    setLines((current) => current.map((line) => (line.id === id ? { ...line, ...patch } : line)));
  }

  async function createVariation() {
    setBusy("create");
    setError(null);
    setMessage(null);
    const response = await fetch(`/api/jobs/${jobId}/variations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description,
        approval_mode: approvalMode,
        approved_by_name: approvalMode === "verbal" ? approvedBy : undefined,
        line_items: lines.map((line) => ({
          id: line.id,
          description: line.description,
          quantity: Number(line.quantity),
          unit: line.unit,
          unit_price: Number(line.unit_price),
          vat_applicable: line.vat_applicable
        }))
      })
    });
    const result = (await response.json().catch(() => null)) as { ok?: boolean; error?: string; message?: string } | null;
    setBusy(null);
    if (!response.ok || !result?.ok) {
      setError(result?.error || "Additional work could not be saved.");
      return;
    }
    setShowForm(false);
    setTitle("");
    setDescription("");
    setLines([newLine()]);
    refresh(result.message || "Additional work saved.");
  }

  async function sendForApproval(variation: JobVariationRecord, draft: VariationEmailDraft) {
    setBusy(`send-${variation.id}`);
    setError(null);
    try {
      const response = await fetch(`/api/variations/${variation.id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to_email: draft.toEmail,
          customer_name: customerName,
          email_customer_name: draft.greeting,
          subject: draft.subject,
          message: draft.message,
          copy: !["Draft", "Sent"].includes(variation.status)
        })
      });
      const result = (await response.json().catch(() => null)) as { ok?: boolean; error?: string; message?: string } | null;
      if (!response.ok || !result?.ok) {
        throw new Error(result?.error || "Additional work could not be sent.");
      }
      setEmailTarget(null);
      refresh(result.message || "Sent for customer approval.");
    } finally {
      setBusy(null);
    }
  }

  function toggleCombinedSelection(variationId: string) {
    setSelectedVariationIds((current) =>
      current.includes(variationId) ? current.filter((id) => id !== variationId) : [...current, variationId]
    );
  }

  async function sendCombinedQuote(variationIds: string[], groupLeadId: string | undefined, draft: VariationEmailDraft) {
    setBusy("send-combined");
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(groupLeadId ? `/api/variations/${groupLeadId}/send-group` : `/api/jobs/${jobId}/variations/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          variation_ids: variationIds,
          to_email: draft.toEmail,
          customer_name: customerName,
          email_customer_name: draft.greeting,
          subject: draft.subject,
          message: draft.message
        })
      });
      const result = (await response.json().catch(() => null)) as { ok?: boolean; error?: string; message?: string } | null;
      if (!response.ok || !result?.ok) {
        throw new Error(result?.error || "The combined additional-works quotation could not be sent.");
      }
      setSelectedVariationIds([]);
      setEmailTarget(null);
      refresh(result.message || "Combined additional-works quotation sent.");
    } finally {
      setBusy(null);
    }
  }

  async function recordApproval(variation: JobVariationRecord) {
    const name = window.prompt("Who approved this additional work?", customerName)?.trim();
    if (!name) return;
    setBusy(`approve-${variation.id}`);
    const response = await fetch(`/api/variations/${variation.id}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approved_by_name: name, approval_method: "verbal" })
    });
    const result = (await response.json().catch(() => null)) as { ok?: boolean; error?: string; message?: string } | null;
    setBusy(null);
    if (!response.ok || !result?.ok) {
      setError(result?.error || "Approval could not be recorded.");
      return;
    }
    refresh(result.message || "Approval recorded.");
  }

  async function deleteVariation(variation: JobVariationRecord, deleteGroup = false) {
    const reference = deleteGroup ? variation.approval_group_ref || variation.variation_ref : variation.variation_ref;
    const warning = deleteGroup
      ? `This permanently deletes the complete combined quotation ${reference} and every additional-work item in it. Type ${reference} to confirm.`
      : `This permanently deletes ${reference}. Any customer link for it will stop working. Type ${reference} to confirm.`;
    const confirmation = window.prompt(warning)?.trim();
    if (!confirmation) return;

    setBusy(`delete-${variation.id}`);
    setError(null);
    setMessage(null);
    const response = await fetch(`/api/variations/${variation.id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmation, delete_group: deleteGroup })
    });
    const result = (await response.json().catch(() => null)) as { ok?: boolean; error?: string; message?: string } | null;
    setBusy(null);
    if (!response.ok || !result?.ok) {
      setError(result?.error || "Additional work could not be deleted.");
      return;
    }
    setSelectedVariationIds((current) => current.filter((id) => id !== variation.id));
    refresh(result.message || "Additional work deleted.");
  }

  function openInvoiceForm(variation: JobVariationRecord) {
    const progress = getVariationInvoiceProgress(invoices, variation.id, variation.total);
    setInvoiceVariationId(variation.id);
    setInvoiceDueDate(addDays(7));
    setInvoiceAmountMode("remaining");
    setInvoiceAmount(progress.remaining.toFixed(2));
    setError(null);
  }

  async function raiseInvoice(variation: JobVariationRecord) {
    const progress = getVariationInvoiceProgress(invoices, variation.id, variation.total);
    const amount = invoiceAmountMode === "remaining" ? progress.remaining : Number(invoiceAmount);
    setBusy(`invoice-${variation.id}`);
    setError(null);
    const response = await fetch(`/api/variations/${variation.id}/invoice`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ due_date: invoiceDueDate, amount })
    });
    const result = (await response.json().catch(() => null)) as { ok?: boolean; error?: string; message?: string; warning?: string } | null;
    setBusy(null);
    if (!response.ok || !result?.ok) {
      setError(result?.error || "Variation invoice could not be created.");
      return;
    }
    setInvoiceVariationId(null);
    refresh([result.message, result.warning].filter(Boolean).join(" "));
  }

  return (
    <PageSection
      kicker="Additional Work"
      title="Variations & extras"
      description="Price work discovered after the original quote, record approval, and invoice it separately without changing the original contract."
    >
      <Button onClick={() => setShowForm((current) => !current)} size="sm" variant="secondary">
        {showForm ? "Close" : "+ Add Additional Work"}
      </Button>

      {variations.filter((variation) => variation.status === "Draft" && !variation.approval_group_id).length >= 2 ? (
        <div className="mt-4 rounded-2xl border border-[var(--gold)]/35 bg-[var(--gold)]/10 p-4">
          <p className="font-semibold text-[var(--text)]">Send several extras as one quotation</p>
          <p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">Tick the draft items below. The customer receives one email, one combined quote and one approval button.</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              disabled={busy !== null}
              onClick={() => setSelectedVariationIds(variations.filter((variation) => variation.status === "Draft" && !variation.approval_group_id).map((variation) => variation.id))}
              size="sm"
              variant="ghost"
            >
              Select all drafts
            </Button>
            {selectedVariationIds.length > 0 ? <Button disabled={busy !== null} onClick={() => setSelectedVariationIds([])} size="sm" variant="ghost">Clear</Button> : null}
            <Button
              disabled={busy !== null || selectedVariationIds.length < 2}
              onClick={() => {
                const selected = variations.filter((variation) => selectedVariationIds.includes(variation.id));
                setEmailTarget({
                  type: "combined",
                  variationIds: [...selectedVariationIds],
                  total: selected.reduce((sum, variation) => sum + Number(variation.total ?? 0), 0),
                  reference: "Combined additional-works quotation"
                });
              }}
              size="sm"
              variant="primary"
            >
              {`Prepare email for ${selectedVariationIds.length || "selected"} items`}
            </Button>
          </div>
        </div>
      ) : null}

      {showForm ? (
        <div className="mt-4 rounded-2xl border border-[var(--gold)]/30 bg-black/15 p-4 md:p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <label>
              <span className="label">Additional work title</span>
              <input className="field mt-2 min-h-11" onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Replace rotten valley boards" value={title} />
            </label>
            <label>
              <span className="label">Approval route</span>
              <select className="field mt-2 min-h-11" onChange={(event) => setApprovalMode(event.target.value as "formal" | "verbal")} value={approvalMode}>
                <option value="formal">Send for online approval</option>
                <option value="verbal">Already approved verbally</option>
              </select>
            </label>
          </div>
          <label className="mt-4 block">
            <span className="label">Why this work is needed / scope</span>
            <textarea className="field mt-2 min-h-24" onChange={(event) => setDescription(event.target.value)} placeholder="Explain what was found and exactly what is included." value={description} />
          </label>
          {approvalMode === "verbal" ? (
            <label className="mt-4 block">
              <span className="label">Approved by</span>
              <input className="field mt-2 min-h-11" onChange={(event) => setApprovedBy(event.target.value)} value={approvedBy} />
            </label>
          ) : null}

          <div className="mt-5 space-y-3">
            {lines.map((line, index) => (
              <div className="rounded-xl border border-[var(--border)] bg-black/15 p-3" key={line.id}>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-bold text-[var(--text)]">Line {index + 1}</p>
                  {lines.length > 1 ? <button className="text-xs font-bold text-[#ff9a91]" onClick={() => setLines((current) => current.filter((item) => item.id !== line.id))} type="button">Remove</button> : null}
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-[2fr_0.7fr_0.8fr_1fr_auto]">
                  <input className="field min-h-11" onChange={(event) => updateLine(line.id, { description: event.target.value })} placeholder="Description" value={line.description} />
                  <input className="field min-h-11" inputMode="decimal" onChange={(event) => updateLine(line.id, { quantity: event.target.value })} placeholder="Qty" value={line.quantity} />
                  <input className="field min-h-11" onChange={(event) => updateLine(line.id, { unit: event.target.value })} placeholder="Unit" value={line.unit} />
                  <input className="field min-h-11" inputMode="decimal" onChange={(event) => updateLine(line.id, { unit_price: event.target.value })} placeholder="Unit price £" value={line.unit_price} />
                  <label className="flex min-h-11 items-center gap-2 whitespace-nowrap rounded-lg border border-[var(--border)] px-3 text-sm text-[var(--text)]">
                    <input checked={line.vat_applicable} onChange={(event) => updateLine(line.id, { vat_applicable: event.target.checked })} type="checkbox" /> VAT
                  </label>
                </div>
              </div>
            ))}
          </div>
          <button className="mt-3 text-sm font-bold text-[var(--gold)]" onClick={() => setLines((current) => [...current, newLine()])} type="button">+ Add another priced line</button>

          <div className="mt-5 rounded-xl border border-[var(--border)] bg-black/20 p-4 text-sm text-[var(--text)]">
            <div className="flex justify-between"><span>Subtotal</span><strong>{currency(draftSubtotal)}</strong></div>
            <div className="mt-2 flex justify-between"><span>VAT</span><strong>{currency(draftVat)}</strong></div>
            <div className="mt-3 flex justify-between border-t border-[var(--border)] pt-3 text-base"><span>Total</span><strong className="text-[var(--gold)]">{currency(draftSubtotal + draftVat)}</strong></div>
          </div>
          <Button className="mt-4" disabled={busy !== null || !title.trim() || draftSubtotal <= 0} onClick={createVariation} size="sm" variant="primary">
            {busy === "create" ? "Saving..." : approvalMode === "verbal" ? "Save Approved Additional Work" : "Save Draft Additional Work"}
          </Button>
        </div>
      ) : null}

      <div className="mt-5 space-y-3">
        {variations.length === 0 ? <p className="text-sm text-[var(--text-muted)]">No additional work recorded yet.</p> : null}
        {variations.map((variation) => {
          const progress = getVariationInvoiceProgress(invoices, variation.id, variation.total);
          const allLinkedInvoices = invoices.filter((invoice) => invoice.variation_id === variation.id);
          const linkedInvoices = invoices.filter((invoice) => invoice.variation_id === variation.id && invoice.status !== "Void");
          const groupedVariations = variation.approval_group_id
            ? variations.filter((item) => item.approval_group_id === variation.approval_group_id)
            : [];
          const groupLead = [...groupedVariations].sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? ""))[0];
          const isGroupLead = Boolean(groupLead && groupLead.id === variation.id);
          const groupHasInvoices = groupedVariations.some((item) => invoices.some((invoice) => invoice.variation_id === item.id));
          const canDeleteSingle = !variation.approval_group_id && !["Invoiced", "Paid"].includes(variation.status) && allLinkedInvoices.length === 0;
          const canDeleteGroup = isGroupLead
            && !groupHasInvoices
            && groupedVariations.every((item) => !["Invoiced", "Paid"].includes(item.status));
          const canInvoice = ["Accepted", "Invoiced"].includes(variation.status) && progress.remaining > 0.01;
          const amountToCreate = invoiceAmountMode === "remaining" ? progress.remaining : Number(invoiceAmount || 0);
          return (
          <div className="rounded-2xl border border-[var(--border)] p-4" key={variation.id}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  {variation.status === "Draft" && !variation.approval_group_id ? (
                    <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-[var(--border)] px-3 text-sm font-semibold text-[var(--text)]">
                      <input
                        checked={selectedVariationIds.includes(variation.id)}
                        onChange={() => toggleCombinedSelection(variation.id)}
                        type="checkbox"
                      />
                      Include in combined quote
                    </label>
                  ) : null}
                  <p className="font-semibold text-[var(--text)]">{variation.variation_ref}</p>
                  <Badge size="sm" variant={variation.status === "Accepted" || variation.status === "Invoiced" || variation.status === "Paid" ? "complete" : variation.status === "Declined" || variation.status === "Void" ? "alert" : "pending"}>{variation.status}</Badge>
                  {variation.approval_group_ref ? <Badge size="sm" variant="active">Combined quote {variation.approval_group_ref}</Badge> : null}
                </div>
                <h3 className="mt-2 font-display text-2xl text-[var(--text)]">{variation.title}</h3>
                {variation.description ? <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-muted)]">{variation.description}</p> : null}
              </div>
              <div className="sm:text-right">
                <p className="font-display text-2xl text-[var(--gold-l)]">{currency(variation.total)}</p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">{currency(variation.subtotal)} net + {currency(variation.vat_amount)} VAT</p>
              </div>
            </div>
            <div className="mt-4 divide-y divide-[var(--border)] border-y border-[var(--border)]">
              {variation.line_items.map((line) => (
                <div className="flex justify-between gap-4 py-3 text-sm" key={line.id}>
                  <span className="text-[var(--text)]">{line.description} <span className="text-[var(--text-muted)]">({line.quantity} {line.unit}{line.vat_applicable ? ", + VAT" : ""})</span></span>
                  <strong className="shrink-0 text-[var(--text)]">{currency(line.total)}</strong>
                </div>
              ))}
            </div>
            {["Accepted", "Invoiced", "Paid"].includes(variation.status) ? (
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <VariationStat label="Approved" value={currency(variation.total)} />
                <VariationStat label="Invoiced" value={currency(progress.invoiced)} />
                <VariationStat label="Paid" value={currency(progress.paid)} />
                <VariationStat label="Left to invoice" value={currency(progress.remaining)} highlight={progress.remaining > 0.01} />
              </div>
            ) : null}
            {linkedInvoices.length > 0 ? (
              <p className="mt-3 text-xs leading-5 text-[var(--text-muted)]">
                Invoices on this job: {linkedInvoices.map((invoice) => `${invoice.invoice_ref} (${invoice.status}, ${currency(invoice.total)})`).join(" · ")}
              </p>
            ) : null}
            {variation.accepted_at ? <p className="mt-3 text-xs text-[var(--text-muted)]">Approved {formatDate(variation.accepted_at)} by {variation.approved_by_name || "customer"} ({variation.approval_method || "recorded"})</p> : null}
            <div className="mt-4 flex flex-wrap gap-2">
              {variation.status !== "Void" && !variation.approval_group_id ? (
                <Button disabled={busy !== null} onClick={() => setEmailTarget({ type: "single", variation })} size="sm" variant="secondary">
                  {variation.status === "Draft" ? "Prepare Quote Email" : variation.status === "Sent" ? "Edit & Resend Quote Email" : "Email Quote Copy"}
                </Button>
              ) : null}
              {isGroupLead ? (
                <Button
                  disabled={busy !== null}
                  onClick={() => setEmailTarget({
                    type: "combined",
                    variationIds: groupedVariations.map((item) => item.id),
                    total: groupedVariations.reduce((sum, item) => sum + Number(item.total ?? 0), 0),
                    reference: variation.approval_group_ref || "Combined additional-works quotation",
                    groupLeadId: variation.id
                  })}
                  size="sm"
                  variant="secondary"
                >
                  {variation.status === "Sent" ? "Edit & Resend Combined Quote Email" : "Email Combined Quote Copy"}
                </Button>
              ) : null}
              {(variation.status === "Draft" || variation.status === "Sent") && !variation.approval_group_id ? (
                <Button disabled={busy !== null} onClick={() => recordApproval(variation)} size="sm" variant="ghost">Record Verbal Approval</Button>
              ) : null}
              {canInvoice ? (
                <Button disabled={busy !== null} onClick={() => openInvoiceForm(variation)} size="sm" variant="primary">
                  {progress.invoiceCount > 0 ? "Raise Next Invoice" : "Raise Variation Invoice"}
                </Button>
              ) : null}
              {canDeleteSingle ? (
                <Button disabled={busy !== null} onClick={() => deleteVariation(variation)} size="sm" variant="ghost">
                  {busy === `delete-${variation.id}` ? "Deleting..." : "Delete Additional Work"}
                </Button>
              ) : null}
              {canDeleteGroup ? (
                <Button disabled={busy !== null} onClick={() => deleteVariation(variation, true)} size="sm" variant="ghost">
                  {busy === `delete-${variation.id}` ? "Deleting..." : "Delete Combined Quote"}
                </Button>
              ) : null}
              {progress.invoiceCount > 0 && progress.remaining <= 0.01 ? <Badge size="sm" variant="complete">Fully invoiced</Badge> : null}
            </div>
            {invoiceVariationId === variation.id ? (
              <div className="mt-4 grid gap-3 rounded-xl border border-[var(--gold)]/30 bg-black/15 p-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto_auto] lg:items-end">
                <label>
                  <span className="label">How much to invoice?</span>
                  <select className="field mt-2 min-h-11" onChange={(event) => setInvoiceAmountMode(event.target.value as "remaining" | "custom")} value={invoiceAmountMode}>
                    <option value="remaining">Full remaining balance ({currency(progress.remaining)})</option>
                    <option value="custom">A set amount</option>
                  </select>
                </label>
                {invoiceAmountMode === "custom" ? (
                  <label>
                    <span className="label">Invoice total including VAT</span>
                    <input className="field mt-2 min-h-11" inputMode="decimal" max={progress.remaining} min="0.01" onChange={(event) => setInvoiceAmount(event.target.value)} placeholder="0.00" step="0.01" type="number" value={invoiceAmount} />
                  </label>
                ) : (
                  <div className="rounded-lg border border-[var(--border)] px-3 py-2">
                    <span className="label">Invoice total</span>
                    <p className="mt-1 font-semibold text-[var(--text)]">{currency(progress.remaining)}</p>
                  </div>
                )}
                <label>
                  <span className="label">Payment due date</span>
                  <input className="field mt-2 min-h-11" onChange={(event) => setInvoiceDueDate(event.target.value)} type="date" value={invoiceDueDate} />
                </label>
                <div className="flex flex-wrap gap-2">
                  <Button disabled={busy !== null || !invoiceDueDate || amountToCreate <= 0 || amountToCreate > progress.remaining + 0.01} onClick={() => raiseInvoice(variation)} size="sm" variant="primary">
                    {busy === `invoice-${variation.id}` ? "Creating..." : `Create ${currency(amountToCreate)} Invoice`}
                  </Button>
                  <Button onClick={() => setInvoiceVariationId(null)} size="sm" variant="ghost">Cancel</Button>
                </div>
                {invoiceAmountMode === "custom" ? <p className="text-xs text-[var(--text-muted)] sm:col-span-2 lg:col-span-4">Enter the final invoice amount the customer will pay, including any VAT. Maximum available: {currency(progress.remaining)}.</p> : null}
              </div>
            ) : null}
          </div>
          );
        })}
      </div>
      {message ? <p className="mt-4 text-sm text-[#7ce3a6]">{message}</p> : null}
      {error ? <p className="mt-4 text-sm text-[#ff9a91]">{error}</p> : null}
      {emailTarget ? (
        <SendVariationQuoteModal
          customerEmail={customerEmail}
          customerName={customerName}
          isCopy={emailTarget.type === "single" ? !["Draft", "Sent"].includes(emailTarget.variation.status) : Boolean(emailTarget.groupLeadId && !variations.filter((item) => emailTarget.variationIds.includes(item.id)).every((item) => item.status === "Sent"))}
          itemCount={emailTarget.type === "single" ? 1 : emailTarget.variationIds.length}
          onClose={() => setEmailTarget(null)}
          onSend={(draft) => emailTarget.type === "single" ? sendForApproval(emailTarget.variation, draft) : sendCombinedQuote(emailTarget.variationIds, emailTarget.groupLeadId, draft)}
          reference={emailTarget.type === "single" ? emailTarget.variation.variation_ref : emailTarget.reference}
          total={emailTarget.type === "single" ? emailTarget.variation.total : emailTarget.total}
        />
      ) : null}
    </PageSection>
  );
}

function VariationStat({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-black/10 p-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">{label}</p>
      <p className={`mt-1 text-sm font-bold ${highlight ? "text-[var(--gold-l)]" : "text-[var(--text)]"}`}>{value}</p>
    </div>
  );
}

function addDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}
