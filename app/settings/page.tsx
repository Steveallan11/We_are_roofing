import Link from "next/link";
import type { Route } from "next";
import { AppShell } from "@/components/layout/app-shell";

export default function SettingsPage() {
  return (
    <AppShell title="Settings" subtitle="Business setup, pricing, and operating defaults for We Are Roofing OS.">
      <div className="grid gap-4 md:grid-cols-2">
        <Link className="card block p-5 transition hover:border-[var(--gold)]/50" href={"/settings/rates" as Route}>
          <p className="section-kicker text-[0.65rem] uppercase">Pricing</p>
          <h2 className="mt-2 font-condensed text-3xl text-white">Rate Card</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">Set unit rates for roof areas, ridges, valleys, gutters, scaffold, skips, and waste.</p>
        </Link>
      </div>
    </AppShell>
  );
}
