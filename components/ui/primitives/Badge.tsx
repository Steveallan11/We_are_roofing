import * as React from "react";
import { cn } from "@/lib/utils";

type BadgeVariant = "neutral" | "alert" | "pending" | "ready" | "active" | "complete" | "gold";
type BadgeSize = "sm" | "md";

const VARIANT_CLASS: Record<BadgeVariant, string> = {
  neutral: "border-[var(--border)] bg-[var(--elevated)] text-[var(--text-muted)]",
  alert: "border-[var(--stage-alert-border)] bg-[var(--stage-alert-bg)] text-[var(--stage-alert-text)]",
  pending: "border-[var(--stage-pending-border)] bg-[var(--stage-pending-bg)] text-[var(--stage-pending-text)]",
  ready: "border-[var(--stage-ready-border)] bg-[var(--stage-ready-bg)] text-[var(--stage-ready-text)]",
  active: "border-[var(--stage-active-border)] bg-[var(--stage-active-bg)] text-[var(--stage-active-text)]",
  complete: "border-[var(--stage-complete-border)] bg-[var(--stage-complete-bg)] text-[var(--stage-complete-text)]",
  gold: "border-[var(--gold)] bg-[var(--gold)] text-black"
};

const SIZE_CLASS: Record<BadgeSize, string> = {
  sm: "px-2 py-0.5 text-[0.62rem]",
  md: "px-2.5 py-1 text-xs"
};

export type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
};

export function Badge({
  variant = "neutral",
  size = "md",
  dot = false,
  className,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-bold uppercase tracking-[0.14em]",
        VARIANT_CLASS[variant],
        SIZE_CLASS[size],
        className
      )}
      {...props}
    >
      {dot ? <span className="inline-block h-1.5 w-1.5 rounded-full bg-current" aria-hidden /> : null}
      {children}
    </span>
  );
}
