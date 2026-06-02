"use client";

import * as React from "react";
import * as ToastPrimitive from "@radix-ui/react-toast";
import { cn } from "@/lib/utils";

type ToastVariant = "default" | "success" | "error" | "warning";

const VARIANT_CLASS: Record<ToastVariant, string> = {
  default: "border-[var(--border)] bg-[var(--surface)] text-[var(--text)]",
  success: "border-[var(--stage-active-border)] bg-[var(--stage-active-bg)] text-[var(--stage-active-text)]",
  error: "border-[var(--stage-alert-border)] bg-[var(--stage-alert-bg)] text-[var(--stage-alert-text)]",
  warning: "border-[var(--stage-pending-border)] bg-[var(--stage-pending-bg)] text-[var(--stage-pending-text)]"
};

type ToastMessage = {
  id: string;
  title?: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
};

type ToastContextValue = {
  toast: (message: Omit<ToastMessage, "id">) => void;
};

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) {
    return {
      toast: (message: Omit<ToastMessage, "id">) => {
        if (typeof window !== "undefined") {
          console.warn("Toast called outside of ToastProvider:", message);
        }
      }
    };
  }
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = React.useState<ToastMessage[]>([]);

  const toast = React.useCallback((message: Omit<ToastMessage, "id">) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setMessages((prev) => [...prev, { ...message, id }]);
  }, []);

  const dismiss = React.useCallback((id: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      <ToastPrimitive.Provider swipeDirection="right" duration={5000}>
        {children}
        {messages.map((m) => (
          <ToastPrimitive.Root
            key={m.id}
            duration={m.duration ?? 5000}
            onOpenChange={(open) => {
              if (!open) dismiss(m.id);
            }}
            className={cn(
              "rounded-lg border p-4 shadow-xl",
              "data-[state=open]:animate-in data-[state=open]:slide-in-from-right-full",
              "data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right-full",
              "data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)]",
              "data-[swipe=cancel]:translate-x-0 data-[swipe=cancel]:transition-transform",
              "data-[swipe=end]:animate-out data-[swipe=end]:slide-out-to-right-full",
              VARIANT_CLASS[m.variant ?? "default"]
            )}
          >
            {m.title ? (
              <ToastPrimitive.Title className="text-sm font-semibold">{m.title}</ToastPrimitive.Title>
            ) : null}
            {m.description ? (
              <ToastPrimitive.Description className="mt-1 text-xs text-[var(--text-muted)]">
                {m.description}
              </ToastPrimitive.Description>
            ) : null}
            <ToastPrimitive.Close
              aria-label="Close notification"
              className="absolute right-2 top-2 rounded p-1 text-[var(--text-muted)] hover:bg-[var(--elevated)] hover:text-[var(--text)] transition-colors"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </ToastPrimitive.Close>
          </ToastPrimitive.Root>
        ))}
        <ToastPrimitive.Viewport className="fixed bottom-0 right-0 z-[100] flex max-h-screen w-full max-w-sm flex-col gap-2 p-4 outline-none md:bottom-4 md:right-4" />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  );
}
