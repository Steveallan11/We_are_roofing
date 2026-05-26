"use client";

import { useEffect, useState } from "react";
import { currency } from "@/lib/utils";
import type { JobDocumentRecord } from "@/lib/types";

type Props = {
  quoteId: string;
  quoteRef: string;
  jobTitle: string;
  total: number;
  customerName: string;
  customerEmail: string | null | undefined;
  documents?: JobDocumentRecord[];
  onClose: () => void;
  onSent: (message: string) => void;
};

export function SendQuoteModal({ quoteId, quoteRef, jobTitle, total, customerName, customerEmail, documents = [], onClose, onSent }: Props) {
  const [email, setEmail] = useState(customerEmail ?? "");
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const attachableDocuments = documents.filter(isAttachableDocument);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  async function sendQuote() {
    const nextEmail = email.trim();
    if (!nextEmail) {
      setError("Add the customer's email address before sending this quote.");
      return;
    }

    setIsSending(true);
    setError(null);
    setSuccess(null);

    const response = await fetch(`/api/quotes/${quoteId}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to_email: nextEmail, attachment_document_ids: selectedDocumentIds })
    });

    const result = (await response.json().catch(() => null)) as { ok?: boolean; error?: string; message?: string } | null;
    setIsSending(false);

    if (!response.ok || !result?.ok) {
      setError(result?.message || result?.error || "The quote could not be sent.");
      return;
    }

    const message = result.message || "Quote sent.";
    setSuccess(message);
    onSent(message);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(6,6,6,0.84)] px-4 py-6" role="dialog" aria-modal="true">
      <div className="card w-full max-w-2xl p-6 md:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="section-kicker text-[0.65rem] uppercase">Send Quote</p>
            <h3 className="mt-2 font-condensed text-3xl text-white">{quoteRef}</h3>
            <p className="mt-2 max-w-xl text-base leading-7 text-[var(--muted)]">
              Send a secure customer link with a clearer paragraph quote, bigger text, online accept button, and question box.
            </p>
          </div>
          <button className="button-ghost !px-3 !py-2 text-sm" onClick={onClose} type="button">
            Close
          </button>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-[var(--border)] bg-black/20 p-3">
            <p className="label">Quote Ref</p>
            <p className="mt-2 text-sm text-white">{quoteRef}</p>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-black/20 p-3">
            <p className="label">Job</p>
            <p className="mt-2 text-sm text-white">{jobTitle}</p>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-black/20 p-3">
            <p className="label">Total</p>
            <p className="mt-2 text-sm text-white">{currency(total)}</p>
          </div>
        </div>

        {!customerEmail ? (
          <div className="mt-5 rounded-2xl border border-[#f59e0b]/30 bg-[#f59e0b]/10 px-4 py-3">
            <p className="text-sm font-semibold text-[#ffd38b]">Warning: no email on file for {customerName}</p>
            <p className="mt-1 text-xs text-[var(--muted)]">Add the email below and we will save it while sending the quote.</p>
          </div>
        ) : null}

        <div className="mt-5">
          <label className="label" htmlFor={`quote-send-email-${quoteId}`}>
            Customer Email
          </label>
          <input
            className="field mt-2"
            id={`quote-send-email-${quoteId}`}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="customer@example.com"
            type="email"
            value={email}
          />
        </div>

        <div className="mt-5 rounded-2xl border border-[var(--gold)]/30 bg-[var(--gold)]/10 p-5">
          <p className="label text-[var(--gold)]">Customer will receive</p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {[
              ["Readable quote", "Bigger paragraphs with report, scope, and price split clearly."],
              ["Secure link", "They can view, accept, or ask a question from one page."],
              ["Clean email", "Professional branded email with the total and next step."]
            ].map(([title, body]) => (
              <div className="rounded-xl border border-[var(--border)] bg-black/20 p-3" key={title}>
                <p className="text-sm font-bold text-white">{title}</p>
                <p className="mt-1 text-xs leading-5 text-[var(--muted)]">{body}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm leading-6 text-[var(--text)]">
            This updates the job file and records the quote as sent. If the customer replies with a question, it will stay linked to this quote.
          </p>
        </div>

        <div className="mt-5 rounded-2xl border border-[var(--border)] bg-black/20 p-5">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="label">Attach job documents</p>
              <p className="mt-1 text-sm text-[var(--muted)]">Optional. These will be sent as email attachments alongside the secure quote link.</p>
            </div>
            {attachableDocuments.length > 0 ? (
              <button
                className="button-ghost !px-3 !py-2 text-sm"
                onClick={() =>
                  setSelectedDocumentIds((current) =>
                    current.length === attachableDocuments.length ? [] : attachableDocuments.map((document) => document.id)
                  )
                }
                type="button"
              >
                {selectedDocumentIds.length === attachableDocuments.length ? "Clear all" : "Select all"}
              </button>
            ) : null}
          </div>
          {attachableDocuments.length > 0 ? (
            <div className="mt-4 grid gap-2">
              {attachableDocuments.map((document) => {
                const selected = selectedDocumentIds.includes(document.id);
                return (
                  <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--border)] bg-black/20 p-3" key={document.id}>
                    <input
                      checked={selected}
                      className="mt-1"
                      onChange={(event) =>
                        setSelectedDocumentIds((current) =>
                          event.target.checked ? [...current, document.id] : current.filter((id) => id !== document.id)
                        )
                      }
                      type="checkbox"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-white">{document.display_name}</span>
                      <span className="mt-1 block text-xs text-[var(--muted)]">
                        {getDocumentTypeLabel(document)}{document.file_size ? ` | ${formatFileSize(document.file_size)}` : ""}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          ) : (
            <p className="mt-4 text-sm text-[var(--muted)]">No attachable uploaded documents on this job yet. Add PDFs, reports, or supplier files from the job file Documents card.</p>
          )}
        </div>

        {error ? <p className="mt-4 text-sm text-[#ff9a91]">{error}</p> : null}
        {success ? <p className="mt-4 text-sm text-[#7ce3a6]">{success}</p> : null}

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button className="button-ghost" disabled={isSending} onClick={onClose} type="button">
            Cancel
          </button>
          <button className="button-primary" disabled={isSending} onClick={sendQuote} type="button">
            {isSending ? "Sending..." : "Send secure quote link"}
          </button>
        </div>
      </div>
    </div>
  );
}

function isAttachableDocument(document: JobDocumentRecord) {
  if (!document.storage_bucket || !document.storage_path) return false;
  if (document.mime_type?.includes("text/html")) return false;
  return !["quote_html", "invoice_html"].includes(document.document_type);
}

function getDocumentTypeLabel(document: JobDocumentRecord) {
  if (document.source_type === "uploaded") return "Uploaded document";
  if (document.document_type === "quote_pdf") return "Quote PDF";
  if (document.document_type === "invoice_pdf") return "Invoice PDF";
  if (document.document_type === "survey_snapshot") return "Survey snapshot";
  return document.document_type.replace(/_/g, " ");
}

function formatFileSize(size: number) {
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}
