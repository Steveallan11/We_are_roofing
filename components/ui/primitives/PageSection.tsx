import * as React from "react";
import { cn } from "@/lib/utils";

export type PageSectionProps = React.HTMLAttributes<HTMLElement> & {
  kicker?: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  /** Render section without the wrapping `.card` background (use for transparent grouping). */
  bare?: boolean;
};

export function PageSection({
  kicker,
  title,
  description,
  actions,
  bare = false,
  className,
  children,
  ...props
}: PageSectionProps) {
  const hasHeader = kicker || title || description || actions;

  return (
    <section
      className={cn(
        "stack",
        !bare && "rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5",
        className
      )}
      {...props}
    >
      {hasHeader ? (
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            {kicker ? (
              <p className="text-[0.62rem] font-bold uppercase tracking-[0.2em] text-[var(--dim)]">
                {kicker}
              </p>
            ) : null}
            {title ? (
              <h2 className="mt-2 font-condensed text-2xl text-[var(--text)] leading-tight md:text-3xl">
                {title}
              </h2>
            ) : null}
            {description ? (
              <p className="mt-2 text-sm text-[var(--text-muted)]">{description}</p>
            ) : null}
          </div>
          {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
        </div>
      ) : null}
      {children ? <div className={cn(hasHeader && "mt-4")}>{children}</div> : null}
    </section>
  );
}
