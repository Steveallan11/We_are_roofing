import Link from "next/link";
import type { Route } from "next";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { AssistantQuickPrompts } from "@/components/assistant/AssistantQuickPrompts";
import { BrandLogo } from "@/components/ui/brand-logo";
import { Starfield } from "@/components/ui/starfield";
import { cn } from "@/lib/utils";

type Props = {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  wide?: boolean;
};

export function AppShell({ title, subtitle, actions, children, wide = false }: Props) {
  return (
    <div className="relative min-h-screen">
      <Starfield />
      <div className="relative z-10 flex min-h-screen">
        <AdminSidebar />
        <main className="min-w-0 flex-1">
          <div className={cn("app-shell", wide && "!max-w-[1600px]")}>
            <header className="brand-panel relative mb-4 overflow-hidden rounded-[10px] px-5 py-5">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <BrandLogo size="md" />
                  <p className="mt-3 font-ui text-[0.64rem] font-bold uppercase tracking-[0.32em] text-[var(--gold)]/75">
                    Roofing Business Operating System
                  </p>
                </div>
                <nav className="flex flex-wrap items-center justify-end gap-2 text-xs text-[var(--muted)] md:hidden">
                  <Link className="button-ghost !min-h-9 !px-3 !py-2" href="/dashboard">
                    Home
                  </Link>
                  <Link className="button-ghost !min-h-9 !px-3 !py-2" href={"/jobs" as Route}>
                    Jobs
                  </Link>
                  <Link className="button-ghost !min-h-9 !px-3 !py-2" href={"/money" as Route}>
                    Money
                  </Link>
                  <Link className="button-ghost !min-h-9 !px-3 !py-2" href={"/comms" as Route}>
                    Comms
                  </Link>
                </nav>
              </div>
              <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="section-kicker">We Are Roofing OS</p>
                  <h1 className="mt-2 font-display text-4xl leading-none text-[var(--gold-light)] md:text-5xl">{title}</h1>
                  {subtitle ? <p className="mt-3 max-w-2xl text-sm text-[var(--text-muted)] md:text-base">{subtitle}</p> : null}
                  <AssistantQuickPrompts />
                </div>
                {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
              </div>
            </header>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
