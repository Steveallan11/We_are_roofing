"use client";

import { useEffect, useState } from "react";
import { currency } from "@/lib/utils";

type Props = {
  quoteId: string;
  quoteRef: string;
  jobTitle: string;
  total: number;
  customerName: string;
  customerEmail: string | null | undefined;
  onClose: () => void;
  onSent: (message: string) => void;
};

export function SendQuoteModal({ quoteId, quoteRef, jobTitle, total, customerName, customerEmail, onClose, onSent }: Props) {
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

  async function sendQuote() {
    const nextEmail = email.trim();
    if (!nextEmail) {
      setError("Add the customer's email address before sending this quote.");
      return;
    }

    setIsSending(true);
    setError(null);
    setSuccess(null);

    const response = await fetch(`/api/quotes/${quoteId}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to_email: nextEmail })
    });

    const result = (await response.json().catch(() => null)) as { ok?: boolean; error?: string; message?: string } | null;
    setIsSending(false);

    if (!response.ok || !result?.ok) {
      setError(result?.message || result?.error || "The quote could not be sent.");
      return;
    }

    const message = result.message || "Quote sent.";
    setSuccess(message);
    onSent(message);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(6,6,6,0.84)] px-4 py-6" role="dialog" aria-modal="true">
      <div className="card w-full max-w-2xl p-6 md:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="section-kicker text-[0.65rem] uppercase">Send Quote</p>
            <h3 className="mt-2 font-condensed text-3xl text-white">{quoteRef}</h3>
            <p className="mt-2 max-w-xl text-base leading-7 text-[var(--muted)]">
              Send a secure customer link with a clearer paragraph quote, bigger text, online accept button, and question box.
            </p>
          </div>
          <button className="button-ghost !px-3 !py-2 text-sm" onClick={onClose} type="button">
            Close
          </button>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-[var(--border)] bg-black/20 p-3">
            <p className="label">Quote Ref</p>
            <p className="mt-2 text-sm text-white">{quoteRef}</p>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-black/20 p-3">
            <p className="label">Job</p>
            <p className="mt-2 text-sm text-white">{jobTitle}</p>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-black/20 p-3">
            <p className="label">Total</p>
            <p className="mt-2 text-sm text-white">{currency(total)}</p>
          </div>
        </div>

        {!customerEmail ? (
          <div className="mt-5 rounded-2xl border border-[#f59e0b]/30 bg-[#f59e0b]/10 px-4 py-3">
            <p className="text-sm font-semibold text-[#ffd38b]">Warning: no email on file for {customerName}</p>
            <p className="mt-1 text-xs text-[var(--muted)]">Add the email below and we will save it while sending the quote.</p>
          </div>
        ) : null}

        <div className="mt-5">
          <label className="label" htmlFor={`quote-send-email-${quoteId}`}>
            Customer Email
          </label>
          <input
            className="field mt-2"
            id={`quote-send-email-${quoteId}`}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="customer@example.com"
            type="email"
            value={email}
          />
        </div>

        <div className="mt-5 rounded-2xl border border-[var(--gold)]/30 bg-[var(--gold)]/10 p-5">
          <p className="label text-[var(--gold)]">Customer will receive</p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {[
              ["Readable quote", "Bigger paragraphs with report, scope, and price split clearly."],
              ["Secure link", "They can view, accept, or ask a question from one page."],
              ["Clean email", "Professional branded email with the total and next step."]
            ].map(([title, body]) => (
              <div className="rounded-xl border border-[var(--border)] bg-black/20 p-3" key={title}>
                <p className="text-sm font-bold text-white">{title}</p>
                <p className="mt-1 text-xs leading-5 text-[var(--muted)]">{body}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm leading-6 text-[var(--text)]">
            This updates the job file and records the quote as sent. If the customer replies with a question, it will stay linked to this quote.
          </p>
        </div>

        {error ? <p className="mt-4 text-sm text-[#ff9a91]">{error}</p> : null}
        {success ? <p className="mt-4 text-sm text-[#7ce3a6]">{success}</p> : null}

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button className="button-ghost" disabled={isSending} onClick={onClose} type="button">
            Cancel
          </button>
          <button className="button-primary" disabled={isSending} onClick={sendQuote} type="button">
            {isSending ? "Sending..." : "Send secure quote link"}
          </button>
        </div>
      </div>
    </div>
  );
}
