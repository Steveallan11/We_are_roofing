"use client";

import { useEffect, useState } from "react";
import type { CommunicationDraft, ConversationChannel, ConversationRecord, JobDocumentRecord, LiteratureAsset, MessageRecord, MessageTemplateRecord } from "@/lib/types";
import { buildQuickFollowUp, type QuickFollowUpContext, type QuickFollowUpKind } from "@/lib/comms/quickFollowUp";

type DraftChannel = Extract<ConversationChannel, "email" | "sms" | "whatsapp">;
type AttachableJobDocument = JobDocumentRecord & { attachable?: boolean };
type AttachmentPreview = Pick<LiteratureAsset | JobDocumentRecord, "id" | "display_name">;

type Props = {
  conversationId: string | null;
  defaultChannel: ConversationChannel;
  conversation: ConversationRecord | null;
  templates: MessageTemplateRecord[];
  literature: LiteratureAsset[];
  quickFollowUpContext?: QuickFollowUpContext | null;
  initialBody?: string;
  initialSubject?: string;
  initialDraftKey?: string | number;
  initialJobDocumentIds?: string[];
  onSent: (messages: MessageRecord[]) => void;
};

export function MessageComposer({ conversationId, defaultChannel, conversation, templates, literature, quickFollowUpContext, initialBody, initialSubject, initialDraftKey, initialJobDocumentIds, onSent }: Props) {
  const [channel, setChannel] = useState<DraftChannel>(normaliseChannel(defaultChannel));
  const [body, setBody] = useState("");
  const [subject, setSubject] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [selectedLiteratureIds, setSelectedLiteratureIds] = useState<string[]>([]);
  const [jobDocuments, setJobDocuments] = useState<AttachableJobDocument[]>([]);
  const [selectedJobDocumentIds, setSelectedJobDocumentIds] = useState<string[]>([]);

  useEffect(() => {
    setChannel(normaliseChannel(defaultChannel));
  }, [defaultChannel]);

  useEffect(() => {
    setDraftId(null);
    setBody(initialBody ?? "");
    setSubject(initialSubject ?? "");
    setSelectedLiteratureIds([]);
    setSelectedJobDocumentIds(initialJobDocumentIds ?? []);
    setSavedMessage(null);
    if (!conversationId) return;
    let active = true;
    void fetch(`/api/comms/drafts?conversationId=${encodeURIComponent(conversationId)}`, { cache: "no-store" })
      .then((response) => response.json())
      .then((result: { ok?: boolean; draft?: CommunicationDraft | null }) => {
        if (!active || !result.ok || !result.draft) return;
        setDraftId(result.draft.id);
        setChannel(result.draft.channel);
        setSubject(result.draft.subject ?? "");
        setBody(result.draft.body);
        setSelectedLiteratureIds(result.draft.literature_ids ?? []);
        setSelectedJobDocumentIds(result.draft.job_document_ids ?? []);
        setSavedMessage("Restored saved draft.");
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [conversationId, initialBody, initialSubject, initialDraftKey, initialJobDocumentIds]);

  useEffect(() => {
    setJobDocuments([]);
    if (!conversation?.job_id) return;
    let active = true;
    void fetch(`/api/jobs/${conversation.job_id}/documents`, { cache: "no-store" })
      .then((response) => response.json())
      .then((result: { ok?: boolean; documents?: AttachableJobDocument[] }) => {
        if (active && result.ok) setJobDocuments((result.documents ?? []).filter((document) => document.attachable !== false));
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, [conversation?.job_id]);

  async function saveDraft(showConfirmation = true) {
    if (!conversationId) return null;
    if (!body.trim()) {
      setError("Write a message before sending.");
      return null;
    }
    setSaving(true);
    setError(null);
    setSavedMessage(null);
    const response = await fetch("/api/comms/drafts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: draftId,
        conversationId,
        channel,
        body,
        subject,
        literatureIds: channel === "email" ? selectedLiteratureIds : [],
        jobDocumentIds: channel === "email" ? selectedJobDocumentIds : []
      })
    });
    const result = (await response.json().catch(() => null)) as { ok?: boolean; error?: string; draft?: CommunicationDraft } | null;
    setSaving(false);
    if (!response.ok || !result?.ok || !result.draft) {
      setError(result?.error || "Draft could not be saved.");
      return null;
    }
    setDraftId(result.draft.id);
    if (showConfirmation) setSavedMessage("Draft saved. Nothing has been sent.");
    return result.draft;
  }

  async function review() {
    const draft = await saveDraft(false);
    if (draft) setReviewOpen(true);
  }

  async function sendConfirmed() {
    if (!conversationId || !draftId) return;
    setSending(true);
    setError(null);
    const response = await fetch(`/api/comms/drafts/${draftId}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmed: true, conversationId })
    });
    const result = (await response.json().catch(() => null)) as { ok?: boolean; error?: string; messages?: MessageRecord[] } | null;
    setSending(false);
    if (!response.ok || !result?.ok) {
      setError(result?.error || "Message could not be sent.");
      setReviewOpen(false);
      return;
    }

    setBody("");
    setSubject("");
    setSelectedLiteratureIds([]);
    setSelectedJobDocumentIds([]);
    setDraftId(null);
    setSavedMessage("Message sent and added to the job history.");
    setReviewOpen(false);
    onSent(result.messages ?? []);
  }

  return (
    <div className="card p-4">
      <div className="grid gap-3 md:grid-cols-[180px_1fr]">
        <select className="field" onChange={(event) => setChannel(event.target.value as DraftChannel)} value={channel}>
          <option value="email">Email</option>
          <option value="sms">SMS</option>
          <option value="whatsapp">WhatsApp</option>
        </select>
        <select
          className="field"
          onChange={(event) => {
            const template = templates.find((item) => item.id === event.target.value);
            if (!template) return;
            setSubject(applyTemplateVariables(template.subject || "", conversation));
            setBody(applyTemplateVariables(template.body, conversation));
          }}
          value=""
        >
          <option value="">Pick a template</option>
          {templates.filter((template) => !template.channels?.length || template.channels.includes(channel)).map((template) => (
            <option key={template.id} value={template.id}>
              {template.name}
            </option>
          ))}
        </select>
      </div>
      {channel === "email" && quickFollowUpContext ? (
        <label className="mt-3 block">
          <span className="label">Quick job follow-up</span>
          <select
            className="field"
            onChange={(event) => {
              if (!event.target.value) return;
              const draft = buildQuickFollowUp(quickFollowUpContext, event.target.value as QuickFollowUpKind);
              setSubject(draft.subject);
              setBody(draft.body);
              setSavedMessage("Job-aware follow-up added. Edit it before saving or sending.");
              setError(null);
              event.target.value = "";
            }}
            defaultValue=""
          >
            <option value="">Choose a follow-up email to prefill…</option>
            {quickFollowUpContext.quoteStatus === "Sent" ? <option value="quote">Check in on a quotation</option> : null}
            <option value="survey">Follow up after a survey</option>
            <option value="work">Check in on planned work</option>
            <option value="general">General job follow-up</option>
          </select>
          <span className="mt-1 block text-xs text-[var(--muted)]">Uses this job’s customer, address, stage and quote details where available. Nothing is sent automatically.</span>
        </label>
      ) : null}
      {channel === "email" ? (
        <input className="field mt-3" onChange={(event) => setSubject(event.target.value)} placeholder="Subject" value={subject} />
      ) : null}
      <textarea className="field mt-3 min-h-36" onChange={(event) => setBody(event.target.value)} placeholder="Write your reply..." value={body} />
      {channel === "email" && literature.length > 0 ? (
        <details className="mt-3 rounded-xl border border-[var(--border)] bg-black/20 p-3">
          <summary className="cursor-pointer text-sm font-semibold text-[var(--text-primary)]">
            Attach brochure or literature{selectedLiteratureIds.length ? ` (${selectedLiteratureIds.length} selected)` : ""}
          </summary>
          <div className="mt-3 grid gap-2">
            {literature.map((item) => (
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[var(--border)] p-3" key={item.id}>
                <input
                  checked={selectedLiteratureIds.includes(item.id)}
                  className="mt-1 h-5 w-5 accent-[var(--gold)]"
                  onChange={(event) => setSelectedLiteratureIds((current) => event.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id))}
                  type="checkbox"
                />
                <span><span className="block text-sm font-semibold text-[var(--text-primary)]">{item.display_name}</span>{item.description ? <span className="mt-1 block text-xs text-[var(--muted)]">{item.description}</span> : null}</span>
              </label>
            ))}
          </div>
        </details>
      ) : null}
      {channel === "email" && jobDocuments.length > 0 ? (
        <details className="mt-3 rounded-xl border border-[var(--gold)]/35 bg-[var(--gold)]/10 p-3">
          <summary className="cursor-pointer text-sm font-semibold text-[var(--text-primary)]">
            Attach invoice or job document{selectedJobDocumentIds.length ? ` (${selectedJobDocumentIds.length} selected)` : ""}
          </summary>
          <div className="mt-3 grid gap-2">
            {jobDocuments.map((document) => (
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[var(--border)] bg-black/15 p-3" key={document.id}>
                <input
                  checked={selectedJobDocumentIds.includes(document.id)}
                  className="mt-1 h-5 w-5 accent-[var(--gold)]"
                  onChange={(event) => setSelectedJobDocumentIds((current) => event.target.checked ? [...current, document.id] : current.filter((id) => id !== document.id))}
                  type="checkbox"
                />
                <span>
                  <span className="block text-sm font-semibold text-[var(--text-primary)]">{document.display_name}</span>
                  <span className="mt-1 block text-xs text-[var(--muted)]">{formatDocumentType(document.document_type)}{document.file_size ? ` · ${formatFileSize(document.file_size)}` : ""}</span>
                </span>
              </label>
            ))}
          </div>
        </details>
      ) : null}
      {error ? <p className="mt-3 text-sm text-[#ff9a91]">{error}</p> : null}
      {savedMessage ? <p className="mt-3 text-sm text-[var(--muted)]">{savedMessage}</p> : null}
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <button className="button-ghost" disabled={!conversationId || saving || sending} onClick={() => void saveDraft()} type="button">
          {saving ? "Saving..." : "Save draft"}
        </button>
        <button className="button-primary" disabled={!conversationId || saving || sending} onClick={() => void review()} type="button">
          Review before sending
        </button>
      </div>
      {reviewOpen ? (
        <MessageReviewDialog
          attachments={[
            ...jobDocuments.filter((item) => selectedJobDocumentIds.includes(item.id)),
            ...literature.filter((item) => selectedLiteratureIds.includes(item.id))
          ]}
          body={body}
          channel={channel}
          conversation={conversation}
          onCancel={() => setReviewOpen(false)}
          onConfirm={() => void sendConfirmed()}
          sending={sending}
          subject={subject}
        />
      ) : null}
    </div>
  );
}

function MessageReviewDialog({ attachments, body, channel, conversation, onCancel, onConfirm, sending, subject }: {
  attachments: AttachmentPreview[];
  body: string;
  channel: DraftChannel;
  conversation: ConversationRecord | null;
  onCancel: () => void;
  onConfirm: () => void;
  sending: boolean;
  subject: string;
}) {
  const recipient = channel === "email"
    ? conversation?.customer?.email || conversation?.customer?.contact_person_email || "No email saved"
    : conversation?.customer?.phone || conversation?.customer?.contact_person_phone || "No phone saved";
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/75 p-4" role="dialog" aria-modal="true" aria-labelledby="message-review-title">
      <div className="card max-h-[90vh] w-full max-w-2xl overflow-y-auto p-5 shadow-2xl">
        <p className="section-kicker">Final check</p>
        <h2 className="mt-2 text-2xl" id="message-review-title">Review before sending</h2>
        <div className="mt-4 grid gap-3 rounded-xl border border-[var(--border)] bg-black/20 p-4 text-sm">
          <ReviewRow label="Send by" value={channel === "email" ? "Email" : channel === "sms" ? "SMS" : "WhatsApp"} />
          <ReviewRow label="To" value={recipient} />
          {channel === "email" ? <ReviewRow label="Subject" value={subject || "Message from We Are Roofing"} /> : null}
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--dim)]">Message</p>
            <p className="mt-2 whitespace-pre-line text-[var(--text-primary)]">{body}</p>
          </div>
          {attachments.length ? (
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--dim)]">Attachments</p>
              <ul className="mt-2 space-y-1 text-[var(--text-primary)]">{attachments.map((item) => <li key={item.id}>• {item.display_name}</li>)}</ul>
            </div>
          ) : null}
        </div>
        <p className="mt-4 text-sm text-[var(--muted)]">Selecting confirm will send this message immediately and record it in the customer conversation and job history.</p>
        <div className="mt-5 flex justify-end gap-2">
          <button className="button-ghost" disabled={sending} onClick={onCancel} type="button">Back to edit</button>
          <button className="button-primary" disabled={sending} onClick={onConfirm} type="button">{sending ? "Sending..." : "Confirm and send"}</button>
        </div>
      </div>
    </div>
  );
}

function formatDocumentType(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] pb-2"><span className="text-[var(--muted)]">{label}</span><strong className="text-right text-[var(--text-primary)]">{value}</strong></div>;
}

function normaliseChannel(channel: ConversationChannel): DraftChannel {
  return channel === "sms" || channel === "whatsapp" ? channel : "email";
}

function applyTemplateVariables(value: string, conversation: ConversationRecord | null) {
  const customerName = conversation?.customer?.full_name?.trim() || "there";
  const firstName = customerName.split(/\s+/)[0] || customerName;
  const surveyDate = conversation?.job?.survey_date ? new Date(conversation.job.survey_date) : null;
  const replacements: Record<string, string> = {
    first_name: firstName,
    customer_name: customerName,
    job_ref: conversation?.job?.job_ref || "your project",
    address: conversation?.job?.property_address || "your property",
    survey_date: surveyDate ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(surveyDate) : "the agreed date",
    survey_time: surveyDate ? new Intl.DateTimeFormat("en-GB", { hour: "numeric", minute: "2-digit" }).format(surveyDate) : "the agreed time",
    surveyor_name: "Andy",
    start_time: "the agreed time"
  };
  return value.replace(/\{\{([a-z_]+)\}\}/gi, (_match, key: string) => replacements[key.toLowerCase()] ?? _match);
}
