"use client";

import type { ConversationRecord } from "@/lib/types";
import { formatDate } from "@/lib/utils";

type Props = {
  conversations: ConversationRecord[];
  activeId: string | null;
  filter: "all" | "unread" | "email" | "sms" | "whatsapp" | "platform";
  onFilterChange: (value: Props["filter"]) => void;
  onSelect: (conversationId: string) => void;
};

const FILTERS: Array<{ key: Props["filter"]; label: string }> = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "email", label: "Email" },
  { key: "sms", label: "SMS" },
  { key: "whatsapp", label: "WhatsApp" },
  { key: "platform", label: "Platform" }
];

export function ConversationList({ conversations, activeId, filter, onFilterChange, onSelect }: Props) {
  const filtered = conversations.filter((conversation) => {
    if (filter === "all") return true;
    if (filter === "unread") return Number(conversation.unread_count ?? 0) > 0;
    return conversation.primary_channel === filter;
  });

  return (
    <div className="card flex h-full flex-col p-4">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((item) => (
          <button
            className={filter === item.key ? "rounded-full bg-[var(--gold)] px-3 py-1.5 text-xs font-bold text-black" : "rounded-full border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--muted)]"}
            key={item.key}
            onClick={() => onFilterChange(item.key)}
            type="button"
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="mt-4 flex-1 space-y-2 overflow-y-auto">
        {filtered.map((conversation) => {
          const active = activeId === conversation.id;
          return (
            <button
              className={`w-full rounded-2xl border p-3 text-left transition ${active ? "border-[var(--gold)] bg-[var(--gold)]/10" : "border-[var(--border)] bg-black/20 hover:border-[var(--gold)]/45"}`}
              key={conversation.id}
              onClick={() => onSelect(conversation.id)}
              type="button"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="truncate font-semibold text-white">{conversation.customer?.full_name ?? conversation.job?.job_title ?? "Unknown contact"}</p>
                <div className="flex items-center gap-2">
                  {Number(conversation.unread_count ?? 0) > 0 ? <span className="h-2.5 w-2.5 rounded-full bg-[#ef4444]" /> : null}
                  <span className="text-[0.7rem] uppercase tracking-[0.18em] text-[var(--dim)]">{labelForChannel(conversation.primary_channel)}</span>
                </div>
              </div>
              <p className="mt-1 text-xs text-[var(--muted)]">{conversation.job?.job_ref ?? "No job ref"}</p>
              <p className="mt-3 line-clamp-2 text-sm text-[var(--text)]">{conversation.last_message_preview || conversation.subject || "No messages yet."}</p>
              <p className="mt-3 text-xs text-[var(--dim)]">{formatDate(conversation.last_message_at ?? conversation.updated_at ?? conversation.created_at)}</p>
            </button>
          );
        })}

        {filtered.length === 0 ? <p className="rounded-2xl border border-[var(--border)] bg-black/20 p-4 text-sm text-[var(--muted)]">No conversations match this filter yet.</p> : null}
      </div>
    </div>
  );
}

function labelForChannel(channel: ConversationRecord["primary_channel"]) {
  if (channel === "google_business") return "Google";
  return channel.replace("_", " ");
}
