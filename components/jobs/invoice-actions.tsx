"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { InvoiceRecord, QuoteRecord } from "@/lib/types";

type Props = {
  jobId: string;
  quote: QuoteRecord | null;
  invoices: InvoiceRecord[];
};

export function InvoiceActions({ jobId, quote, invoices }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const latestInvoice = invoices[0] ?? null;

  async function createInvoice() {
    setMessage(null);
    setError(null);
    setActiveId("create");
    const response = await fetch(`/api/jobs/${jobId}/invoices`, { method: "POST" });
    const result = (await response.json().catch(() => null)) as { ok?: boolean; message?: string; error?: string; warning?: string } | null;
    setActiveId(null);
    if (!response.ok || !result?.ok) {
      setError(result?.error || "Invoice could not be created.");
      return;
    }
    setMessage([result.message, result.warning].filter(Boolean).join(" "));
    startTransition(() => router.refresh());
  }

  async function regeneratePdf(invoiceId: string) {
    setMessage(null);
    setError(null);
    setActiveId(invoiceId);
    const response = await fetch(`/api/invoices/${invoiceId}/pdf`, { method: "POST" });
    const result = (await response.json().catch(() => null)) as { ok?: boolean; message?: string; error?: string } | null;
    setActiveId(null);
    if (!response.ok || !result?.ok) {
      setError(result?.error || "Invoice PDF could not be generated.");
      return;
    }
    setMessage(result.message || "Invoice PDF regenerated.");
    startTransition(() => router.refresh());
  }

  async function markPaid(invoice: InvoiceRecord) {
    setMessage(null);
    setError(null);
    setActiveId(invoice.id);
    const response = await fetch(`/api/invoices/${invoice.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "Paid", amount_paid: invoice.total, payment_method: "Manual" })
    });
    const result = (await response.json().catch(() => null)) as { ok?: boolean; message?: string; error?: string } | null;
    setActiveId(null);
    if (!response.ok || !result?.ok) {
      setError(result?.error || "Invoice could not be marked paid.");
      return;
    }
    setMessage(result.message || "Invoice marked paid.");
    startTransition(() => router.refresh());
  }

  return (
    <div className="mt-4 space-y-3">
      <div className="flex flex-wrap gap-2">
        <button className="button-secondary !px-4 !py-2 text-sm" disabled={!quote || isPending || activeId === "create"} onClick={createInvoice} type="button">
          {activeId === "create" ? "Creating..." : latestInvoice ? "Create Another Invoice" : "Create Invoice"}
        </button>
        {!quote ? <p className="text-sm text-[#ffcf7d]">Create a quote first, then raise the invoice from it.</p> : null}
      </div>

      {invoices.map((invoice) => (
        <div className="rounded-2xl border border-[var(--border)] p-3" key={invoice.id}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-white">{invoice.invoice_ref}</p>
              <p className="mt-1 text-sm text-[var(--muted)]">
                {invoice.status} · Balance {formatCurrency(invoice.balance_due)}
              </p>
            </div>
            <p className="text-right font-display text-2xl text-[var(--gold-l)]">{formatCurrency(invoice.total)}</p>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {invoice.pdf_url ? (
              <a className="button-ghost !px-3 !py-2 text-sm" href={invoice.pdf_url} rel="noreferrer" target="_blank">
                Open PDF
              </a>
            ) : null}
            <button className="button-ghost !px-3 !py-2 text-sm" disabled={activeId === invoice.id} onClick={() => regeneratePdf(invoice.id)} type="button">
              {activeId === invoice.id ? "Working..." : "Regenerate PDF"}
            </button>
            {invoice.status !== "Paid" && invoice.status !== "Void" ? (
              <button className="button-secondary !px-3 !py-2 text-sm" disabled={activeId === invoice.id} onClick={() => markPaid(invoice)} type="button">
                Mark Paid
              </button>
            ) : null}
          </div>
        </div>
      ))}

      {message ? <p className="text-sm text-[#7ce3a6]">{message}</p> : null}
      {error ? <p className="text-sm text-[#ff9a91]">{error}</p> : null}
    </div>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(value);
}
