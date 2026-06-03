import Link from "next/link";
import type { Route } from "next";
import type { Customer, Job, QuoteRecord } from "@/lib/types";
import { getNextAction, getAttentionReason, needsAttention } from "@/lib/jobs/nextAction";
import { getJobStage } from "@/lib/jobs/statusColors";
import { cn } from "@/lib/utils";

type Props = {
  job: Job & { customer?: Customer | null; quote?: QuoteRecord | null };
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
  className?: string;
  showWhyLabel?: boolean;
};

/**
 * Single, status-aware next-action button.
 * Use anywhere a job is on screen: card, file header, mobile sticky bar.
 * Colour reflects urgency (attention) or stage.
 */
export function NextActionButton({ job, size = "md", fullWidth = false, className, showWhyLabel = false }: Props) {
  const action = getNextAction(job);
  const urgent = needsAttention(job);
  const stage = getJobStage(job.status);
  const tone = pickTone(urgent, stage);
  const classes = cn(
    "inline-flex items-center justify-center gap-2 rounded-lg font-semibold uppercase tracking-wider transition-colors",
    SIZE_CLASSES[size],
    TONE_CLASSES[tone],
    fullWidth && "w-full",
    className
  );

  const content =
    showWhyLabel && urgent ? (
      <span className="flex flex-col items-center gap-0.5 text-center leading-tight">
        <span>{action.label}</span>
        <span className="text-[10px] font-normal normal-case tracking-normal opacity-90">{getAttentionReason(job)}</span>
      </span>
    ) : (
      <span>{action.label}</span>
    );

  // tel: links must use raw <a> (Next Link rejects them)
  if (action.href.startsWith("tel:") || action.href.startsWith("mailto:")) {
    return (
      <a href={action.href} className={classes}>
        {content}
      </a>
    );
  }

  return (
    <Link href={action.href as Route} className={classes}>
      {content}
    </Link>
  );
}

type Tone = "alert" | "primary" | "ready" | "active" | "complete";

function pickTone(urgent: boolean, stage: ReturnType<typeof getJobStage>): Tone {
  if (urgent) return "alert";
  if (stage === "ready") return "ready";
  if (stage === "active") return "active";
  if (stage === "complete") return "complete";
  return "primary";
}

const SIZE_CLASSES: Record<NonNullable<Props["size"]>, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2.5 text-sm",
  lg: "px-5 py-3 text-base"
};

const TONE_CLASSES: Record<Tone, string> = {
  alert: "bg-[var(--stage-alert)] text-white hover:opacity-90",
  primary: "bg-[var(--gold)] text-black hover:bg-[var(--gold-l)]",
  ready: "bg-[var(--stage-ready)] text-black hover:opacity-90",
  active: "bg-[var(--stage-active)] text-white hover:opacity-90",
  complete: "bg-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)]"
};
