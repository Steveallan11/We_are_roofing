"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/primitives";
import { currency } from "@/lib/utils";

export type VariationEmailDraft = {
  toEmail: string;
  greeting: string;
  subject: string;
  message: string;
};

type Props = {
  reference: string;
  itemCount: number;
  total: number;
  customerName: string;
  customerEmail?: string | null;
  isCopy?: boolean;
  onClose: () => void;
  onSend: (draft: VariationEmailDraft) => Promise<void>;
};

export function SendVariationQuoteModal({ reference, itemCount, total, customerName, customerEmail, isCopy = false, onClose, onSend }: Props) {
  const [toEmail, setToEmail] = useState(customerEmail ?? "");
  const [greeting, setGreeting] = useState(customerName || "Customer");
  const [subject, setSubject] = useState(
    isCopy
      ? "Copy of your additional works quotation from We Are Roofing UK Ltd"
      : itemCount > 1
      ? "Your additional works quotation from We Are Roofing UK Ltd"
      : "Your additional work quotation from We Are Roofing UK Ltd"
  );
  const [message, setMessage] = useState(
    isCopy
      ? "Please find a copy of the additional works quotation linked to your job. Use the button below to review the agreed scope and pricing."
      : itemCount > 1
      ? "We have prepared one combined quotation covering the additional work discussed. Please use the button below to review each item and confirm whether you would like us to proceed."
      : "We have prepared a quotation for the additional work discussed. Please use the button below to review the scope and confirm whether you would like us to proceed."
  );
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  async function submit() {
    if (!/^\S+@\S+\.\S+$/.test(toEmail.trim())) {
      setError("Enter a valid customer email address.");
      return;
    }
    if (!greeting.trim() || !subject.trim() || !message.trim()) {
      setError("Complete the greeting, subject and email message before sending.");
      return;
    }
    setSending(true);
    setError(null);
    try {
      await onSend({
        toEmail: toEmail.trim(),
        greeting: greeting.trim(),
        subject: subject.trim(),
        message: message.trim()
      });
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "The quotation could not be sent.");
      setSending(false);
    }
  }

  return (
    <div aria-modal="true" className="fixed inset-0 z-[70] flex min-h-0 items-stretch justify-center bg-[rgba(6,6,6,0.86)] p-0 md:items-center md:px-4 md:py-6" role="dialog">
      <div className="flex h-[100dvh] w-full max-w-2xl flex-col overflow-hidden border border-[var(--border)] bg-[var(--surface)] shadow-2xl md:h-[min(88dvh,820px)] md:rounded-[1.5rem]">
        <header className="shrink-0 border-b border-[var(--border)] bg-black/25 p-5 md:p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="section-kicker">Additional Works Quote</p>
              <h3 className="mt-2 font-display text-3xl text-[var(--text)]">Edit email before sending</h3>
              <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{reference} · {itemCount} {itemCount === 1 ? "item" : "linked items"} · {currency(total)}</p>
            </div>
            <Button disabled={sending} onClick={onClose} size="sm" variant="ghost">Close</Button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5 md:p-7">
          {!customerEmail ? <p className="rounded-xl border border-[#f59e0b]/35 bg-[#f59e0b]/10 p-3 text-sm text-[#ffd38b]">No customer email is saved yet. Enter the correct address below.</p> : null}
          <div className="grid gap-4 md:grid-cols-2">
            <label>
              <span className="label">Send to</span>
              <input className="field mt-2 min-h-12" onChange={(event) => setToEmail(event.target.value)} placeholder="customer@example.com" type="email" value={toEmail} />
            </label>
            <label>
              <span className="label">Greeting / addressed to</span>
              <input className="field mt-2 min-h-12" onChange={(event) => setGreeting(event.target.value)} placeholder="Brian & Clare or Mr & Mrs Linden" value={greeting} />
            </label>
          </div>
          <label className="mt-5 block">
            <span className="label">Email subject</span>
            <input className="field mt-2 min-h-12" onChange={(event) => setSubject(event.target.value)} value={subject} />
          </label>
          <label className="mt-5 block">
            <span className="label">Email message</span>
            <textarea className="field mt-2 min-h-44 leading-7" onChange={(event) => setMessage(event.target.value)} value={message} />
          </label>
          <div className="mt-5 rounded-xl border border-[var(--gold)]/35 bg-[var(--gold)]/10 p-4 text-sm leading-6 text-[var(--text)]">
            Your message appears above the quotation summary. The secure <strong>View Additional Works Quote</strong> button is added automatically, so the customer can always open and approve the correct document.
          </div>
          {error ? <p className="mt-4 text-sm font-semibold text-[#ff9a91]">{error}</p> : null}
        </div>

        <footer className="shrink-0 border-t border-[var(--border)] bg-black/25 p-4 md:px-7 md:py-5">
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button disabled={sending} onClick={onClose} size="sm" variant="ghost">Cancel</Button>
            <Button disabled={sending} onClick={submit} size="sm" variant="primary">{sending ? "Sending..." : isCopy ? "Email Quote Copy" : "Send Additional Works Quote"}</Button>
          </div>
        </footer>
      </div>
    </div>
  );
}
