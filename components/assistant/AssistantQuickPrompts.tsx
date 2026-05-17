"use client";

import { usePathname } from "next/navigation";

function getQuickPrompts(pathname: string) {
  if (pathname === "/crm") {
    return ["What needs following up?", "Show me this week's jobs", "Create a new job"];
  }
  if (/^\/jobs\/[^/]+$/.test(pathname)) {
    return ["Summarise this job", "What's the next step?", "Draft a follow-up message"];
  }
  if (/^\/jobs\/[^/]+\/quote$/.test(pathname)) {
    return ["What quotes are waiting to be sent?", "Summarise this draft", "What is missing before approval?"];
  }
  if (pathname === "/dashboard") {
    return ["What jobs need following up?", "How many quotes are still waiting?", "What should we move next?"];
  }
  return [];
}

export function AssistantQuickPrompts() {
  const pathname = usePathname();
  const prompts = getQuickPrompts(pathname);
  if (prompts.length === 0) return null;

  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {prompts.map((prompt) => (
        <button
          className="rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--muted)] transition hover:border-[var(--gold)] hover:text-[var(--gold-l)]"
          key={prompt}
          onClick={() => window.dispatchEvent(new CustomEvent("gauge:prompt", { detail: { prompt } }))}
          type="button"
        >
          {prompt}
        </button>
      ))}
    </div>
  );
}
