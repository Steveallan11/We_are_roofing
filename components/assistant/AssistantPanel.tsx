"use client";

import { usePathname } from "next/navigation";
import { AssistantButton } from "@/components/assistant/AssistantButton";
import { AssistantMessage } from "@/components/assistant/AssistantMessage";
import { AssistantTyping } from "@/components/assistant/AssistantTyping";
import { useAssistant } from "@/components/assistant/useAssistant";

export function AssistantPanel() {
  const pathname = usePathname();
  const assistant = useAssistant();

  if (pathname === "/login") {
    return null;
  }

  return (
    <>
      {!assistant.open ? (
        <AssistantButton onClick={() => assistant.setOpen(true)} overdueCount={assistant.overdueCount} tooltipVisible={assistant.tooltipVisible} />
      ) : null}

      {assistant.open ? (
        <div className="fixed bottom-6 right-6 z-50 w-[calc(100vw-2rem)] max-w-[380px] overflow-hidden rounded-[1.5rem] border border-[var(--border2)] bg-[var(--dark)] shadow-2xl">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
            <div>
              <p className="font-display text-2xl text-[var(--gold-l)]">Gauge</p>
              <p className="text-xs text-[var(--muted)]">Roofing admin assistant</p>
            </div>
            <div className="flex items-center gap-2">
              <button className={`button-ghost !px-3 !py-2 text-sm ${assistant.micActive ? "border-[var(--gold)] text-[var(--gold-l)]" : ""}`} onClick={assistant.toggleMic} type="button">
                {assistant.micActive ? "Listening" : "Mic"}
              </button>
              <button className="button-ghost !px-3 !py-2 text-sm" onClick={assistant.resetConversation} type="button">
                New
              </button>
              <button className="button-ghost !px-3 !py-2 text-sm" onClick={() => assistant.setOpen(false)} type="button">
                Close
              </button>
            </div>
          </div>

          <div className="flex h-[520px] flex-col">
            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4" ref={assistant.scrollRef}>
              {assistant.messages.length === 0 ? (
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 text-sm text-[var(--text)]">
                  Ask me about jobs, follow-ups, quotes, or what needs moving next.
                </div>
              ) : null}

              {assistant.messages.map((message) => (
                <AssistantMessage key={message.id} message={message} />
              ))}

              {assistant.toolState ? (
                <div className="inline-flex rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs text-[var(--muted)]">
                  {assistant.toolState.result ? `${assistant.toolState.name}: ${assistant.toolState.result}` : `Checking ${assistant.toolState.name}...`}
                </div>
              ) : null}

              {assistant.status === "sending" ? <AssistantTyping /> : null}
            </div>

            {assistant.error ? <div className="px-4 pb-2 text-sm text-[#ff9a91]">{assistant.error}</div> : null}

            <form
              className="border-t border-[var(--border)] p-4"
              onSubmit={(event) => {
                event.preventDefault();
                void assistant.sendMessage();
              }}
            >
              <div className="flex items-end gap-2">
                <textarea
                  className="field min-h-14 flex-1 resize-none"
                  onChange={(event) => assistant.setDraft(event.target.value)}
                  placeholder="Ask Gauge about jobs, quotes, or what needs doing next..."
                  value={assistant.draft}
                />
                <button className="button-primary !px-4 !py-3" disabled={assistant.status === "sending"} type="submit">
                  Send
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
