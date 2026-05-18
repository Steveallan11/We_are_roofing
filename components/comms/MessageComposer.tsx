"use client";

import { useEffect, useState } from "react";
import type { ConversationChannel, MessageRecord, MessageTemplateRecord } from "@/lib/types";

type Props = {
  conversationId: string | null;
  defaultChannel: ConversationChannel;
  templates: MessageTemplateRecord[];
  onSent: (messages: MessageRecord[]) => void;
};

export function MessageComposer({ conversationId, defaultChannel, templates, onSent }: Props) {
  const [channel, setChannel] = useState<ConversationChannel>(defaultChannel);
  const [body, setBody] = useState("");
  const [subject, setSubject] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    setChannel(defaultChannel);
  }, [defaultChannel]);

  async function send() {
    if (!conversationId) return;
    if (!body.trim()) {
      setError("Write a message before sending.");
      return;
    }

    setSending(true);
    setError(null);
    const response = await fetch(`/api/comms/conversations/${conversationId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel, body, subject })
    });
    const result = (await response.json().catch(() => null)) as { ok?: boolean; error?: string; messages?: MessageRecord[] } | null;
    setSending(false);

    if (!response.ok || !result?.ok) {
      setError(result?.error || "Message could not be sent.");
      return;
    }

    setBody("");
    setSubject("");
    onSent(result.messages ?? []);
  }

  return (
    <div className="card p-4">
      <div className="grid gap-3 md:grid-cols-[180px_1fr]">
        <select className="field" onChange={(event) => setChannel(event.target.value as ConversationChannel)} value={channel}>
          <option value="email">Email</option>
          <option value="sms">SMS</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="platform">Platform</option>
        </select>
        <select
          className="field"
          onChange={(event) => {
            const template = templates.find((item) => item.id === event.target.value);
            if (!template) return;
            setSubject(template.subject || "");
            setBody(template.body);
          }}
          value=""
        >
          <option value="">Pick a template</option>
          {templates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.name}
            </option>
          ))}
        </select>
      </div>
      {channel === "email" ? (
        <input className="field mt-3" onChange={(event) => setSubject(event.target.value)} placeholder="Subject" value={subject} />
      ) : null}
      <textarea className="field mt-3 min-h-36" onChange={(event) => setBody(event.target.value)} placeholder="Write your reply..." value={body} />
      {error ? <p className="mt-3 text-sm text-[#ff9a91]">{error}</p> : null}
      <div className="mt-3 flex justify-end">
        <button className="button-primary" disabled={!conversationId || sending} onClick={send} type="button">
          {sending ? "Sending..." : "Send Message"}
        </button>
      </div>
    </div>
  );
}
