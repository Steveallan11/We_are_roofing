"use client";

import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { Business } from "@/lib/types";

type Props = {
  business: Business;
};

type SectionKey = "business" | "bank" | "defaults";

export function SettingsWorkspace({ business }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<Business>(business);
  const [activeSection, setActiveSection] = useState<SectionKey | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function update<K extends keyof Business>(key: K, value: Business[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function save(section: SectionKey, payload: Partial<Business>) {
    setActiveSection(section);
    setMessage(null);
    setError(null);

    const response = await fetch("/api/settings/business", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = (await response.json().catch(() => null)) as { ok?: boolean; message?: string; error?: string; business?: Business } | null;
    setActiveSection(null);

    if (!response.ok || !result?.ok) {
      setError(result?.error || "Settings could not be saved.");
      return;
    }

    if (result.business) {
      setForm(result.business);
    }
    setMessage(result.message || "Settings saved.");
    startTransition(() => router.refresh());
  }

  return (
    <div className="stack">
      {(message || error) && (
        <div className={`rounded-2xl border px-4 py-3 text-sm ${error ? "border-[#ef4444]/30 bg-[#ef4444]/10 text-[#ff9a91]" : "border-[#10b981]/30 bg-[#10b981]/10 text-[#7ce3a6]"}`}>
          {error || message}
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-3">
        <SettingsTile href="/settings/rates" kicker="Pricing" title="Rate Card" text="Set the unit rates that stop quotes coming out at £0." />
        <SettingsTile href="/knowledge" kicker="AI Knowledge" title="Knowledge Base" text="Upload quote examples and Andrew-style wording for Gauge." />
        <SettingsTile href="/money" kicker="Finance" title="Money Workspace" text="Review quotes, invoices, payment status, and PDFs." />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="card p-5">
          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="section-kicker text-[0.65rem] uppercase">Business Details</p>
              <h2 className="mt-2 font-condensed text-3xl text-white">Company identity</h2>
              <p className="mt-2 text-sm text-[var(--muted)]">Used on quotes, invoices, emails, and customer documents.</p>
            </div>
            <button
              className="button-primary !px-4 !py-2 text-sm"
              disabled={isPending || activeSection === "business"}
              onClick={() =>
                save("business", {
                  business_name: form.business_name,
                  trading_address: form.trading_address,
                  phone: form.phone,
                  email: form.email,
                  website: form.website,
                  company_number: form.company_number,
                  logo_url: form.logo_url,
                  weather_location: form.weather_location
                })
              }
              type="button"
            >
              {activeSection === "business" ? "Saving..." : "Save Business"}
            </button>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <TextField label="Business name" value={form.business_name} onChange={(value) => update("business_name", value)} />
            <TextField label="Phone" type="tel" value={form.phone} onChange={(value) => update("phone", value)} />
            <TextField label="Email" type="email" value={form.email} onChange={(value) => update("email", value)} />
            <TextField label="Website" value={form.website} onChange={(value) => update("website", value)} />
            <TextField label="Company number" value={form.company_number ?? ""} onChange={(value) => update("company_number", value || null)} />
            <TextField label="Weather location" value={form.weather_location ?? "Yateley"} onChange={(value) => update("weather_location", value)} />
            <div className="md:col-span-2">
              <TextArea label="Trading address" value={form.trading_address} onChange={(value) => update("trading_address", value)} />
            </div>
            <div className="md:col-span-2">
              <TextField label="Logo URL" value={form.logo_url ?? ""} onChange={(value) => update("logo_url", value || null)} />
            </div>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="section-kicker text-[0.65rem] uppercase">Bank Details</p>
              <h2 className="mt-2 font-condensed text-3xl text-white">Invoice payment info</h2>
              <p className="mt-2 text-sm text-[var(--muted)]">Shown on invoice documents and payment reminders.</p>
            </div>
            <button
              className="button-primary !px-4 !py-2 text-sm"
              disabled={isPending || activeSection === "bank"}
              onClick={() =>
                save("bank", {
                  bank_name: form.bank_name,
                  bank_sort_code: form.bank_sort_code,
                  bank_account: form.bank_account,
                  bank_account_name: form.bank_account_name
                })
              }
              type="button"
            >
              {activeSection === "bank" ? "Saving..." : "Save Bank"}
            </button>
          </div>

          <div className="mt-5 grid gap-3">
            <TextField label="Bank name" value={form.bank_name ?? ""} onChange={(value) => update("bank_name", value || null)} />
            <TextField label="Account name" value={form.bank_account_name ?? ""} onChange={(value) => update("bank_account_name", value || null)} />
            <TextField label="Sort code" inputMode="numeric" value={form.bank_sort_code ?? ""} onChange={(value) => update("bank_sort_code", value || null)} />
            <TextField label="Account number" inputMode="numeric" value={form.bank_account ?? ""} onChange={(value) => update("bank_account", value || null)} />
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="card p-5">
          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="section-kicker text-[0.65rem] uppercase">Quote Defaults</p>
              <h2 className="mt-2 font-condensed text-3xl text-white">Commercial defaults</h2>
              <p className="mt-2 text-sm text-[var(--muted)]">Controls VAT, quote validity, and invoice payment terms.</p>
            </div>
            <button
              className="button-primary !px-4 !py-2 text-sm"
              disabled={isPending || activeSection === "defaults"}
              onClick={() =>
                save("defaults", {
                  vat_registered: form.vat_registered,
                  vat_rate: Number(form.vat_rate || 0),
                  quote_valid_days: Number(form.quote_valid_days || 0),
                  payment_terms: form.payment_terms
                })
              }
              type="button"
            >
              {activeSection === "defaults" ? "Saving..." : "Save Defaults"}
            </button>
          </div>

          <div className="mt-5 grid gap-3">
            <label className="flex min-h-11 items-center justify-between gap-4 rounded-2xl border border-[var(--border)] bg-black/20 px-4 py-3">
              <span>
                <span className="block text-sm font-semibold text-white">VAT registered</span>
                <span className="block text-xs text-[var(--muted)]">Adds VAT into quote and invoice totals.</span>
              </span>
              <input checked={Boolean(form.vat_registered)} className="h-5 w-5 accent-[var(--gold)]" onChange={(event) => update("vat_registered", event.target.checked)} type="checkbox" />
            </label>
            <TextField inputMode="decimal" label="VAT rate %" type="number" value={String(form.vat_rate ?? 0)} onChange={(value) => update("vat_rate", Number(value || 0))} />
            <TextField inputMode="numeric" label="Quote valid days" type="number" value={String(form.quote_valid_days ?? 0)} onChange={(value) => update("quote_valid_days", Number(value || 0))} />
            <TextArea label="Payment terms" value={form.payment_terms} onChange={(value) => update("payment_terms", value)} />
          </div>
        </div>

        <div className="card p-5">
          <p className="section-kicker text-[0.65rem] uppercase">Email & Documents</p>
          <h2 className="mt-2 font-condensed text-3xl text-white">Operational checks</h2>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <StatusCheck label="Customer email sender" status="Uses Resend environment setup" />
            <StatusCheck label="Quote PDFs" status="Filed into each job when generated" />
            <StatusCheck label="Invoice PDFs" status="Filed into each job from Money or job file" />
            <StatusCheck label="Knowledge retrieval" status="Uses Knowledge Base and historical quotes" />
          </div>
          <p className="mt-4 rounded-2xl border border-[var(--border)] bg-black/20 p-4 text-sm text-[var(--muted)]">
            Full email/domain controls can be added once the sender domain and live email address are final. For now, this page keeps the document and business details that feed the templates in one place.
          </p>
        </div>
      </section>
    </div>
  );
}

function SettingsTile({ href, kicker, title, text }: { href: string; kicker: string; title: string; text: string }) {
  return (
    <Link className="card block p-5 transition hover:-translate-y-0.5 hover:border-[var(--gold)]/50" href={href as Route}>
      <p className="section-kicker text-[0.65rem] uppercase">{kicker}</p>
      <h2 className="mt-2 font-condensed text-3xl text-white">{title}</h2>
      <p className="mt-2 text-sm text-[var(--muted)]">{text}</p>
    </Link>
  );
}

function TextField({
  label,
  value,
  onChange,
  type = "text",
  inputMode
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "email" | "tel" | "number";
  inputMode?: "numeric" | "decimal";
}) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <input className="field min-h-11" inputMode={inputMode} onChange={(event) => onChange(event.target.value)} type={type} value={value} />
    </label>
  );
}

function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <textarea className="field min-h-28 resize-y" onChange={(event) => onChange(event.target.value)} value={value} />
    </label>
  );
}

function StatusCheck({ label, status }: { label: string; status: string }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-black/20 p-4">
      <p className="font-semibold text-white">{label}</p>
      <p className="mt-2 text-sm text-[var(--muted)]">{status}</p>
    </div>
  );
}
