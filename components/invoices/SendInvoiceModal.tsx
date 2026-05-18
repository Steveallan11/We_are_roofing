"use client";

import { useEffect, useState } from "react";
import { currency } from "@/lib/utils";

type Props = {
  invoiceId: string;
  invoiceRef: string;
  jobTitle: string;
  total: number;
  customerName: string;
  customerEmail: string | null | undefined;
  onClose: () => void;
  onSent: (message: string) => void;
};

export function SendInvoiceModal({ invoiceId, invoiceRef, jobTitle, total, customerName, customerEmail, onClose, onSent }: Props) {
  const [email, setEmail] = useState(customerEmail ?? "");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  async function sendInvoice() {
    const nextEmail = email.trim();
    if (!nextEmail) {
      setError("Add the customer's email address before sending this invoice.");
      return;
    }

    setIsSending(true);
    setError(null);
    setSuccess(null);

    const response = await fetch(`/api/invoices/${invoiceId}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to_email: nextEmail })
    });

    const result = (await response.json().catch(() => null)) as { ok?: boolean; error?: string; message?: string } | null;
    setIsSending(false);

    if (!response.ok || !result?.ok) {
      setError(result?.message || result?.error || "The invoice could not be sent.");
      return;
    }

    const message = result.message || "Invoice sent.";
    setSuccess(message);
    onSent(message);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(6,6,6,0.84)] px-4 py-6" role="dialog" aria-modal="true">
      <div className="card w-full max-w-xl p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="section-kicker text-[0.65rem] uppercase">Send Invoice</p>
            <h3 className="mt-2 font-condensed text-3xl text-white">{invoiceRef}</h3>
            <p className="mt-2 text-sm text-[var(--muted)]">
              {jobTitle} for {customerName}
            </p>
          </div>
          <button className="button-ghost !px-3 !py-2 text-sm" onClick={onClose} type="button">
            Close
          </button>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-[var(--border)] bg-black/20 p-3">
            <p className="label">Invoice Ref</p>
            <p className="mt-2 text-sm text-white">{invoiceRef}</p>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-black/20 p-3">
            <p className="label">Job</p>
            <p className="mt-2 text-sm text-white">{jobTitle}</p>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-black/20 p-3">
            <p className="label">Total Due</p>
            <p className="mt-2 text-sm text-white">{currency(total)}</p>
          </div>
        </div>

        {!customerEmail ? (
          <div className="mt-5 rounded-2xl border border-[#f59e0b]/30 bg-[#f59e0b]/10 px-4 py-3">
            <p className="text-sm font-semibold text-[#ffd38b]">Warning: no email on file for {customerName}</p>
            <p className="mt-1 text-xs text-[var(--muted)]">Add the email below and we will save it while sending the invoice.</p>
          </div>
        ) : null}

        <div className="mt-5">
          <label className="label" htmlFor={`invoice-send-email-${invoiceId}`}>
            Customer Email
          </label>
          <input
            className="field mt-2"
            id={`invoice-send-email-${invoiceId}`}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="customer@example.com"
            type="email"
            value={email}
          />
        </div>

        <div className="mt-5 rounded-2xl border border-[var(--border)] bg-black/20 p-4">
          <p className="label">What gets sent</p>
          <ul className="mt-3 space-y-2 text-sm text-[var(--text)]">
            <li>- Branded invoice email with due date and payment notes</li>
            <li>- Link to the latest invoice PDF or preview</li>
            <li>- Invoice status updated to Sent in the job file</li>
          </ul>
        </div>

        {error ? <p className="mt-4 text-sm text-[#ff9a91]">{error}</p> : null}
        {success ? <p className="mt-4 text-sm text-[#7ce3a6]">{success}</p> : null}

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button className="button-ghost" disabled={isSending} onClick={onClose} type="button">
            Cancel
          </button>
          <button className="button-primary" disabled={isSending} onClick={sendInvoice} type="button">
            {isSending ? "Sending..." : "Send Invoice"}
          </button>
        </div>
      </div>
    </div>
  );
}
