"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, PageSection } from "@/components/ui/primitives";
import type { JobVariationRecord } from "@/lib/types";
import { currency, formatDate } from "@/lib/utils";

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
};

const newLine = (): DraftLine => ({
  id: crypto.randomUUID(),
  description: "",
  quantity: "1",
  unit: "item",
  unit_price: "",
  vat_applicable: false
});

export function JobVariationsSection({ jobId, customerName, customerEmail, variations }: Props) {
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

  async function sendForApproval(variation: JobVariationRecord) {
    if (!customerEmail) {
      setError("Add the customer's email address before sending this additional work.");
      return;
    }
    setBusy(`send-${variation.id}`);
    setError(null);
    const response = await fetch(`/api/variations/${variation.id}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to_email: customerEmail, customer_name: customerName })
    });
    const result = (await response.json().catch(() => null)) as { ok?: boolean; error?: string; message?: string } | null;
    setBusy(null);
    if (!response.ok || !result?.ok) {
      setError(result?.error || "Additional work could not be sent.");
      return;
    }
    refresh(result.message || "Sent for customer approval.");
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

  async function raiseInvoice(variation: JobVariationRecord) {
    setBusy(`invoice-${variation.id}`);
    setError(null);
    const response = await fetch(`/api/variations/${variation.id}/invoice`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ due_date: invoiceDueDate })
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
        {variations.map((variation) => (
          <div className="rounded-2xl border border-[var(--border)] p-4" key={variation.id}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-[var(--text)]">{variation.variation_ref}</p>
                  <Badge size="sm" variant={variation.status === "Accepted" || variation.status === "Invoiced" || variation.status === "Paid" ? "complete" : variation.status === "Declined" || variation.status === "Void" ? "alert" : "pending"}>{variation.status}</Badge>
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
            {variation.accepted_at ? <p className="mt-3 text-xs text-[var(--text-muted)]">Approved {formatDate(variation.accepted_at)} by {variation.approved_by_name || "customer"} ({variation.approval_method || "recorded"})</p> : null}
            <div className="mt-4 flex flex-wrap gap-2">
              {variation.status === "Draft" || variation.status === "Sent" ? (
                <Button disabled={busy !== null} onClick={() => sendForApproval(variation)} size="sm" variant="secondary">
                  {busy === `send-${variation.id}` ? "Sending..." : variation.status === "Sent" ? "Resend Approval" : "Send for Approval"}
                </Button>
              ) : null}
              {variation.status === "Draft" || variation.status === "Sent" ? (
                <Button disabled={busy !== null} onClick={() => recordApproval(variation)} size="sm" variant="ghost">Record Verbal Approval</Button>
              ) : null}
              {variation.status === "Accepted" ? (
                <Button disabled={busy !== null} onClick={() => setInvoiceVariationId(variation.id)} size="sm" variant="primary">Raise Variation Invoice</Button>
              ) : null}
            </div>
            {invoiceVariationId === variation.id ? (
              <div className="mt-4 flex flex-wrap items-end gap-3 rounded-xl border border-[var(--gold)]/30 bg-black/15 p-3">
                <label>
                  <span className="label">Payment due date</span>
                  <input className="field mt-2 min-h-11" onChange={(event) => setInvoiceDueDate(event.target.value)} type="date" value={invoiceDueDate} />
                </label>
                <Button disabled={busy !== null || !invoiceDueDate} onClick={() => raiseInvoice(variation)} size="sm" variant="primary">
                  {busy === `invoice-${variation.id}` ? "Creating..." : `Create ${currency(variation.total)} Invoice`}
                </Button>
                <Button onClick={() => setInvoiceVariationId(null)} size="sm" variant="ghost">Cancel</Button>
              </div>
            ) : null}
          </div>
        ))}
      </div>
      {message ? <p className="mt-4 text-sm text-[#7ce3a6]">{message}</p> : null}
      {error ? <p className="mt-4 text-sm text-[#ff9a91]">{error}</p> : null}
    </PageSection>
  );
}

function addDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}
