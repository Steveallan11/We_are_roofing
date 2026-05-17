"use client";

import Link from "next/link";
import type { Route } from "next";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { currency, formatDate } from "@/lib/utils";
import type { Customer, InvoiceRecord, Job, JobDocumentRecord, QuoteRecord } from "@/lib/types";

type MoneyJob = Job & {
  customer?: Customer | null;
  quote?: QuoteRecord | null;
  documents?: JobDocumentRecord[] | null;
  invoices?: InvoiceRecord[] | null;
};

type Props = {
  jobs: MoneyJob[];
};

export function MoneyWorkspace({ jobs }: Props) {
  const [tab, setTab] = useState<"quotes" | "invoices">("quotes");
  const quotes = useMemo(() => jobs.flatMap((job) => (job.quote ? [{ job, quote: job.quote }] : [])), [jobs]);
  const invoices = useMemo(
    () =>
      jobs.flatMap((job) =>
        (job.invoices ?? []).map((invoice) => ({
          job,
          invoice
        }))
      ),
    [jobs]
  );
  const pricingNeeded = quotes.some(({ quote }) => Number(quote.total ?? 0) === 0 || quote.cost_breakdown?.some((item) => Number(item.cost ?? 0) === 0));
  const draftCount = quotes.filter(({ quote }) => quote.status === "Draft" || quote.status === "Needs Review").length;
  const readyCount = quotes.filter(({ quote }) => quote.status === "Approved").length;
  const sentCount = quotes.filter(({ quote }) => quote.status === "Sent").length;
  const acceptedCount = quotes.filter(({ quote }) => quote.status === "Accepted").length;
  const outstandingInvoices = invoices.filter(({ invoice }) => !["Paid", "Void"].includes(invoice.status));
  const invoiceTotal = outstandingInvoices.reduce((sum, { invoice }) => sum + Number(invoice.balance_due ?? invoice.total ?? 0), 0);

  return (
    <div className="stack">
      {pricingNeeded ? (
        <div className="card border-[var(--gold)]/50 bg-[var(--gold)]/10 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-semibold text-[var(--gold-l)]">Rate Card needs attention</p>
              <p className="mt-1 text-sm text-[var(--muted)]">Some quotes have £0 line items. Add rates so future quotes price themselves properly.</p>
            </div>
            <Link className="button-secondary" href={"/settings/rates" as Route}>
              Set up Rate Card
            </Link>
          </div>
        </div>
      ) : null}

      <section className="grid gap-3 md:grid-cols-4">
        <MoneyStat label="Draft / Review" value={draftCount.toString()} />
        <MoneyStat label="Ready To Send" value={readyCount.toString()} />
        <MoneyStat label="Sent Quotes" value={sentCount.toString()} />
        <MoneyStat label="Outstanding" value={currency(invoiceTotal)} danger={invoiceTotal > 0} />
      </section>

      <div className="flex flex-col gap-3 rounded-[1.5rem] border border-[var(--border)] bg-black/20 p-2 md:flex-row md:items-center md:justify-between">
        <div className="flex rounded-2xl border border-[var(--border)] bg-black/20 p-1">
          <button className={tab === "quotes" ? "rounded-xl bg-[var(--gold)] px-4 py-2 text-sm font-bold text-black" : "rounded-xl px-4 py-2 text-sm font-semibold text-[var(--muted)]"} onClick={() => setTab("quotes")} type="button">
            Quotes ({quotes.length})
          </button>
          <button className={tab === "invoices" ? "rounded-xl bg-[var(--gold)] px-4 py-2 text-sm font-bold text-black" : "rounded-xl px-4 py-2 text-sm font-semibold text-[var(--muted)]"} onClick={() => setTab("invoices")} type="button">
            Invoices ({invoices.length})
          </button>
        </div>
        <p className="px-2 text-sm text-[var(--muted)]">
          {acceptedCount} accepted quote{acceptedCount === 1 ? "" : "s"} ready to become invoice work.
        </p>
      </div>

      {tab === "quotes" ? <QuotesTab quotes={quotes} /> : <InvoicesTab invoices={invoices} />}
    </div>
  );
}

function QuotesTab({ quotes }: { quotes: Array<{ job: MoneyJob; quote: QuoteRecord }> }) {
  if (quotes.length === 0) {
    return <EmptyState actionHref="/jobs" actionLabel="Open Jobs" message="Generate a quote from a completed survey and it will appear here." title="No quotes yet" />;
  }

  return (
    <div className="grid gap-3">
      {quotes.map(({ job, quote }) => {
        const zeroLines = quote.cost_breakdown?.filter((line) => Number(line.cost ?? 0) === 0) ?? [];
        return (
          <article className="card p-4" key={quote.id}>
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={quote.status} />
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--dim)]">{quote.quote_ref}</span>
                  <span className="text-xs text-[var(--muted)]">{job.job_ref ?? "WR-J-TBC"}</span>
                </div>
                <h3 className="mt-3 text-lg font-semibold text-white">{job.job_title}</h3>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {job.customer?.full_name ?? "Customer missing"} | {job.customer?.town ?? job.postcode ?? "Town TBC"}
                </p>
                {zeroLines.length > 0 ? (
                  <p className="mt-3 rounded-2xl border border-[var(--gold)]/35 bg-[var(--gold)]/10 px-3 py-2 text-sm text-[var(--gold-l)]">
                    Pricing needed for {zeroLines.slice(0, 3).map((line) => line.item).join(", ")}
                  </p>
                ) : null}
              </div>
              <div className="shrink-0 text-left md:text-right">
                <p className="font-display text-3xl text-[var(--gold-l)]">{currency(Number(quote.total ?? 0))}</p>
                <p className="mt-1 text-xs text-[var(--muted)]">{quote.sent_at ? `Sent ${formatDate(quote.sent_at)}` : `Created ${formatDate(quote.created_at)}`}</p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link className="button-primary !px-4 !py-2 text-sm" href={`/jobs/${job.id}/quote` as Route}>
                {getQuoteActionLabel(quote)}
              </Link>
              <Link className="button-ghost !px-4 !py-2 text-sm" href={`/jobs/${job.id}` as Route}>
                Open Job File
              </Link>
              {quote.pdf_url ? (
                <a className="button-ghost !px-4 !py-2 text-sm" href={quote.pdf_url} rel="noreferrer" target="_blank">
                  Open PDF
                </a>
              ) : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}

function InvoicesTab({ invoices }: { invoices: Array<{ job: MoneyJob; invoice: InvoiceRecord }> }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function markPaid(invoice: InvoiceRecord) {
    setMessage(null);
    setError(null);
    setActiveId(invoice.id);
    const response = await fetch(`/api/invoices/${invoice.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "Paid", amount_paid: invoice.total, payment_method: "Manual" })
    });
    const result = (await response.json().catch(() => null)) as { ok?: boolean; message?: string; error?: string } | null;
    setActiveId(null);
    if (!response.ok || !result?.ok) {
      setError(result?.error || "Invoice could not be marked paid.");
      return;
    }
    setMessage(result.message || "Invoice marked paid.");
    startTransition(() => router.refresh());
  }

  if (invoices.length === 0) {
    return <EmptyState actionHref="/jobs" actionLabel="Open Jobs" message="Create invoices from approved quotes and they will file here." title="No invoices yet" />;
  }

  return (
    <div className="grid gap-3">
      {message ? <p className="rounded-2xl border border-[#10b981]/30 bg-[#10b981]/10 px-4 py-3 text-sm text-[#7ce3a6]">{message}</p> : null}
      {error ? <p className="rounded-2xl border border-[#ef4444]/30 bg-[#ef4444]/10 px-4 py-3 text-sm text-[#ff9a91]">{error}</p> : null}
      {invoices.map(({ job, invoice }) => (
        <article className="card p-4" key={invoice.id}>
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <InvoiceBadge status={invoice.status} />
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--dim)]">{invoice.invoice_ref}</span>
                <span className="text-xs text-[var(--muted)]">{job.job_ref ?? "WR-J-TBC"}</span>
              </div>
              <h3 className="mt-3 text-lg font-semibold text-white">{job.customer?.full_name ?? job.job_title}</h3>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Due {formatDate(invoice.due_date)} | Balance {currency(Number(invoice.balance_due ?? 0))}
              </p>
            </div>
            <div className="text-left md:text-right">
              <p className="font-display text-3xl text-[var(--gold-l)]">{currency(Number(invoice.total ?? 0))}</p>
              <p className="mt-1 text-xs text-[var(--muted)]">Issued {formatDate(invoice.issue_date ?? invoice.created_at)}</p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {invoice.pdf_url ? (
              <a className="button-primary !px-4 !py-2 text-sm" href={invoice.pdf_url} rel="noreferrer" target="_blank">
                Open PDF
              </a>
            ) : (
              <Link className="button-primary !px-4 !py-2 text-sm" href={`/jobs/${job.id}` as Route}>
                Open Invoice
              </Link>
            )}
            {invoice.status !== "Paid" && invoice.status !== "Void" ? (
              <button className="button-secondary !px-4 !py-2 text-sm" disabled={isPending || activeId === invoice.id} onClick={() => markPaid(invoice)} type="button">
                {activeId === invoice.id ? "Updating..." : "Mark Paid"}
              </button>
            ) : null}
            <Link className="button-ghost !px-4 !py-2 text-sm" href={`/jobs/${job.id}` as Route}>
              Open Job File
            </Link>
          </div>
        </article>
      ))}
    </div>
  );
}

function MoneyStat({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className={`card p-4 ${danger ? "border-[#ef4444]/50 bg-[#ef4444]/10" : ""}`}>
      <p className="text-[0.65rem] font-bold uppercase tracking-[0.22em] text-[var(--dim)]">{label}</p>
      <p className={`mt-2 font-display text-3xl leading-none ${danger ? "text-[#ffb3ad]" : "text-[var(--gold-l)]"}`}>{value}</p>
    </div>
  );
}

function getQuoteActionLabel(quote: QuoteRecord) {
  if (quote.status === "Draft" || quote.status === "Needs Review") return "Review & Price";
  if (quote.status === "Approved") return "Send Quote";
  if (quote.status === "Sent") return "Chase Up";
  if (quote.status === "Accepted") return "Create Invoice";
  return "Open Quote";
}

function InvoiceBadge({ status }: { status: InvoiceRecord["status"] }) {
  const className =
    status === "Paid"
      ? "border-[#10b981]/40 bg-[#10b981]/10 text-[#7ce3a6]"
      : status === "Overdue"
        ? "border-[#ef4444]/40 bg-[#ef4444]/10 text-[#ff9a91]"
        : status === "Void"
          ? "border-white/10 bg-white/5 text-[var(--muted)]"
          : "border-[var(--gold)]/35 bg-[var(--gold)]/10 text-[var(--gold-l)]";
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${className}`}>{status}</span>;
}
