"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: "📊" },
  { href: "/leads/new", label: "Add Lead", icon: "➕" },
  { href: "/pipeline", label: "Pipeline", icon: "📋" },
  { href: "/customers", label: "Customers", icon: "👥" },
] as const;

export function NavShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  return (
    <div className="flex min-h-screen">
      <aside className="hidden md:flex md:w-52 md:flex-col md:fixed md:inset-y-0 border-r border-[var(--border)] bg-[var(--dark)]">
        <div className="px-4 pt-5 pb-3">
          <Link href="/dashboard" className="flex items-center gap-2">
            <span className="text-2xl">🏠</span>
            <div><p className="font-condensed text-lg text-white leading-tight">We Are Roofing</p><p className="text-[10px] uppercase tracking-[0.15em] text-[var(--gold)]">Business OS</p></div>
          </Link>
        </div>
        <nav className="flex-1 px-2 py-4 space-y-1">
          {NAV.map(n => {
            const on = path === n.href || path.startsWith(n.href + "/") || (n.href === "/dashboard" && path.startsWith("/jobs"));
            return (<Link key={n.href} href={n.href} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${on ? "bg-[rgba(212,175,55,0.12)] text-[var(--gold-l)] border border-[var(--border2)]" : "text-[var(--muted)] hover:text-[var(--text)] hover:bg-[rgba(255,255,255,0.04)]"}`}><span className="text-lg">{n.icon}</span>{n.label}</Link>);
          })}
        </nav>
        <div className="px-4 py-3 border-t border-[var(--border)]"><p className="text-[10px] text-[var(--dim)] uppercase tracking-wider">We Are Roofing UK Ltd</p></div>
      </aside>
      <main className="flex-1 md:pl-52 pb-20 md:pb-4">{children}</main>
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 border-t border-[var(--border)] bg-[var(--dark)]/95 backdrop-blur-lg">
        <div className="flex justify-around py-1.5 pb-safe">
          {NAV.map(n => {
            const on = path === n.href || path.startsWith(n.href + "/") || (n.href === "/dashboard" && path.startsWith("/jobs"));
            return (<Link key={n.href} href={n.href} className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition ${on ? "text-[var(--gold-l)]" : "text-[var(--dim)]"}`}><span className="text-xl">{n.icon}</span><span className="text-[10px] font-semibold">{n.label}</span></Link>);
          })}
        </div>
      </nav>
    </div>
  );
}
