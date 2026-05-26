"use client";

import { BrandLogo } from "@/components/ui/brand-logo";
import { SendQuoteModal } from "@/components/quotes/SendQuoteModal";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { JobDocumentRecord, QuoteRecord } from "@/lib/types";

type Props = {
  jobId: string;
  quote: QuoteRecord | null;
  jobTitle: string;
  customerName: string;
  customerEmail: string | null | undefined;
  documents?: JobDocumentRecord[];
};

export function QuoteActions({ jobId, quote, jobTitle, customerName, customerEmail, documents = [] }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [activeAction, setActiveAction] = useState<"generate" | "approve" | "send" | "pdf" | null>(null);
  const [overlayDismissed, setOverlayDismissed] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);

  const workingCopy =
    activeAction === "generate"
      ? {
          title: "Generating Quote",
          subtitle: "The system is checking your survey, past quotes, pricing rules, and house style before building the draft.",
          steps: [
            "Reading the saved survey and job details",
            "Checking historical quotes and pricing anchors",
            "Writing the roof report, scope, and customer email"
          ]
        }
      : activeAction === "pdf"
        ? {
            title: "Building Quote Pack",
            subtitle: "Creating the latest document snapshot and PDF for the job file.",
            steps: ["Preparing quote wording", "Building the customer document", "Saving the PDF into the job file"]
          }
        : activeAction === "approve"
          ? {
              title: "Approving Quote",
              subtitle: "Locking the current draft and moving it into the ready-to-send stage.",
              steps: ["Checking the saved totals", "Updating the quote status", "Preparing the customer-ready version"]
            }
          : activeAction === "send"
            ? {
                title: "Sending Quote",
                subtitle: "Packaging the approved quote and sending it to the customer email on file.",
                steps: ["Preparing the email", "Attaching the latest quote document", "Logging the send inside the job file"]
              }
            : null;

  async function runAction(action: "generate" | "approve" | "send" | "pdf") {
    setError(null);
    setSuccess(null);
    setActiveAction(action);
    setOverlayDismissed(false);

    const request =
      action === "generate"
        ? {
            url: "/api/ai/generate-quote",
            body: { job_id: jobId }
          }
        : action === "approve"
          ? {
              url: `/api/quotes/${quote?.id}/approve`,
              body: {}
            }
          : action === "pdf"
            ? {
                url: `/api/quotes/${quote?.id}/pdf`,
                body: {}
              }
          : null;

    if (!request) {
      setActiveAction(null);
      setShowSendModal(true);
      return;
    }

    const response = await fetch(request.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request.body)
    });

    const result = (await response.json().catch(() => null)) as { ok?: boolean; error?: string; message?: string; warning?: string | null } | null;

    if (!response.ok || !result?.ok) {
      setActiveAction(null);
      setError(result?.error || "That action could not be completed.");
      return;
    }

    setSuccess([result.message, result.warning].filter(Boolean).join(" ") || "Action completed.");
    startTransition(() => {
      if (action === "generate" || action === "pdf" || action === "approve") {
        router.push(`/jobs/${jobId}/quote`);
      }
      router.refresh();
    });
  }

  return (
    <div className="stack">
      {workingCopy && !overlayDismissed ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(6,6,6,0.88)] px-4">
          <div className="card w-full max-w-xl p-6 text-center shadow-2xl">
            <div className="flex justify-end">
              <button
                className="button-ghost !px-3 !py-2 text-sm"
                onClick={() => setOverlayDismissed(true)}
                type="button"
              >
                Keep in background
              </button>
            </div>
            <div className="flex justify-center">
              <BrandLogo size="lg" />
            </div>
            <p className="section-kicker mt-4 text-[0.7rem] uppercase">We Are Roofing Quote Engine</p>
            <h3 className="mt-3 font-display text-4xl text-[var(--gold-l)]">{workingCopy.title}</h3>
            <p className="mx-auto mt-3 max-w-lg text-sm text-[var(--muted)]">{workingCopy.subtitle}</p>

            <div className="quote-engine-pulse mt-6" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>

            <div className="mt-6 space-y-3 text-left">
              {workingCopy.steps.map((step, index) => (
                <div className="surface-muted rounded-2xl border p-3" key={step}>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--gold-d)]">Step {index + 1}</p>
                  <p className="mt-1 text-sm text-[var(--text)]">{step}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {workingCopy && overlayDismissed ? (
        <div className="surface-muted rounded-2xl border p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[var(--gold-l)]">{workingCopy.title}</p>
              <p className="mt-1 text-sm text-[var(--muted)]">{workingCopy.subtitle}</p>
            </div>
            <button className="button-ghost !px-3 !py-2 text-sm" onClick={() => setOverlayDismissed(false)} type="button">
              Show Status
            </button>
          </div>
        </div>
      ) : null}

      <div className="fixed bottom-[calc(var(--bottomnav-height)+10px+env(safe-area-inset-bottom))] left-3 right-3 z-40 flex gap-2 overflow-x-auto rounded-2xl border border-[var(--border-mid)] bg-[rgba(10,10,10,0.94)] p-2 shadow-2xl backdrop-blur lg:static lg:flex-wrap lg:overflow-visible lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none lg:backdrop-blur-0">
        {!quote ? (
          <button className="button-primary shrink-0" disabled={isPending} onClick={() => runAction("generate")} type="button">
            {isPending ? "Creating Quote..." : "Create Quote"}
          </button>
        ) : null}
        {quote ? (
          <button className="button-ghost shrink-0 hidden lg:inline-flex" disabled={isPending} onClick={() => router.push(`/jobs/${jobId}/quote`)} type="button">
            Open Quote
          </button>
        ) : null}
        {quote ? (
          <button className="button-primary shrink-0" disabled={isPending} onClick={() => router.push(`/jobs/${jobId}/quote/preview`)} type="button">
            Preview
          </button>
        ) : null}
        {quote ? (
          <button className="button-secondary shrink-0" disabled={isPending} onClick={() => runAction("generate")} type="button">
            {isPending ? "Refreshing..." : "Regenerate"}
          </button>
        ) : null}
        {quote ? (
          <button className="button-secondary shrink-0" disabled={isPending} onClick={() => runAction("pdf")} type="button">
            {isPending ? "Building PDF..." : "PDF"}
          </button>
        ) : null}
        {quote && quote.status !== "Approved" && quote.status !== "Sent" ? (
          <button className="button-secondary shrink-0" disabled={isPending} onClick={() => runAction("approve")} type="button">
            {isPending ? "Approving..." : "Approve"}
          </button>
        ) : null}
        {quote && (quote.status === "Approved" || quote.status === "Sent") ? (
          <button className="button-secondary shrink-0" disabled={isPending} onClick={() => setShowSendModal(true)} type="button">
            {quote.status === "Sent" ? "Resend" : "Send"}
          </button>
        ) : null}
      </div>
      {quote && quote.status !== "Approved" && quote.status !== "Sent" ? <p className="text-sm text-[var(--muted)]">Approve the draft before sending it to the customer.</p> : null}
      {quote && !customerEmail ? <p className="text-sm text-[#ffcf7d]">Customer email is missing. Use Send Quote to add it and send in one step.</p> : null}
      {!quote ? <p className="text-sm text-[var(--muted)]">Create the first draft once the survey details are ready.</p> : null}
      {error ? <p className="text-sm text-[#ff9a91]">{error}</p> : null}
      {success ? <p className="text-sm text-[#7ce3a6]">{success}</p> : null}
      {quote && showSendModal ? (
        <SendQuoteModal
          customerEmail={customerEmail}
          customerName={customerName}
          documents={documents}
          jobTitle={jobTitle}
          onClose={() => setShowSendModal(false)}
          onSent={(message) => {
            setShowSendModal(false);
            setSuccess(message);
            setError(null);
            startTransition(() => router.refresh());
          }}
          quoteId={quote.id}
          quoteRef={quote.quote_ref}
          total={Number(quote.total ?? 0)}
        />
      ) : null}
    </div>
  );
}
