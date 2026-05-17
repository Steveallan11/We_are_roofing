import Link from "next/link";
import type { Route } from "next";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { getContextDateLabel, getNextAction, getSecondaryAction, needsAttention } from "@/lib/jobs/nextAction";
import { getStatusColor } from "@/lib/jobs/statusColors";
import { currency } from "@/lib/utils";
import type { Customer, InvoiceRecord, Job, JobDocumentRecord, QuoteRecord } from "@/lib/types";

type Props = {
  job: Job & {
    customer?: Customer | null;
    quote?: QuoteRecord | null;
    documents?: JobDocumentRecord[] | null;
    invoices?: InvoiceRecord[] | null;
  };
  compact?: boolean;
  list?: boolean;
};

export function JobCard({ job, compact = false, list = false }: Props) {
  const primaryAction = getNextAction(job);
  const secondaryAction = getSecondaryAction(job);
  const attention = needsAttention(job);
  const initials = (job.customer?.full_name ?? job.job_title)
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const town = job.customer?.town ?? job.postcode ?? "Town TBC";
  const statusColor = getStatusColor(job.status);
  const documentLinks = getDocumentLinks(job);

  return (
    <article
      className={`card overflow-hidden transition hover:-translate-y-0.5 ${list ? "border-l-4" : ""}`}
      style={{ borderColor: attention ? "#ef4444" : statusColor.dot }}
    >
      <div className={compact ? "p-3" : "p-4"}>
        <div className="flex items-start gap-3">
          <div
            className={`flex shrink-0 items-center justify-center border border-[var(--border)] bg-black/30 font-bold text-[var(--gold-l)] ${
              compact ? "h-9 w-9 rounded-xl text-xs" : "h-12 w-12 rounded-2xl text-sm"
            }`}
          >
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className={`${compact ? "text-sm" : "text-lg"} line-clamp-2 font-semibold text-white`}>{job.job_title}</h3>
                <p className="mt-1 truncate text-xs text-[var(--muted)]">
                  {job.job_ref ?? "WR-J-TBC"} | {job.customer?.full_name ?? "Customer missing"} | {town}
                </p>
              </div>
              {!compact ? (
                <div className="shrink-0">
                  <StatusBadge status={job.status} />
                </div>
              ) : null}
            </div>
          </div>
          {attention ? <span className="mt-1 h-3 w-3 rounded-full bg-[#ef4444] shadow-[0_0_18px_rgba(239,68,68,0.75)]" /> : null}
        </div>

        <div className={`${compact ? "mt-3" : "mt-4"} grid gap-2 text-sm text-[var(--muted)]`}>
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-black/20 px-3 py-2">
            <span>
              {roofLabel(job.roof_type)} {job.roof_type ? "" : "TBC"}
            </span>
            <span>{getContextDateLabel(job)}</span>
          </div>
          {documentLinks.length > 0 ? <DocumentQuickLinks compact={compact} jobId={job.id} links={documentLinks} /> : null}
          {attention && !compact ? (
            <p className="rounded-2xl border border-[#ef4444]/40 bg-[#ef4444]/10 px-3 py-2 text-sm text-[#ffb3ad]">Needs attention before this gets forgotten.</p>
          ) : null}
        </div>

        <div className={`${compact ? "mt-3" : "mt-4"} flex items-center gap-3`}>
          <ActionLink className="button-primary min-h-11 flex-1 !rounded-xl !px-3 !py-2 text-sm" href={primaryAction.href}>
            {primaryAction.label}
          </ActionLink>
          {!compact ? (
            <ActionLink className="button-ghost min-h-11 flex-1 !rounded-xl !px-3 !py-2 text-sm" href={secondaryAction.href || `/jobs/${job.id}`}>
              {secondaryAction.label}
            </ActionLink>
          ) : null}
        </div>
      </div>

      <div className={`${compact ? "px-3 py-2" : "px-4 py-3"} flex items-center justify-between border-t border-[var(--border)] bg-black/20`}>
        <Link className="text-xs text-[var(--muted)] underline-offset-4 hover:text-[var(--gold-l)] hover:underline" href={`/jobs/${job.id}` as Route}>
          Open job file
        </Link>
        <p className={`${compact ? "text-lg" : "text-2xl"} text-right font-display text-[var(--gold-l)]`}>{job.estimated_value ? currency(job.estimated_value) : "TBC"}</p>
      </div>
    </article>
  );
}

function roofLabel(value?: string | null) {
  const lower = value?.toLowerCase() ?? "";
  if (lower.includes("flat")) return "Flat roof";
  if (lower.includes("chimney")) return "Chimney";
  if (lower.includes("fascia") || lower.includes("gutter")) return "Roofline";
  if (lower.includes("slate")) return "Slate roof";
  if (lower.includes("tile") || lower.includes("pitched")) return "Pitched roof";
  return "Roof type";
}

type DocumentLink = {
  label: string;
  href?: string | null;
  external: boolean;
};

function getDocumentLinks(
  job: Job & {
    quote?: QuoteRecord | null;
    documents?: JobDocumentRecord[] | null;
    invoices?: InvoiceRecord[] | null;
  }
): DocumentLink[] {
  const links: DocumentLink[] = [];

  if (job.quote?.pdf_url) {
    links.push({ label: "Quote PDF", href: job.quote.pdf_url, external: true });
  }

  for (const invoice of job.invoices ?? []) {
    if (invoice.pdf_url) {
      links.push({ label: invoice.invoice_ref || "Invoice PDF", href: invoice.pdf_url, external: true });
    }
  }

  for (const document of job.documents ?? []) {
    links.push({
      label: getDocumentLabel(document),
      href: document.public_url || null,
      external: Boolean(document.public_url)
    });
  }

  const seen = new Set<string>();
  return links.filter((link) => {
    const key = `${link.label}:${link.href ?? "job-file"}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getDocumentLabel(document: JobDocumentRecord) {
  if (document.document_type === "survey_snapshot") return "Survey";
  if (document.document_type === "quote_pdf") return "Quote PDF";
  if (document.document_type === "quote_html") return "Quote";
  if (document.document_type === "invoice_pdf") return "Invoice PDF";
  if (document.document_type === "invoice_html") return "Invoice";
  return document.display_name || "Document";
}

function DocumentQuickLinks({ compact, jobId, links }: { compact: boolean; jobId: string; links: DocumentLink[] }) {
  const visible = links.slice(0, compact ? 2 : 4);
  const hiddenCount = links.length - visible.length;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--border)] bg-black/20 px-3 py-2">
      <span className="text-[0.65rem] font-bold uppercase tracking-[0.18em] text-[var(--dim)]">Docs</span>
      {visible.map((link, index) =>
        link.external && link.href ? (
          <a
            className="rounded-full border border-[var(--gold)]/25 bg-[var(--gold)]/10 px-2.5 py-1 text-xs font-semibold text-[var(--gold-l)] hover:border-[var(--gold)]"
            href={link.href}
            key={`${link.label}-${index}`}
            rel="noreferrer"
            target="_blank"
          >
            {link.label}
          </a>
        ) : (
          <Link
            className="rounded-full border border-[var(--gold)]/25 bg-[var(--gold)]/10 px-2.5 py-1 text-xs font-semibold text-[var(--gold-l)] hover:border-[var(--gold)]"
            href={`/jobs/${jobId}` as Route}
            key={`${link.label}-${index}`}
          >
            {link.label}
          </Link>
        )
      )}
      {hiddenCount > 0 ? (
        <Link className="text-xs text-[var(--muted)] underline-offset-4 hover:text-[var(--gold-l)] hover:underline" href={`/jobs/${jobId}` as Route}>
          +{hiddenCount} more
        </Link>
      ) : null}
    </div>
  );
}

function ActionLink({ className, href, children }: { className: string; href: string; children: React.ReactNode }) {
  if (href.startsWith("tel:")) {
    return (
      <a className={className} href={href}>
        {children}
      </a>
    );
  }

  return (
    <Link className={className} href={href as Route}>
      {children}
    </Link>
  );
}
