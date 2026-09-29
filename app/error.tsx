"use client";

import { useEffect } from "react";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Application screen failed", { message: error.message, digest: error.digest });
  }, [error]);

  return (
    <main className="grid min-h-screen place-items-center bg-[var(--obsidian)] p-6">
      <div className="card max-w-lg p-8 text-center">
        <p className="section-kicker">Something needs attention</p>
        <h1 className="mt-3 font-display text-4xl text-[var(--text)]">We couldn&apos;t load this screen</h1>
        <p className="mt-3 text-sm text-[var(--text-muted)]">Nothing has been changed. Try again, or return to Today and carry on with another job.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button className="button-primary" onClick={reset} type="button">Try again</button>
          <a className="button-ghost" href="/today">Return to Today</a>
        </div>
        {error.digest ? <p className="mt-5 text-xs text-[var(--text-faint)]">Support reference: {error.digest}</p> : null}
      </div>
    </main>
  );
}
