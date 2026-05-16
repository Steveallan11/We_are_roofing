"use client";

import type { AssistantUiMessage } from "@/lib/assistant/types";

type Props = {
  message: AssistantUiMessage;
};

export function AssistantMessage({ message }: Props) {
  const isUser = message.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 ${
          isUser ? "bg-[var(--gold)] text-black" : "border border-[var(--border)] bg-[var(--card)] text-[var(--text)]"
        }`}
      >
        {message.text}
      </div>
    </div>
  );
}
