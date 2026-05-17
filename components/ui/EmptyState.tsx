import Link from "next/link";
import type { Route } from "next";

type Props = {
  title: string;
  message: string;
  actionLabel?: string;
  actionHref?: string;
};

export function EmptyState({ title, message, actionLabel, actionHref }: Props) {
  return (
    <div className="card flex flex-col items-center justify-center p-8 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--border)] bg-black/20 text-2xl">▣</div>
      <h3 className="mt-4 font-display text-3xl text-[var(--gold-l)]">{title}</h3>
      <p className="mt-2 max-w-md text-sm text-[var(--muted)]">{message}</p>
      {actionLabel && actionHref ? (
        <Link className="button-primary mt-5" href={actionHref as Route}>
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}
