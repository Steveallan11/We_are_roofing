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
  },
  {
    id: "surveys",
    label: "Surveys",
    href: "/surveys",
    icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
  }
];

export function MobileBottomNav() {
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = useState(0);

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

  if (hidden) return null;

  return (
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
      </div>
    </nav>
  );
}
