"use client";

import type { MessageRecord } from "@/lib/types";

type Props = {
  messages: MessageRecord[];
};

export function ConversationThread({ messages }: Props) {
  return (
    <div className="card flex min-h-[420px] flex-col p-4">
      <div className="flex-1 space-y-3 overflow-y-auto">
        {messages.map((message) => {
          const outbound = message.direction === "outbound";
          return (
            <div className={`flex ${outbound ? "justify-end" : "justify-start"}`} key={message.id}>
              <div className={`max-w-[80%] rounded-2xl border px-4 py-3 ${outbound ? "border-[var(--gold)]/35 bg-[var(--gold)]/10" : "border-[var(--border)] bg-black/20"}`}>
                <div className="flex items-center gap-2 text-[0.7rem] uppercase tracking-[0.18em] text-[var(--dim)]">
                  <span>{message.channel.replace("_", " ")}</span>
                  <span>{formatTime(message.sent_at ?? message.created_at)}</span>
                  {outbound ? <span className={message.status === "failed" ? "text-[#ff9a91]" : "text-[var(--muted)]"}>{message.status}</span> : null}
                </div>
                {message.subject ? <p className="mt-2 text-sm font-semibold text-[var(--text-primary)]">{message.subject}</p> : null}
                <p className="mt-2 whitespace-pre-line text-sm text-[var(--text)]">{message.body}</p>
                {message.attachments?.length ? (
                  <div className="mt-3 border-t border-[var(--border)] pt-2 text-xs text-[var(--muted)]">
                    {message.attachments.map((attachment, index) => (
                      <p key={`${String(attachment.filename ?? "attachment")}-${index}`}>Attachment: {String(attachment.filename ?? "Customer literature")}</p>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}

        {messages.length === 0 ? <p className="rounded-2xl border border-[var(--border)] bg-black/20 p-4 text-sm text-[var(--muted)]">No messages have been logged in this thread yet.</p> : null}
      </div>
    </div>
  );
}

function formatTime(value?: string | null) {
  if (!value) return "Now";
  return new Intl.DateTimeFormat("en-GB", { hour: "numeric", minute: "2-digit" }).format(new Date(value));
}
