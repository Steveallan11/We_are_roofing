"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";

type SheetSide = "bottom" | "right" | "left";

const SIDE_CLASS: Record<SheetSide, string> = {
  bottom:
    "inset-x-0 bottom-0 max-h-[85vh] w-full rounded-t-3xl border-t data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom",
  right:
    "inset-y-0 right-0 h-full w-full max-w-md border-l data-[state=open]:animate-in data-[state=open]:slide-in-from-right data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right",
  left:
    "inset-y-0 left-0 h-full w-full max-w-md border-r data-[state=open]:animate-in data-[state=open]:slide-in-from-left data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left"
};

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;
export const SheetPortal = DialogPrimitive.Portal;

export const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(function SheetOverlay({ className, ...props }, ref) {
  return (
    <DialogPrimitive.Overlay
      ref={ref}
      className={cn(
        "fixed inset-0 z-50 bg-black/60 backdrop-blur-sm",
        "data-[state=open]:animate-in data-[state=open]:fade-in",
        "data-[state=closed]:animate-out data-[state=closed]:fade-out",
        className
      )}
      {...props}
    />
  );
});

type SheetContentProps = React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
  side?: SheetSide;
  title?: React.ReactNode;
  description?: React.ReactNode;
  showCloseButton?: boolean;
};

export const SheetContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  SheetContentProps
>(function SheetContent(
  { side = "bottom", className, children, title, description, showCloseButton = true, ...props },
  ref
) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          "fixed z-50 flex flex-col overflow-hidden border-[var(--border)] bg-[var(--surface)] shadow-2xl",
          "focus:outline-none",
          SIDE_CLASS[side],
          className
        )}
        {...props}
      >
        {side === "bottom" ? (
          <div className="flex justify-center pt-3 pb-1">
            <span className="h-1 w-12 rounded-full bg-[var(--border-mid)]" />
          </div>
        ) : null}
        {(title || description || showCloseButton) && (
          <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
            <div className="min-w-0">
              {title ? (
                <DialogPrimitive.Title className="font-condensed text-xl text-[var(--text)] leading-tight">
                  {title}
                </DialogPrimitive.Title>
              ) : null}
              {description ? (
                <DialogPrimitive.Description className="mt-1 text-sm text-[var(--text-muted)]">
                  {description}
                </DialogPrimitive.Description>
              ) : null}
            </div>
            {showCloseButton ? (
              <DialogPrimitive.Close
                aria-label="Close"
                className="shrink-0 rounded-md p-2 text-[var(--text-muted)] hover:bg-[var(--elevated)] hover:text-[var(--text)] transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </DialogPrimitive.Close>
            ) : null}
          </div>
        )}
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </DialogPrimitive.Content>
    </SheetPortal>
  );
});
