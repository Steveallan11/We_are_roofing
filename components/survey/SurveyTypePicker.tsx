import Link from "next/link";
import type { Route } from "next";

export function SurveyTypePicker({ jobId }: { jobId: string }) {
  return (
    <div className="grid gap-3">
      <Link
        className="group block rounded-2xl bg-[var(--gold)] p-5 text-black shadow-[0_14px_35px_rgba(212,175,55,0.18)] transition hover:opacity-90 active:scale-[0.99]"
        href={`/jobs/${jobId}/survey/video` as Route}
      >
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-black/15">
            <svg fill="none" height="24" stroke="#000" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="24">
              <path d="M15 10l4.553-2.069A1 1 0 0121 8.882v6.236a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-ui text-base font-extrabold">AI Video Survey</p>
            <p className="mt-1 text-sm text-black/70">Film the roof, import a gallery clip, or use glasses footage. AI fills the survey draft.</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {["Record live", "Import gallery", "Meta glasses"].map((label) => (
                <span className="rounded-md bg-black/15 px-2 py-1 text-[0.65rem] font-bold uppercase tracking-[0.08em]" key={label}>
                  {label}
                </span>
              ))}
            </div>
          </div>
          <span className="text-2xl text-black/45 transition group-hover:translate-x-1">-&gt;</span>
        </div>
      </Link>

      <Link
        className="group block rounded-2xl border-2 border-[var(--border-mid)] bg-[var(--surface)] p-5 transition hover:border-[var(--border-strong)] active:scale-[0.99]"
        href={`/jobs/${jobId}/survey` as Route}
      >
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--elevated)]">
            <svg fill="none" height="22" stroke="var(--text-muted)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width="22">
              <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-ui text-base font-bold text-[var(--text-primary)]">Manual Survey</p>
            <p className="mt-1 text-sm text-[var(--text-muted)]">Fill in the form yourself, with the roof takeoff map available from this survey page.</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {["Survey form", "Roof takeoff map"].map((label) => (
                <span className="rounded-md border border-[var(--border)] bg-[var(--elevated)] px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]" key={label}>
                  {label}
                </span>
              ))}
            </div>
          </div>
          <span className="text-2xl text-[var(--text-faint)] transition group-hover:translate-x-1">-&gt;</span>
        </div>
      </Link>
    </div>
  );
}
