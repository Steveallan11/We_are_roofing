"use client";

import Link from "next/link";
import type { Route } from "next";
import { useEffect, useRef, useState } from "react";

const ACTIONS = [
  { label: "New job", detail: "Capture a new enquiry", href: "/jobs/new" },
  { label: "New task", detail: "Add a workflow action or follow-up", href: "/tasks" },
  { label: "New customer", detail: "Add a customer record", href: "/customers/new" },
  { label: "Create invoice", detail: "Choose the job to invoice", href: "/jobs?filter=complete" },
  { label: "Add expense", detail: "Record a cost or receipt", href: "/money?tab=expenses&action=new" }
] as const;

export function NewActionMenu({ mobile = false, collapsed = false }: { mobile?: boolean; collapsed?: boolean }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div className={mobile ? "mobile-new-action" : "relative px-3 py-2"} ref={containerRef}>
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Create new"
        className={mobile ? "mobile-bottom-nav__new" : "button-primary min-h-11 w-full justify-center"}
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <span aria-hidden="true">+</span>{!mobile && !collapsed ? " New" : null}
      </button>
      {open ? (
        <div className={mobile ? "mobile-new-action__sheet" : "absolute left-3 top-full z-50 w-64 rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] p-2 shadow-2xl"} role="menu">
          <p className="px-3 py-2 text-xs font-bold uppercase tracking-[0.16em] text-[var(--text-muted)]">What would you like to add?</p>
          {ACTIONS.map((action) => (
            <Link className="block min-h-11 rounded-lg px-3 py-2 hover:bg-white/5" href={action.href as Route} key={action.label} onClick={() => setOpen(false)} role="menuitem">
              <span className="block text-sm font-semibold text-[var(--text)]">{action.label}</span>
              <span className="block text-xs text-[var(--text-muted)]">{action.detail}</span>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
