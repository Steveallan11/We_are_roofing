import Link from "next/link";
import type { Route } from "next";

type Props = {
  compact?: boolean;
};

export function RateCardNudge({ compact = false }: Props) {
  return (
    <div className="rounded-r-2xl border border-l-4 border-[var(--gold)]/30 border-l-[var(--gold)] bg-[var(--gold)]/10 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--gold)] text-sm font-black text-black">!</div>
          <div>
            <p className="font-semibold text-[var(--gold-l)]">Rate card not set up - quotes can price at 0</p>
            {!compact ? (
              <p className="mt-1 text-sm text-[var(--muted)]">Add your unit rates once and AI quote drafts can price roof areas, runs, and materials automatically.</p>
            ) : null}
          </div>
        </div>
        <Link className="button-primary shrink-0" href={"/settings/rates" as Route}>
          Set up now
        </Link>
      </div>
    </div>
  );
}
