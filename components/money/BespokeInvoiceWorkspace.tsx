"use client";

import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { SendInvoiceModal } from "@/components/invoices/SendInvoiceModal";
import type { Customer, InvoiceRecord, Job } from "@/lib/types";
import { currency } from "@/lib/utils";

type InvoiceListItem = InvoiceRecord & { customer?: Customer | null; linked_job?: Job | null };
type Props = { customers: Customer[]; jobs: Array<Job & { customer?: Customer | null }>; invoices: InvoiceListItem[]; vatRate: number };
type LineDraft = { description: string; quantity: string; unit: string; unit_price: string; vat_applicable: boolean };
const newLine = (): LineDraft => ({ description: "", quantity: "1", unit: "item", unit_price: "", vat_applicable: true });

export function BespokeInvoiceWorkspace({ customers, jobs, invoices, vatRate }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [jobId, setJobId] = useState("");
  const [issueDate, setIssueDate] = useState(today());
  const [dueDate, setDueDate] = useState(today());
  const [paymentTerms, setPaymentTerms] = useState("Payment due on receipt.");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([newLine()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [sending, setSending] = useState<InvoiceListItem | null>(null);

  const selectedCustomer = customers.find((customer) => customer.id === customerId) ?? null;
  const compatibleJobs = jobs.filter((job) => job.customer_id === customerId);
  const subtotal = useMemo(() => lines.reduce((sum, line) => sum + (Number(line.quantity) || 0) * (Number(line.unit_price) || 0), 0), [lines]);
  const vat = useMemo(() => lines.reduce((sum, line) => sum + (line.vat_applicable ? (Number(line.quantity) || 0) * (Number(line.unit_price) || 0) * vatRate / 100 : 0), 0), [lines, vatRate]);
  const total = round2(subtotal + vat);

  function updateLine(index: number, change: Partial<LineDraft>) {
    setLines((current) => current.map((line, lineIndex) => lineIndex === index ? { ...line, ...change } : line));
  }

  async function createDraft(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    if (!customerId) { setError("Choose a person or business to invoice."); return; }
    const validLines = lines.filter((line) => line.description.trim() && Number(line.quantity) > 0 && Number(line.unit_price) >= 0);
    if (!validLines.length) { setError("Add at least one item with a description and quantity."); return; }
    setSaving(true);
    const response = await fetch("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customer_id: customerId,
        job_id: jobId || null,
        issue_date: issueDate,
        due_date: dueDate,
        payment_terms: paymentTerms,
        notes,
        line_items: validLines.map((line) => ({ ...line, quantity: Number(line.quantity), unit_price: Number(line.unit_price) }))
      })
    });
    const result = await response.json().catch(() => null) as { ok?: boolean; error?: string; message?: string; warning?: string } | null;
    setSaving(false);
    if (!response.ok || !result?.ok) { setError(result?.error || "The invoice draft could not be saved."); return; }
    setNotice([result.message, result.warning].filter(Boolean).join(" "));
    setOpen(false);
    setCustomerId(""); setJobId(""); setIssueDate(today()); setDueDate(today()); setNotes(""); setLines([newLine()]);
    router.refresh();
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <div>
          <h2 className="font-semibold text-[var(--text)]">Bespoke invoices</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">Create a simple itemised invoice for any person or business. Linking a job is optional.</p>
        </div>
        <button className="button-primary" onClick={() => { setOpen((value) => !value); setError(null); }} type="button">{open ? "Close" : "＋ Create bespoke invoice"}</button>
      </div>

      {notice ? <p className="rounded-lg border border-green-700/30 bg-green-900/10 p-3 text-sm text-green-700">{notice}</p> : null}
      {error && !open ? <p className="rounded-lg border border-red-700/30 bg-red-900/10 p-3 text-sm text-red-700">{error}</p> : null}

      {open ? (
        <form className="space-y-5 rounded-xl border border-[var(--gold)]/40 bg-[var(--surface)] p-4 md:p-6" onSubmit={createDraft}>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block"><span className="label">Invoice to *</span>
              <select className="field mt-1 min-h-11" onChange={(event) => { setCustomerId(event.target.value); setJobId(""); }} required value={customerId}>
                <option value="">Choose a person or business</option>
                {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.customer_type === "business" ? customer.business_name || customer.full_name : customer.full_name}{customer.customer_type === "business" ? " · Business" : " · Person"}</option>)}
              </select>
              {customers.length === 0 ? <span className="mt-2 block text-xs text-[var(--text-muted)]">Add a person or business in <Link className="underline" href="/customers/new">Customers</Link> first.</span> : null}
            </label>
            <label className="block"><span className="label">Link to job (optional)</span>
              <select className="field mt-1 min-h-11" disabled={!customerId || compatibleJobs.length === 0} onChange={(event) => setJobId(event.target.value)} value={jobId}>
                <option value="">No job — standalone invoice</option>
                {compatibleJobs.map((job) => <option key={job.id} value={job.id}>{job.job_ref || job.job_title} · {job.job_title}</option>)}
              </select>
            </label>
            <label className="block"><span className="label">Invoice date *</span><input className="field mt-1 min-h-11" onChange={(event) => setIssueDate(event.target.value)} required type="date" value={issueDate} /></label>
            <label className="block"><span className="label">Payment due *</span><input className="field mt-1 min-h-11" onChange={(event) => setDueDate(event.target.value)} required type="date" value={dueDate} /></label>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3"><div><h3 className="font-semibold text-[var(--text)]">What are you invoicing for?</h3><p className="text-xs text-[var(--text-muted)]">VAT is {vatRate}% on each checked item.</p></div><button className="button-ghost" onClick={() => setLines((current) => [...current, newLine()])} type="button">＋ Add item</button></div>
            {lines.map((line, index) => (
              <div className="grid gap-3 rounded-lg border border-[var(--border)] p-3 md:grid-cols-[minmax(0,2fr)_90px_110px_130px_auto]" key={index}>
                <label className="block md:col-span-1"><span className="label">Description *</span><input className="field mt-1 min-h-11" maxLength={500} onChange={(event) => updateLine(index, { description: event.target.value })} placeholder="e.g. Gutter repair and replacement" value={line.description} /></label>
                <label className="block"><span className="label">Qty</span><input className="field mt-1 min-h-11" inputMode="decimal" min="0.01" onChange={(event) => updateLine(index, { quantity: event.target.value })} step="0.01" type="number" value={line.quantity} /></label>
                <label className="block"><span className="label">Unit</span><input className="field mt-1 min-h-11" maxLength={32} onChange={(event) => updateLine(index, { unit: event.target.value })} value={line.unit} /></label>
                <label className="block"><span className="label">Price each (£)</span><input className="field mt-1 min-h-11" inputMode="decimal" min="0" onChange={(event) => updateLine(index, { unit_price: event.target.value })} step="0.01" type="number" value={line.unit_price} /></label>
                <div className="flex items-end gap-3 md:flex-col md:items-start md:justify-end"><label className="flex min-h-11 items-center gap-2 text-sm"><input checked={line.vat_applicable} onChange={(event) => updateLine(index, { vat_applicable: event.target.checked })} type="checkbox" />VAT</label>{lines.length > 1 ? <button aria-label={`Remove item ${index + 1}`} className="button-ghost !px-2" onClick={() => setLines((current) => current.filter((_, lineIndex) => lineIndex !== index))} type="button">Remove</button> : null}</div>
                <p className="text-sm text-[var(--text-muted)] md:col-span-5">Line total: <strong className="text-[var(--text)]">{currency(round2((Number(line.quantity) || 0) * (Number(line.unit_price) || 0)))}</strong></p>
              </div>
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block"><span className="label">Payment terms</span><input className="field mt-1 min-h-11" maxLength={1000} onChange={(event) => setPaymentTerms(event.target.value)} value={paymentTerms} /></label>
            <label className="block"><span className="label">Notes (optional)</span><textarea className="field mt-1 min-h-11" maxLength={5000} onChange={(event) => setNotes(event.target.value)} rows={2} value={notes} /></label>
          </div>
          <div className="flex flex-wrap items-end justify-between gap-4 border-t border-[var(--border)] pt-4">
            <div className="space-y-1 text-sm"><p>Subtotal: {currency(round2(subtotal))}</p><p>VAT: {currency(round2(vat))}</p><p className="text-lg font-bold text-[var(--text)]">Total: {currency(total)}</p></div>
            {error ? <p className="w-full text-sm text-red-600">{error}</p> : null}
            <button className="button-primary" disabled={saving || !customerId || total <= 0} type="submit">{saving ? "Saving draft…" : "Save draft & create preview"}</button>
          </div>
        </form>
      ) : null}

      <div className="grid gap-3">
        {invoices.map((invoice) => {
          const customer = invoice.customer;
          const recipientName = customer?.business_name || customer?.full_name || "Customer";
          const email = customer?.customer_type === "business" ? customer.contact_person_email || customer.email : customer?.email;
          return (
            <article className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4" key={invoice.id}>
              <div><p className="font-semibold text-[var(--text)]">{invoice.invoice_ref} <span className="ml-2 rounded bg-[var(--surface-raised)] px-2 py-1 text-xs font-normal">{invoice.status}</span></p><p className="mt-1 text-sm text-[var(--text-muted)]">{recipientName}{invoice.linked_job ? ` · ${invoice.linked_job.job_ref || invoice.linked_job.job_title}` : " · Standalone"}</p><p className="mt-1 text-xs text-[var(--text-muted)]">Due {new Date(`${invoice.due_date}T00:00:00`).toLocaleDateString("en-GB")} · {currency(invoice.total)}</p></div>
              <div className="flex flex-wrap gap-2"><Link className="button-ghost" href={(invoice.job_id ? `/jobs/${invoice.job_id}/invoice/${invoice.id}/preview` : `/money/invoices/${invoice.id}/preview`) as Route}>Preview</Link>{invoice.status !== "Paid" && invoice.status !== "Void" ? <button className="button-secondary" onClick={() => setSending(invoice)} type="button">Send</button> : null}</div>
            </article>
          );
        })}
        {!invoices.length ? <div className="rounded-lg border border-[var(--border)] p-8 text-center text-sm text-[var(--text-muted)]">No invoices yet. Create a bespoke invoice above, or raise one from a job.</div> : null}
      </div>
      {sending ? <SendInvoiceModal invoiceId={sending.id} invoiceRef={sending.invoice_ref} jobTitle={sending.linked_job?.job_title || "Bespoke invoice"} total={sending.total} dueDate={sending.due_date} customerName={sending.customer?.contact_person_name || sending.customer?.full_name || sending.customer?.business_name || "Customer"} customerEmail={sending.customer?.customer_type === "business" ? sending.customer.contact_person_email || sending.customer.email : sending.customer?.email} onClose={() => setSending(null)} onSent={() => { setSending(null); router.refresh(); }} /> : null}
    </section>
  );
}

function round2(value: number) { return Math.round((value + Number.EPSILON) * 100) / 100; }
function today() { return new Date().toISOString().slice(0, 10); }
