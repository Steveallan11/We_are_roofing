import Link from "next/link";
import { BrandLogo } from "@/components/ui/brand-logo";
import { Starfield } from "@/components/ui/starfield";

type Props = {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
};

export function AppShell({ title, subtitle, actions, children }: Props) {
  return (
    <div className="relative min-h-screen">
      <Starfield />
      <div className="relative z-10 app-shell">
        <header className="brand-panel relative mb-4 overflow-hidden rounded-[1.5rem] px-5 py-6">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <BrandLogo size="md" />
              <p className="mt-3 font-display text-[0.72rem] tracking-[0.38em] text-[var(--gold)]/80">
                ROOFING BUSINESS OPERATING SYSTEM
              </p>
            </div>
            <nav className="hidden items-center gap-3 text-sm text-[var(--muted)] md:flex">
              <Link href="/dashboard">Dashboard</Link>
              <Link href="/jobs/new">New Job</Link>
            </nav>
          </div>
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="section-kicker text-[0.7rem] uppercase">We Are Roofing OS</p>
              <h1 className="mt-2 font-display text-4xl leading-none text-[var(--gold-l)] md:text-5xl">{title}</h1>
              {subtitle ? <p className="mt-3 max-w-2xl text-sm text-[var(--muted)] md:text-base">{subtitle}</p> : null}
            </div>
            {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}

