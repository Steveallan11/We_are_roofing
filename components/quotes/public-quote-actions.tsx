"use client";

import { useState } from "react";
import type { QuoteOption } from "@/lib/types";
import { getOptionTotal } from "@/lib/quotes/value";
import { currency } from "@/lib/utils";

type Props = {
  quoteId: string;
  options: QuoteOption[];
  token?: string | null;
};

export function PublicQuoteActions({ quoteId, options, token }: Props) {
  const [message, setMessage] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(
    options.find((option) => option.recommended)?.id ?? options[0]?.id ?? null
  );
  const [status, setStatus] = useState<string | null>(null);

  if (!token) {
    return (
      <div className="mt-8 rounded-[1.5rem] border border-[var(--gold)]/35 bg-[var(--surface)] p-5 shadow-2xl md:p-7">
        <p className="section-kicker text-[0.68rem] uppercase text-[var(--gold)]">Read-only quote link</p>
        <h2 className="mt-3 font-display text-3xl text-white md:text-4xl">Ask Andy for the secure quote link</h2>
        <p className="mt-3 font-ui text-base leading-7 text-[var(--text-muted)]">
          This older quote link is available for viewing only. To accept the quote or send a question through the portal, use the latest secure link from your email.
        </p>
      </div>
    );
  }
  const secureToken = token;
  const canAccept = customerName.trim().length >= 2 && /^\S+@\S+\.\S+$/.test(customerEmail.trim()) && (!options.length || selectedOptionId);

  async function accept() {
    if (!canAccept) {
      setStatus("Please add your name and email before accepting, so we can record who confirmed the quote.");
      return;
    }

    const response = await fetch(`/api/quotes/${quoteId}/accept?token=${encodeURIComponent(secureToken)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ option_id: selectedOptionId, customer_name: customerName.trim(), customer_email: customerEmail.trim() })
    });
    setStatus(response.ok ? "Quote accepted. We Are Roofing will be in touch shortly." : "Sorry, acceptance could not be recorded.");
  }

  async function sendMessage() {
    if (!message.trim()) return;
    const response = await fetch(`/api/quotes/${quoteId}/message?token=${encodeURIComponent(secureToken)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sender_type: "customer", sender_name: customerName, sender_email: customerEmail, message })
    });
    setStatus(response.ok ? "Message sent to We Are Roofing." : "Sorry, message could not be sent.");
    if (response.ok) setMessage("");
  }

  return (
    <div className="mt-6 rounded-[1.5rem] border border-[var(--gold)]/35 bg-[var(--surface)] p-5 shadow-2xl md:p-7">
      <p className="section-kicker text-[0.68rem] uppercase text-[var(--gold)]">Next Step</p>
      <h2 className="mt-2 font-display text-3xl leading-tight text-white md:text-5xl">Accept the quote or ask Andy a question</h2>
      <p className="mt-3 font-ui text-base leading-7 text-[var(--text-muted)] md:text-lg md:leading-8">
        Add your details so we can record who accepted and get straight back to you.
      </p>
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <input className="field min-h-12" onChange={(event) => setCustomerName(event.target.value)} placeholder="Your name" autoComplete="name" value={customerName} />
        <input className="field min-h-12" onChange={(event) => setCustomerEmail(event.target.value)} placeholder="Your email" type="email" inputMode="email" autoComplete="email" value={customerEmail} />
      </div>
      <div className="mt-5 grid gap-3">
        {options.length ? (
          options.map((option) => (
            <button
              className={`min-h-20 rounded-2xl border-2 p-4 text-left transition ${
                selectedOptionId === option.id
                  ? "border-[var(--gold)] bg-[var(--gold)] text-black shadow-[0_0_0_4px_rgba(212,175,55,0.16)]"
                  : "border-[var(--border)] bg-black/15 text-[var(--text-second)]"
              }`}
              key={option.id}
              onClick={() => setSelectedOptionId(option.id)}
              type="button"
            >
              <span className="flex items-start justify-between gap-3">
                <span>
                  <span className="block font-ui text-base font-bold">{option.label}</span>
                  {option.recommended ? <span className="mt-1 block font-ui text-xs font-bold uppercase tracking-[0.14em] opacity-75">Recommended</span> : null}
                </span>
                <span className="text-right font-ui text-base font-bold">{currency(getOptionTotal(option) ?? 0)}</span>
              </span>
              <span className="mt-3 block font-ui text-sm font-bold">
                {selectedOptionId === option.id ? "Selected" : "Tap to select"}
              </span>
            </button>
          ))
        ) : (
          <p className="rounded-2xl border border-[var(--gold)]/30 bg-[var(--gold)]/10 p-4 font-ui text-base text-[var(--text-second)]">
            Ready to proceed? Confirm your details, then accept below.
          </p>
        )}
      </div>
      <button
        className="button-primary mt-4 !min-h-14 w-full !text-base disabled:cursor-not-allowed disabled:opacity-50"
        disabled={!canAccept}
        onClick={accept}
        type="button"
      >
        {options.length ? "Accept Selected Option" : "Accept Quote"}
      </button>
      <textarea className="field mt-5 min-h-40 text-base leading-7" onChange={(event) => setMessage(event.target.value)} placeholder="Have a question? Type it here..." value={message} />
      <button className="button-ghost mt-3 !min-h-12 !text-base" onClick={sendMessage} type="button">
        Send Question
      </button>
      {status ? <p className="mt-4 text-sm text-[var(--gold-l)]">{status}</p> : null}
    </div>
  );
}
