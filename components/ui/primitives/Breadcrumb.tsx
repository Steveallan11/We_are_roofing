import * as React from "react";
import Link from "next/link";
import type { Route } from "next";
import { cn } from "@/lib/utils";

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

type BreadcrumbProps = {
  items: BreadcrumbItem[];
  className?: string;
};

export function Breadcrumb({ items, className }: BreadcrumbProps) {
  return (
    <nav aria-label="Breadcrumb" className={cn("flex items-center gap-1.5 text-xs text-[var(--text-muted)]", className)}>
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <React.Fragment key={`${item.label}-${index}`}>
            {item.href && !isLast ? (
              <Link
                href={item.href as Route}
                className="hover:text-[var(--gold)] transition-colors truncate"
              >
                {item.label}
              </Link>
            ) : (
              <span className={cn("truncate", isLast && "text-[var(--text-second)]")}>{item.label}</span>
            )}
            {!isLast ? (
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="shrink-0 text-[var(--text-faint)]"
                aria-hidden
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
            ) : null}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
