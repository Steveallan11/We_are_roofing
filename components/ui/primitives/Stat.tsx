import * as React from "react";
import Link from "next/link";
import type { Route } from "next";
import { cn } from "@/lib/utils";

type StatTone = "default" | "alert" | "pending" | "ready" | "active" | "complete";

const TONE_CLASS: Record<StatTone, string> = {
  default: "border-[var(--border)] bg-[var(--surface)]",
  alert: "border-[var(--stage-alert-border)] bg-[var(--stage-alert-bg)]",
  pending: "border-[var(--stage-pending-border)] bg-[var(--stage-pending-bg)]",
  ready: "border-[var(--stage-ready-border)] bg-[var(--stage-ready-bg)]",
  active: "border-[var(--stage-active-border)] bg-[var(--stage-active-bg)]",
  complete: "border-[var(--stage-complete-border)] bg-[var(--stage-complete-bg)]"
};

const TONE_VALUE_CLASS: Record<StatTone, string> = {
  default: "text-[var(--text)]",
  alert: "text-[var(--stage-alert-text)]",
  pending: "text-[var(--stage-pending-text)]",
  ready: "text-[var(--stage-ready-text)]",
  active: "text-[var(--stage-active-text)]",
  complete: "text-[var(--stage-complete-text)]"
};

export type StatProps = {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: StatTone;
  href?: string;
  icon?: React.ReactNode;
  trend?: { value: string; direction: "up" | "down" | "neutral" };
  className?: string;
};

export function Stat({ label, value, hint, tone = "default", href, icon, trend, className }: StatProps) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[0.62rem] font-bold uppercase tracking-[0.2em] text-[var(--dim)]">{label}</p>
        {icon ? <span className="shrink-0 text-[var(--text-muted)]">{icon}</span> : null}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <p className={cn("font-display text-2xl font-semibold leading-none", TONE_VALUE_CLASS[tone])}>{value}</p>
        {trend ? (
          <span
            className={cn(
              "text-xs font-semibold",
              trend.direction === "up" && "text-[var(--stage-active-text)]",
              trend.direction === "down" && "text-[var(--stage-alert-text)]",
              trend.direction === "neutral" && "text-[var(--text-muted)]"
            )}
          >
            {trend.direction === "up" ? "↑" : trend.direction === "down" ? "↓" : "→"} {trend.value}
          </span>
        ) : null}
      </div>
      {hint ? <p className="mt-1 truncate text-xs text-[var(--text-muted)]">{hint}</p> : null}
    </>
  );

  const baseClass = cn(
    "block rounded-xl border p-4 transition-colors duration-150",
    TONE_CLASS[tone],
    href && "hover:border-[var(--gold)]",
    className
  );

  if (href) {
    if (href.startsWith("tel:") || href.startsWith("mailto:") || href.startsWith("http")) {
      return (
        <a href={href} className={baseClass}>
          {content}
        </a>
      );
    }
    return (
      <Link href={href as Route} className={baseClass}>
        {content}
      </Link>
    );
  }

  return <div className={baseClass}>{content}</div>;
}
