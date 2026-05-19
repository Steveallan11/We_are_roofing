"use client";

import { useEffect, useState } from "react";
import { ConversationList } from "@/components/comms/ConversationList";
import { ConversationThread } from "@/components/comms/ConversationThread";
import { CustomerContext } from "@/components/comms/CustomerContext";
import { MessageComposer } from "@/components/comms/MessageComposer";
import { useWindowSize } from "@/lib/hooks/useWindowSize";
import type { ConversationRecord, MessageRecord, MessageTemplateRecord } from "@/lib/types";

type Props = {
  initialConversations: ConversationRecord[];
  initialConversation: ConversationRecord | null;
  initialMessages: MessageRecord[];
  templates: MessageTemplateRecord[];
};

export function UnifiedInbox({ initialConversations, initialConversation, initialMessages, templates }: Props) {
  const [conversations, setConversations] = useState(initialConversations);
  const [selectedId, setSelectedId] = useState<string | null>(initialConversation?.id ?? initialConversations[0]?.id ?? null);
  const [selectedConversation, setSelectedConversation] = useState<ConversationRecord | null>(initialConversation ?? initialConversations[0] ?? null);
  const [messages, setMessages] = useState(initialMessages);
  const [filter, setFilter] = useState<"all" | "unread" | "email" | "sms" | "whatsapp" | "platform">("all");
  const [mobileThreadOpen, setMobileThreadOpen] = useState(false);
  const { width } = useWindowSize();
  const isMobile = width < 1024;

  useEffect(() => {
    if (!selectedId) return;

    let active = true;
    void fetch(`/api/comms/conversations/${selectedId}`)
      .then((response) => response.json())
      .then((result: { ok?: boolean; conversation?: ConversationRecord; messages?: MessageRecord[] }) => {
        if (!active || !result?.ok || !result.conversation) return;
        setSelectedConversation(result.conversation);
        setMessages(result.messages ?? []);
        setConversations((current) =>
          current.map((conversation) =>
            conversation.id === result.conversation?.id ? { ...result.conversation, unread_count: 0 } : conversation
          )
        );
        void fetch(`/api/comms/conversations/${selectedId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ unread_count: 0 })
        });
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [selectedId]);

  const selectConversation = (id: string | null) => {
    setSelectedId(id);
    setMobileThreadOpen(Boolean(id));
  };

  const thread = (
    <div className="stack">
      {isMobile ? (
        <button className="button-ghost w-fit !min-h-11 !px-4 !py-2 text-sm" onClick={() => setMobileThreadOpen(false)} type="button">
          Back to conversations
        </button>
      ) : null}
      <div className="stack">
        <div className="card p-4">
          <p className="section-kicker text-[0.65rem] uppercase">Thread</p>
          <h2 className="mt-2 font-condensed text-3xl text-white">{selectedConversation?.subject || selectedConversation?.customer?.full_name || "Communications"}</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            {selectedConversation?.job?.job_ref ? `${selectedConversation.job.job_ref} | ` : ""}
            {selectedConversation?.last_message_preview || "Pick a conversation to view and reply."}
          </p>
        </div>
        <ConversationThread messages={messages} />
        <MessageComposer
          conversationId={selectedConversation?.id ?? null}
          defaultChannel={selectedConversation?.primary_channel ?? "email"}
          onSent={(nextMessages) => {
            setMessages(nextMessages);
            if (!selectedConversation) return;
            setConversations((current) =>
              current.map((conversation) =>
                conversation.id === selectedConversation.id
                  ? {
                      ...conversation,
                      unread_count: 0,
                      last_message_preview: nextMessages[nextMessages.length - 1]?.body ?? conversation.last_message_preview,
                      last_message_at: nextMessages[nextMessages.length - 1]?.sent_at ?? new Date().toISOString()
                    }
                  : conversation
              )
            );
          }}
          templates={templates}
        />
      </div>
    </div>
  );

  if (isMobile) {
    return mobileThreadOpen ? (
      thread
    ) : (
      <ConversationList activeId={selectedId} conversations={conversations} filter={filter} onFilterChange={setFilter} onSelect={selectConversation} />
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)_260px]">
      <ConversationList activeId={selectedId} conversations={conversations} filter={filter} onFilterChange={setFilter} onSelect={selectConversation} />
      {thread}
      <div className="hidden xl:block">
        <CustomerContext conversation={selectedConversation} />
      </div>
    </div>
  );
}
