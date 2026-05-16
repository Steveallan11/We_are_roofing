"use client";

type Props = {
  onClick: () => void;
  overdueCount: number;
  tooltipVisible: boolean;
};

export function AssistantButton({ onClick, overdueCount, tooltipVisible }: Props) {
  return (
    <div className="fixed bottom-6 right-6 z-50">
      {tooltipVisible ? (
        <div className="mb-3 max-w-[260px] rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm text-[var(--text)] shadow-2xl">
          Ask me anything - try &quot;what jobs need following up?&quot;
        </div>
      ) : null}
      <button
        aria-label="Open Andy assistant"
        className="assistant-fab relative flex h-14 w-14 items-center justify-center rounded-full text-lg font-semibold text-black shadow-2xl"
        onClick={onClick}
        type="button"
      >
        A
        {overdueCount > 0 ? <span className="absolute right-1 top-1 h-3 w-3 rounded-full bg-[#ff5d5d]" /> : null}
      </button>
    </div>
  );
}
