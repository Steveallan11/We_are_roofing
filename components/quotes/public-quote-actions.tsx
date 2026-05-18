"use client";

import { useState } from "react";
import type { QuoteOption } from "@/lib/types";

type Props = {
  quoteId: string;
  options: QuoteOption[];
};

export function PublicQuoteActions({ quoteId, options }: Props) {
  const [message, setMessage] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  async function accept(optionId?: string) {
    const response = await fetch(`/api/quotes/${quoteId}/accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ option_id: optionId, customer_name: customerName, customer_email: customerEmail })
    });
    setStatus(response.ok ? "Quote accepted. We Are Roofing will be in touch shortly." : "Sorry, acceptance could not be recorded.");
  }

  async function sendMessage() {
    if (!message.trim()) return;
    const response = await fetch(`/api/quotes/${quoteId}/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sender_type: "customer", sender_name: customerName, sender_email: customerEmail, message })
    });
    setStatus(response.ok ? "Message sent to We Are Roofing." : "Sorry, message could not be sent.");
    if (response.ok) setMessage("");
  }

  return (
    <div className="mt-8 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <p className="section-kicker text-[0.65rem] uppercase">Accept or Ask a Question</p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <input className="field" onChange={(event) => setCustomerName(event.target.value)} placeholder="Your name" value={customerName} />
        <input className="field" onChange={(event) => setCustomerEmail(event.target.value)} placeholder="Your email" type="email" value={customerEmail} />
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        {options.length ? (
          options.map((option) => (
            <button className={option.recommended ? "button-primary" : "button-secondary"} key={option.id} onClick={() => accept(option.id)} type="button">
              Accept {option.label}
            </button>
          ))
        ) : (
          <button className="button-primary" onClick={() => accept()} type="button">
            Accept Quote
          </button>
        )}
      </div>
      <textarea className="field mt-4 min-h-28" onChange={(event) => setMessage(event.target.value)} placeholder="Have a question? Type it here..." value={message} />
      <button className="button-ghost mt-3" onClick={sendMessage} type="button">
        Send Message
      </button>
      {status ? <p className="mt-4 text-sm text-[var(--gold-l)]">{status}</p> : null}
    </div>
  );
}
