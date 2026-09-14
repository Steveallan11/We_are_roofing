"use client";

import { useEffect, useState } from "react";
import { ConversationList } from "@/components/comms/ConversationList";
import { ConversationThread } from "@/components/comms/ConversationThread";
import { CustomerContext } from "@/components/comms/CustomerContext";
import { MessageComposer } from "@/components/comms/MessageComposer";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useWindowSize } from "@/lib/hooks/useWindowSize";
import type { ConversationRecord, MessageRecord, MessageTemplateRecord } from "@/lib/types";

export type ComposeContact = {
  jobId: string;
  jobRef: string;
  jobTitle: string;
  customerName: string;
  email: string | null;
  phone: string | null;
};

type Props = {
  contacts: ComposeContact[];
  initialComposeJobId?: string | null;
  initialConversations: ConversationRecord[];
  initialConversation: ConversationRecord | null;
  initialMessages: MessageRecord[];
  templates: MessageTemplateRecord[];
};

export function UnifiedInbox({ contacts, initialComposeJobId = null, initialConversations, initialConversation, initialMessages, templates }: Props) {
  const [conversations, setConversations] = useState(initialConversations);
  const [selectedId, setSelectedId] = useState<string | null>(initialConversation?.id ?? initialConversations[0]?.id ?? null);
  const [selectedConversation, setSelectedConversation] = useState<ConversationRecord | null>(initialConversation ?? initialConversations[0] ?? null);
  const [messages, setMessages] = useState(initialMessages);
  const [filter, setFilter] = useState<"all" | "unread" | "email" | "sms" | "whatsapp" | "platform">("all");
  const [mobileThreadOpen, setMobileThreadOpen] = useState(false);
  const [composeOpen, setComposeOpen] = useState(Boolean(initialComposeJobId));
  const [composeJobId, setComposeJobId] = useState(initialComposeJobId ?? contacts[0]?.jobId ?? "");
  const [composeChannel, setComposeChannel] = useState<"email" | "sms">("email");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeError, setComposeError] = useState<string | null>(null);
  const [creatingConversation, setCreatingConversation] = useState(false);
  const { width } = useWindowSize();
  const isMobile = width < 1024;

  useEffect(() => {
    let active = true;

    async function fetchConversations() {
      const result = (await fetch("/api/comms/conversations")
        .then((response) => response.json())
        .catch(() => null)) as { ok?: boolean; conversations?: ConversationRecord[] } | null;
      if (!active || !result?.ok) return;
      const nextConversations = result.conversations ?? [];
      setConversations(nextConversations);
      setSelectedConversation((current) => nextConversations.find((conversation) => conversation.id === (current?.id ?? selectedId)) ?? current ?? nextConversations[0] ?? null);
      setSelectedId((current) => current ?? nextConversations[0]?.id ?? null);
    }

    void fetchConversations();

    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel("convos")
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, () => void fetchConversations())
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => void fetchConversations())
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [selectedId]);

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

  async function startConversation() {
    const contact = contacts.find((item) => item.jobId === composeJobId);
    if (!contact) {
      setComposeError("Choose a customer and job first.");
      return;
    }
    if (composeChannel === "email" && !contact.email) {
      setComposeError("This customer does not have an email address yet.");
      return;
    }
    if (composeChannel === "sms" && !contact.phone) {
      setComposeError("This customer does not have a phone number yet.");
      return;
    }

    setCreatingConversation(true);
    setComposeError(null);
    const response = await fetch("/api/comms/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        channel: composeChannel,
        customerEmail: contact.email,
        customerPhone: contact.phone,
        jobId: contact.jobId,
        subject: composeSubject.trim() || `${contact.jobRef} - ${contact.jobTitle}`
      })
    });
    const result = (await response.json().catch(() => null)) as { ok?: boolean; error?: string; conversation?: ConversationRecord | null } | null;
    setCreatingConversation(false);
    if (!response.ok || !result?.ok || !result.conversation) {
      setComposeError(result?.error || "The message could not be started.");
      return;
    }

    const conversation = result.conversation;
    setConversations((current) => [conversation, ...current.filter((item) => item.id !== conversation.id)]);
    setSelectedConversation(conversation);
    setSelectedId(conversation.id);
    if (conversation.id !== selectedId) setMessages([]);
    setMobileThreadOpen(true);
    setComposeOpen(false);
    setComposeSubject("");
  }

  const newMessageButton = (
    <button className="button-primary w-full" onClick={() => setComposeOpen(true)} type="button">
      + New message
    </button>
  );

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
      <div className="stack">
        {newMessageButton}
        <ConversationList activeId={selectedId} conversations={conversations} filter={filter} onFilterChange={setFilter} onSelect={selectConversation} />
        {composeOpen ? <NewMessageDialog contacts={contacts} creating={creatingConversation} error={composeError} jobId={composeJobId} onChannelChange={setComposeChannel} onClose={() => setComposeOpen(false)} onJobChange={setComposeJobId} onStart={() => void startConversation()} onSubjectChange={setComposeSubject} channel={composeChannel} subject={composeSubject} /> : null}
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)_260px]">
        <div className="stack">
          {newMessageButton}
          <ConversationList activeId={selectedId} conversations={conversations} filter={filter} onFilterChange={setFilter} onSelect={selectConversation} />
        </div>
        {thread}
        <div className="hidden xl:block">
          <CustomerContext conversation={selectedConversation} />
        </div>
      </div>
      {composeOpen ? <NewMessageDialog contacts={contacts} creating={creatingConversation} error={composeError} jobId={composeJobId} onChannelChange={setComposeChannel} onClose={() => setComposeOpen(false)} onJobChange={setComposeJobId} onStart={() => void startConversation()} onSubjectChange={setComposeSubject} channel={composeChannel} subject={composeSubject} /> : null}
    </>
  );
}

function NewMessageDialog({ contacts, creating, error, jobId, channel, subject, onChannelChange, onClose, onJobChange, onStart, onSubjectChange }: {
  contacts: ComposeContact[];
  creating: boolean;
  error: string | null;
  jobId: string;
  channel: "email" | "sms";
  subject: string;
  onChannelChange: (channel: "email" | "sms") => void;
  onClose: () => void;
  onJobChange: (jobId: string) => void;
  onStart: () => void;
  onSubjectChange: (subject: string) => void;
}) {
  const selected = contacts.find((contact) => contact.jobId === jobId);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-labelledby="new-message-title">
      <div className="card w-full max-w-lg p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="section-kicker text-[0.65rem] uppercase">Compose</p>
            <h2 className="mt-2 text-2xl" id="new-message-title">New customer message</h2>
          </div>
          <button className="button-ghost !min-h-10 !px-3 !py-2" onClick={onClose} type="button">Close</button>
        </div>
        <label className="mt-5 block">
          <span className="label">Customer and job</span>
          <select className="field" onChange={(event) => onJobChange(event.target.value)} value={jobId}>
            {contacts.map((contact) => (
              <option key={contact.jobId} value={contact.jobId}>{contact.customerName} - {contact.jobRef} - {contact.jobTitle}</option>
            ))}
          </select>
        </label>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label>
            <span className="label">Send by</span>
            <select className="field" onChange={(event) => onChannelChange(event.target.value as "email" | "sms")} value={channel}>
              <option value="email">Email</option>
              <option value="sms">SMS</option>
            </select>
          </label>
          <label>
            <span className="label">Destination</span>
            <input className="field" disabled value={channel === "email" ? selected?.email ?? "No email saved" : selected?.phone ?? "No phone saved"} />
          </label>
        </div>
        {channel === "email" ? (
          <label className="mt-3 block">
            <span className="label">Subject</span>
            <input className="field" onChange={(event) => onSubjectChange(event.target.value)} placeholder="Leave blank to use the job reference" value={subject} />
          </label>
        ) : null}
        <p className="mt-3 text-sm text-[var(--text-muted)]">This opens a blank message. You can write freely or choose a template before sending.</p>
        {error ? <p className="mt-3 text-sm text-[#ff9a91]">{error}</p> : null}
        <div className="mt-5 flex justify-end gap-2">
          <button className="button-ghost" onClick={onClose} type="button">Cancel</button>
          <button className="button-primary" disabled={creating || contacts.length === 0} onClick={onStart} type="button">{creating ? "Opening..." : "Start message"}</button>
        </div>
      </div>
    </div>
  );
}
