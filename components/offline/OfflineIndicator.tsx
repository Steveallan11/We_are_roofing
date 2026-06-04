"use client";

import { useOfflineQueue } from "@/lib/hooks/useOfflineQueue";

export function OfflineIndicator() {
  const { isOnline, queuedCount } = useOfflineQueue();

  if (isOnline && queuedCount === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 z-40 flex items-center gap-2 rounded-full bg-[var(--stage-pending)] px-4 py-2 text-sm font-semibold text-black shadow-lg">
      <span className={`h-2 w-2 rounded-full ${isOnline ? "bg-[#10b981]" : "bg-[#ef4444]"} animate-pulse`}></span>
      <span>
        {isOnline
          ? queuedCount > 0
            ? `Syncing ${queuedCount} upload${queuedCount === 1 ? "" : "s"}...`
            : "Synced"
          : "Offline - queuing uploads"}
      </span>
    </div>
  );
}
