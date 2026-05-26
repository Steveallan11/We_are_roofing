"use client";

import type { ConversationRecord } from "@/lib/types";
import { getQuotePipelineValue } from "@/lib/quotes/value";
import { currency, formatDate } from "@/lib/utils";

type Props = {
  conversation: ConversationRecord | null;
};

export function CustomerContext({ conversation }: Props) {
  if (!conversation) {
    return (
      <div className="card p-4">
        <p className="text-sm text-[var(--muted)]">Select a conversation to see the customer and job context here.</p>
      </div>
    );
  }

  const customer = conversation.customer;
  const job = conversation.job;
  const quote = conversation.quote;

  return (
    <div className="card p-4">
      <p className="section-kicker text-[0.65rem] uppercase">Customer Context</p>
      <div className="mt-4 space-y-3 text-sm">
        <ContextRow label="Customer" value={customer?.full_name ?? "Unknown"} />
        <ContextRow label="Email" value={customer?.email || customer?.contact_person_email || "No email"} />
        <ContextRow label="Phone" value={customer?.phone || customer?.contact_person_phone || "No phone"} />
        <ContextRow label="Job" value={job?.job_ref ? `${job.job_ref} | ${job.job_title}` : job?.job_title || "No linked job"} />
        <ContextRow label="Status" value={job?.status ?? "No status"} />
        <ContextRow label="Quote" value={quote ? `${quote.quote_ref} | ${currency(getQuotePipelineValue(quote) ?? 0)}` : "No linked quote"} />
        <ContextRow label="Last Message" value={formatDate(conversation.last_message_at ?? conversation.updated_at ?? conversation.created_at)} />
      </div>
    </div>
  );
}

function ContextRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-black/20 p-3">
      <p className="text-[0.65rem] font-bold uppercase tracking-[0.18em] text-[var(--dim)]">{label}</p>
      <p className="mt-1 text-[var(--text)]">{value}</p>
    </div>
  );
}
