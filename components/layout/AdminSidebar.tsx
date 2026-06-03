"use client";

import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LogoutButton } from "@/components/auth/logout-button";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

function NavIcon({ path, size = 16, color = "currentColor" }: { path: string; size?: number; color?: string }) {
  return (
    <svg aria-hidden="true" fill="none" height={size} stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width={size}>
      <path d={path} />
    </svg>
  );
}

type NavChild = {
  label: string;
  href: string;
};

type NavItem = {
  id: string;
  label: string;
  href: string;
  icon: string;
  children?: NavChild[];
  badgeColor?: string;
};

type NavGroup = {
  section: string | null;
  items: NavItem[];
};

const NAV: NavGroup[] = [
  {
    section: null,
    items: [
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
        id: "customers",
        label: "Customers",
        href: "/customers",
        icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
      },
      {
        id: "money",
        label: "Money",
        href: "/money",
        icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      },
      {
        id: "calendar",
        label: "Calendar",
        href: "/calendar",
        icon: "M8 7V3m8 4V3M5 11h14M5 5h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z"
      },
      {
        id: "comms",
        label: "Comms",
        href: "/comms",
        icon: "M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z",
        badgeColor: "#ef4444"
      },
      {
        id: "settings",
        label: "Settings",
        href: "/settings",
        icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z",
        children: [
          { label: "Settings Home", href: "/settings" },
          { label: "Rate Card", href: "/settings/rates" },
          { label: "Labour", href: "/settings/labour" },
          { label: "Knowledge", href: "/knowledge" },
          { label: "Suppliers", href: "/settings/suppliers" }
        ]
      }
    ]
  }
];

export function AdminSidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ settings: true });
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const saved = localStorage.getItem("war_sidebar_collapsed");
    if (saved) setCollapsed(saved === "true");
  }, []);

  useEffect(() => {
    let active = true;

    async function loadUnreadCount() {
      const response = await fetch("/api/comms/conversations?summary=1", { cache: "no-store" });
      const result = (await response.json().catch(() => null)) as { unreadCount?: number } | null;
      if (active) {
        setUnreadCount(Number(result?.unreadCount ?? 0));
      }
    }

    void loadUnreadCount();
    const timer = window.setInterval(loadUnreadCount, 30000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  const width = collapsed ? 56 : 220;
  const isActive = (href: string) => (href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href));
  const sectionActive = (item: NavItem) => isActive(item.href) || Boolean(item.children?.some((child) => pathname.startsWith(child.href)));

  return (
    <aside
      className="no-print hidden lg:flex"
      style={{
        width,
        minHeight: "100vh",
        background: "var(--obsidian)",
        borderRight: "1px solid var(--border)",
        flexDirection: "column",
        flexShrink: 0,
        transition: "width 0.2s ease",
        overflow: "hidden",
        position: "sticky",
        top: 0
      }}
    >
      <div
        style={{
          padding: collapsed ? "14px 0" : "16px 18px 14px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: collapsed ? "center" : "space-between",
          minHeight: 64
        }}
      >
        {!collapsed ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: "rgba(212,175,55,0.12)",
                border: "1px solid rgba(212,175,55,0.25)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden"
              }}
            >
              <Image alt="We Are Roofing UK Ltd" height={32} src="/we-are-roofing-logo.png" style={{ objectFit: "contain" }} width={32} />
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--gold)", letterSpacing: "0.03em", fontFamily: "var(--font-display)" }}>
                We Are Roofing
              </div>
              <div style={{ fontSize: 9, color: "var(--text-faint)", letterSpacing: "0.12em", textTransform: "uppercase", marginTop: 1 }}>Admin</div>
            </div>
          </div>
        ) : null}
        <button
          onClick={() => {
            const next = !collapsed;
            setCollapsed(next);
            localStorage.setItem("war_sidebar_collapsed", String(next));
          }}
          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-faint)", padding: 4, borderRadius: 4, display: "flex" }}
          type="button"
        >
          <NavIcon path={collapsed ? "M13 5l7 7-7 7M5 5l7 7-7 7" : "M11 19l-7-7 7-7M19 19l-7-7 7-7"} size={14} />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "8px 0" }}>
        {NAV.map((group, groupIndex) => (
          <div key={groupIndex}>
            {group.section && !collapsed ? (
              <div style={{ padding: "14px 18px 4px", fontSize: 9, color: "#2a2a2a", letterSpacing: "0.15em", textTransform: "uppercase", fontFamily: "var(--font-ui)", fontWeight: 700 }}>
                {group.section}
              </div>
            ) : null}
            {group.items.map((item) => {
              const active = sectionActive(item);
              return (
                <div key={item.id}>
                  <Link
                    href={item.href as Route}
                    onClick={
                      item.children && !collapsed
                        ? (event) => {
                            event.preventDefault();
                            setExpanded((current) => ({ ...current, [item.id]: !current[item.id] }));
                          }
                        : undefined
                    }
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: collapsed ? 0 : 10,
                      minHeight: 44,
                      padding: collapsed ? "10px 0" : "9px 16px",
                      justifyContent: collapsed ? "center" : "flex-start",
                      fontFamily: "var(--font-ui)",
                      fontSize: 13,
                      fontWeight: active ? 700 : 500,
                      color: active ? "var(--text-primary)" : "var(--text-muted)",
                      background: active ? "rgba(212,175,55,0.06)" : "transparent",
                      borderLeft: `2px solid ${active ? "var(--gold)" : "transparent"}`,
                      textDecoration: "none",
                      cursor: "pointer",
                      transition: "all 0.12s"
                    }}
                    title={collapsed ? item.label : undefined}
                  >
                    <NavIcon color={active ? "var(--gold)" : "var(--text-faint)"} path={item.icon} size={16} />
                    {!collapsed ? (
                      <>
                        <span style={{ flex: 1 }}>{item.label}</span>
                        {item.id === "comms" && unreadCount > 0 ? (
                          <span
                            style={{
                              minWidth: 20,
                              height: 20,
                              borderRadius: 999,
                              background: item.badgeColor || "#ef4444",
                              color: "#fff",
                              fontSize: 10,
                              fontWeight: 700,
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              padding: "0 6px"
                            }}
                          >
                            {unreadCount > 99 ? "99+" : unreadCount}
                          </span>
                        ) : null}
                        {item.children ? <NavIcon color="var(--text-ghost)" path={expanded[item.id] ? "M19 9l-7 7-7-7" : "M9 5l7 7-7 7"} size={12} /> : null}
                      </>
                    ) : null}
                  </Link>
                  {!collapsed && item.children && expanded[item.id] ? (
                    <div style={{ paddingLeft: 44, paddingBottom: 4 }}>
                      {item.children.map((child) => (
                        <Link
                          href={child.href as Route}
                          key={child.href}
                          style={{
                            display: "block",
                            padding: "5px 10px",
                            fontSize: 11,
                            fontFamily: "var(--font-ui)",
                            color: pathname === child.href ? "var(--gold)" : "var(--text-faint)",
                            textDecoration: "none"
                          }}
                        >
                          <span style={{ marginRight: 8, color: "#2a2a2a" }}>›</span>
                          {child.label}
                        </Link>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div style={{ padding: collapsed ? "10px 0" : "10px 12px", borderTop: "1px solid var(--border)" }}>
        <button
          onClick={() => window.dispatchEvent(new CustomEvent("gauge:prompt", { detail: { prompt: "" } }))}
          style={{
            width: "100%",
            padding: collapsed ? "10px 0" : "10px 12px",
            display: "flex",
            alignItems: "center",
            gap: collapsed ? 0 : 10,
            justifyContent: collapsed ? "center" : "flex-start",
            background: "rgba(212,175,55,0.06)",
            border: "1px solid rgba(212,175,55,0.20)",
            borderRadius: 8,
            cursor: "pointer"
          }}
          type="button"
        >
          <div style={{ position: "relative", flexShrink: 0 }}>
            <div style={{ width: 28, height: 28, borderRadius: 6, background: "rgba(212,175,55,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <NavIcon color="var(--gold)" path="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" size={14} />
            </div>
            <div style={{ position: "absolute", top: -2, right: -2, width: 7, height: 7, borderRadius: "50%", background: "var(--gold)", animation: "goldPulse 2.4s ease-in-out infinite" }} />
          </div>
          {!collapsed ? (
            <div style={{ flex: 1, textAlign: "left" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--gold)", fontFamily: "var(--font-ui)" }}>Ask Gauge</div>
              <div style={{ fontSize: 9, color: "var(--text-faint)", marginTop: 1 }}>Your AI assistant</div>
            </div>
          ) : null}
        </button>
        <div style={{ marginTop: 8 }}>
          <ThemeToggle compact={collapsed} />
        </div>
        <div style={{ marginTop: 8 }}>
          <LogoutButton />
        </div>
      </div>
    </aside>
  );
}
