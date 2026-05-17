import Link from "next/link";
import type { Route } from "next";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { getContextDateLabel, getNextAction, getSecondaryAction, needsAttention } from "@/lib/jobs/nextAction";
import { getStatusColor } from "@/lib/jobs/statusColors";
import { currency } from "@/lib/utils";
import type { Customer, Job, QuoteRecord } from "@/lib/types";

type Props = {
  job: Job & {
    customer?: Customer | null;
    quote?: QuoteRecord | null;
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
