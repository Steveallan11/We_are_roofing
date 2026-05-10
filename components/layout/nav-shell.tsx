"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "@/components/auth/logout-button";

const NAV = [
  { href: "/dashboard", label: "Dashboard", short: "DB" },
  { href: "/leads/new", label: "Add Lead", short: "AD" },
  { href: "/pipeline", label: "Pipeline", short: "PL" },
  { href: "/customers", label: "Customers", short: "CU" }
] as const;

export function NavShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const showNav = path !== "/login";

  return (
    <div className="flex min-h-screen">
      {showNav ? (
        <aside className="hidden border-r border-[var(--border)] bg-[var(--dark)] md:fixed md:inset-y-0 md:flex md:w-52 md:flex-col">
          <div className="px-4 pb-3 pt-5">
            <Link href="/dashboard">
              <img src="/logo.svg" alt="We Are Roofing" className="h-10 w-auto" />
            </Link>
          </div>
          <nav className="flex-1 space-y-1 px-2 py-4">
            {NAV.map((item) => {
              const on = path === item.href || path.startsWith(item.href + "/") || (item.href === "/dashboard" && path.startsWith("/jobs"));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                    on
                      ? "border border-[var(--border2)] bg-[rgba(212,175,55,0.12)] text-[var(--gold-l)]"
                      : "text-[var(--muted)] hover:bg-[rgba(255,255,255,0.04)] hover:text-[var(--text)]"
                  }`}
                >
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[var(--border)] text-[10px] font-bold">
                    {item.short}
                  </span>
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="space-y-3 border-t border-[var(--border)] px-4 py-3">
            <LogoutButton />
            <p className="text-[10px] uppercase tracking-wider text-[var(--dim)]">We Are Roofing UK Ltd</p>
          </div>
        </aside>
      ) : null}

      <main className={`flex-1 ${showNav ? "pb-20 md:pb-4 md:pl-52" : ""}`}>{children}</main>

      {showNav ? (
        <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-[var(--border)] bg-[var(--dark)]/95 backdrop-blur-lg md:hidden">
          <div className="flex justify-around py-1.5 pb-safe">
            {NAV.map((item) => {
              const on = path === item.href || path.startsWith(item.href + "/") || (item.href === "/dashboard" && path.startsWith("/jobs"));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 transition ${on ? "text-[var(--gold-l)]" : "text-[var(--dim)]"}`}
                >
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[var(--border)] text-[10px] font-bold">
                    {item.short}
                  </span>
                  <span className="text-[10px] font-semibold">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      ) : null}
    </div>
  );
}
