"use client";

import { useState } from "react";
import type { QuoteOption } from "@/lib/types";

type Props = {
  quoteId: string;
  options: QuoteOption[];
  token?: string | null;
};

export function PublicQuoteActions({ quoteId, options, token }: Props) {
  const [message, setMessage] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  async function accept(optionId?: string) {
    const response = await fetch(`/api/quotes/${quoteId}/accept${token ? `?token=${encodeURIComponent(token)}` : ""}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ option_id: optionId, customer_name: customerName, customer_email: customerEmail })
    });
    setStatus(response.ok ? "Quote accepted. We Are Roofing will be in touch shortly." : "Sorry, acceptance could not be recorded.");
  }

  async function sendMessage() {
    if (!message.trim()) return;
    const response = await fetch(`/api/quotes/${quoteId}/message${token ? `?token=${encodeURIComponent(token)}` : ""}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sender_type: "customer", sender_name: customerName, sender_email: customerEmail, message })
    });
    setStatus(response.ok ? "Message sent to We Are Roofing." : "Sorry, message could not be sent.");
    if (response.ok) setMessage("");
  }

  return (
    <div className="mt-8 rounded-[1.5rem] border border-[var(--gold)]/35 bg-[var(--surface)] p-5 shadow-2xl md:p-7">
      <p className="section-kicker text-[0.68rem] uppercase text-[var(--gold)]">Next Step</p>
      <h2 className="mt-3 font-display text-3xl text-white md:text-4xl">Accept the quote or ask Andy a question</h2>
      <p className="mt-3 font-ui text-base leading-7 text-[var(--text-muted)]">
        Add your details below so we can match your response to the quote and get straight back to you.
      </p>
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <input className="field min-h-12" onChange={(event) => setCustomerName(event.target.value)} placeholder="Your name" value={customerName} />
        <input className="field min-h-12" onChange={(event) => setCustomerEmail(event.target.value)} placeholder="Your email" type="email" value={customerEmail} />
      </div>
      <div className="mt-5 grid gap-3 md:flex md:flex-wrap">
        {options.length ? (
          options.map((option) => (
            <button className={`${option.recommended ? "button-primary" : "button-secondary"} !min-h-12 !text-sm`} key={option.id} onClick={() => accept(option.id)} type="button">
              Accept {option.label}
            </button>
          ))
        ) : (
          <button className="button-primary !min-h-12 !text-sm" onClick={() => accept()} type="button">
            Accept Quote
          </button>
        )}
      </div>
      <textarea className="field mt-5 min-h-36" onChange={(event) => setMessage(event.target.value)} placeholder="Have a question? Type it here..." value={message} />
      <button className="button-ghost mt-3 !min-h-12 !text-sm" onClick={sendMessage} type="button">
        Send Question
      </button>
      {status ? <p className="mt-4 text-sm text-[var(--gold-l)]">{status}</p> : null}
    </div>
  );
}
