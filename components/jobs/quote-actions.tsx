"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { QuoteRecord } from "@/lib/types";

type Props = {
  jobId: string;
  quote: QuoteRecord | null;
  customerEmail: string | null | undefined;
};

export function QuoteActions({ jobId, quote, customerEmail }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function runAction(action: "generate" | "approve" | "send" | "pdf") {
    setError(null);
    setSuccess(null);

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
          : {
              url: `/api/quotes/${quote?.id}/send`,
              body: {
                to_email: customerEmail,
                subject: quote?.customer_email_subject || "Your We Are Roofing quotation",
                body: quote?.customer_email_body || "Please find our quotation below."
              }
            };

    const response = await fetch(request.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request.body)
    });

    const result = (await response.json().catch(() => null)) as { ok?: boolean; error?: string; message?: string } | null;

    if (!response.ok || !result?.ok) {
      setError(result?.error || "That action could not be completed.");
      return;
    }

    setSuccess(result.message || "Action completed.");
    startTransition(() => {
      if (action === "generate" || action === "pdf" || action === "approve") {
        router.push(`/jobs/${jobId}/quote`);
      }
      router.refresh();
    });
  }

  return (
    <div className="stack">
      <div className="flex flex-wrap gap-3">
        {!quote ? (
          <button className="button-primary" disabled={isPending} onClick={() => runAction("generate")} type="button">
            {isPending ? "Creating Quote..." : "Create Quote"}
          </button>
        ) : null}
        {quote ? (
          <button className="button-ghost" disabled={isPending} onClick={() => router.push(`/jobs/${jobId}/quote`)} type="button">
            Open Quote Review
          </button>
        ) : null}
        {quote ? (
          <button className="button-secondary" disabled={isPending} onClick={() => runAction("generate")} type="button">
            {isPending ? "Refreshing..." : "Regenerate Draft"}
          </button>
        ) : null}
        {quote ? (
          <button className="button-secondary" disabled={isPending} onClick={() => runAction("pdf")} type="button">
            {isPending ? "Building PDF..." : "Generate PDF"}
          </button>
        ) : null}
        {quote && quote.status !== "Approved" && quote.status !== "Sent" ? (
          <button className="button-secondary" disabled={isPending} onClick={() => runAction("approve")} type="button">
            {isPending ? "Approving..." : "Approve Quote"}
          </button>
        ) : null}
        {quote && quote.status === "Approved" && customerEmail ? (
          <button className="button-secondary" disabled={isPending} onClick={() => runAction("send")} type="button">
            {isPending ? "Sending..." : "Send Quote"}
          </button>
        ) : null}
      </div>
      {quote && quote.status !== "Approved" ? <p className="text-sm text-[var(--muted)]">Approve the draft before sending it to the customer.</p> : null}
      {quote && !customerEmail ? <p className="text-sm text-[#ffcf7d]">Customer email is missing, so send is not available yet.</p> : null}
      {!quote ? <p className="text-sm text-[var(--muted)]">Create the first draft once the survey details are ready.</p> : null}
      {error ? <p className="text-sm text-[#ff9a91]">{error}</p> : null}
      {success ? <p className="text-sm text-[#7ce3a6]">{success}</p> : null}
    </div>
  );
}
