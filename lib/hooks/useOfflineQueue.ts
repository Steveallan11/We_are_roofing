"use client";

import { useEffect, useState } from "react";

export type OfflineMessage =
  | { type: "ONLINE" }
  | { type: "OFFLINE" }
  | { type: "OFFLINE_QUEUED"; url: string }
  | { type: "UPLOAD_SUCCESS"; url: string }
  | { type: "QUEUED_UPLOAD_SYNCED"; url: string };

export function useOfflineQueue() {
  const [isOnline, setIsOnline] = useState(true);
  const [queuedCount, setQueuedCount] = useState(0);
  const [lastMessage, setLastMessage] = useState<OfflineMessage | null>(null);

  useEffect(() => {
    // Register service worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/service-worker.js").catch((error) => {
        console.error("Service worker registration failed:", error);
      });
    }

    // Track online/offline status
    const handleOnline = () => {
      setIsOnline(true);
      setLastMessage({ type: "ONLINE" });
    };

    const handleOffline = () => {
      setIsOnline(false);
      setLastMessage({ type: "OFFLINE" });
    };

    // Listen for messages from service worker
    const handleMessage = (event: MessageEvent) => {
      const message = event.data as OfflineMessage;
      setLastMessage(message);

      if (message.type === "OFFLINE_QUEUED") {
        setQueuedCount((prev) => prev + 1);
      } else if (message.type === "QUEUED_UPLOAD_SYNCED") {
        setQueuedCount((prev) => Math.max(0, prev - 1));
      }
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    navigator.serviceWorker.addEventListener("message", handleMessage);

    // Check initial online status
    setIsOnline(navigator.onLine);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      navigator.serviceWorker.removeEventListener("message", handleMessage);
    };
  }, []);

  return { isOnline, queuedCount, lastMessage };
}
