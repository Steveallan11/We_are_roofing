"use client";

export function AssistantTyping() {
  return (
    <div className="flex justify-start">
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3">
        <div className="quote-engine-pulse" aria-label="Gauge is thinking">
          <span />
          <span />
          <span />
        </div>
      </div>
    </div>
  );
}
