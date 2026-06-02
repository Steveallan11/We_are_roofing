"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

function NavIcon({ path, size = 18, color = "currentColor" }: { path: string; size?: number; color?: string }) {
  return (
    <svg aria-hidden="true" fill="none" height={size} stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" viewBox="0 0 24 24" width={size}>
      <path d={path} />
    </svg>
  );
}

const MOBILE_NAV = [
  {
    id: "home",
    label: "Home",
    href: "/dashboard",
    icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
  },
  {
    id: "jobs",
    label: "Jobs",
    href: "/jobs",
    icon: "M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
  },
  {
    id: "money",
    label: "Money",
    href: "/money",
    icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
  },
  {
    id: "comms",
    label: "Comms",
    href: "/comms",
    icon: "M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
  }
];

const MORE_ITEMS = [
  {
    id: "customers",
    label: "Customers",
    href: "/customers",
    icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
  },
  {
    id: "calendar",
    label: "Calendar",
    href: "/calendar",
    icon: "M8 7V3m8 4V3M5 11h14M5 5h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z"
  },
  {
    id: "knowledge",
    label: "Knowledge",
    href: "/knowledge",
    icon: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
  },
  {
    id: "settings",
    label: "Settings",
    href: "/settings",
    icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z"
  }
];

const MORE_ICON = "M6 12h.01M12 12h.01M18 12h.01";

export function MobileBottomNav() {
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = useState(0);
  const [moreOpen, setMoreOpen] = useState(false);

  const hidden = pathname === "/login" || pathname.startsWith("/quote/");

  useEffect(() => {
    let active = true;

    async function loadUnreadCount() {
      const response = await fetch("/api/comms/conversations?summary=1", { cache: "no-store" });
      const result = (await response.json().catch(() => null)) as { unreadCount?: number } | null;
      if (active) setUnreadCount(Number(result?.unreadCount ?? 0));
    }

    void loadUnreadCount();
    const timer = window.setInterval(loadUnreadCount, 30000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  if (hidden) return null;

  const moreActive = MORE_ITEMS.some((item) => pathname.startsWith(item.href));

  return (
    <>
      <nav aria-label="Primary mobile navigation" className="mobile-bottom-nav no-print lg:hidden">
        <div className="mobile-bottom-nav__inner">
          {MOBILE_NAV.map((item) => {
            const active = item.href === "/dashboard" ? pathname === "/dashboard" || pathname === "/" : pathname.startsWith(item.href);
            const isComms = item.id === "comms";
            return (
              <Link aria-current={active ? "page" : undefined} className={`mobile-bottom-nav__item ${active ? "is-active" : ""}`} href={item.href as Route} key={item.id}>
                <span className="mobile-bottom-nav__icon">
                  <NavIcon color={active ? "var(--gold)" : "var(--text-faint)"} path={item.icon} />
                  {isComms && unreadCount > 0 ? <span className="mobile-bottom-nav__badge">{unreadCount > 99 ? "99+" : unreadCount}</span> : null}
                </span>
                <span>{item.label}</span>
              </Link>
            );
          })}
          <button
            aria-expanded={moreOpen}
            aria-label="More navigation"
            className={`mobile-bottom-nav__item ${moreActive ? "is-active" : ""}`}
            onClick={() => setMoreOpen((open) => !open)}
            type="button"
          >
            <span className="mobile-bottom-nav__icon">
              <NavIcon color={moreActive ? "var(--gold)" : "var(--text-faint)"} path={MORE_ICON} />
            </span>
            <span>More</span>
          </button>
        </div>
      </nav>
      {moreOpen ? (
        <div className="mobile-more-sheet no-print lg:hidden" onClick={() => setMoreOpen(false)} role="dialog" aria-modal="true" aria-label="More navigation">
          <div className="mobile-more-sheet__panel" onClick={(event) => event.stopPropagation()}>
            <div className="mobile-more-sheet__handle" />
            <p className="mobile-more-sheet__title">More</p>
            <div className="mobile-more-sheet__grid">
              {MORE_ITEMS.map((item) => {
                const active = pathname.startsWith(item.href);
                return (
                  <Link className={`mobile-more-sheet__tile ${active ? "is-active" : ""}`} href={item.href as Route} key={item.id} onClick={() => setMoreOpen(false)}>
                    <span className="mobile-more-sheet__tile-icon">
                      <NavIcon color={active ? "var(--gold)" : "var(--text-faint)"} path={item.icon} size={20} />
                    </span>
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
