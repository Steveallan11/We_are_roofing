"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Customer } from "@/lib/types";

type Props = {
  customer: Customer;
  compact?: boolean;
};

type CustomerForm = {
  full_name: string;
  business_name: string;
  contact_person_name: string;
  phone: string;
  email: string;
  contact_person_phone: string;
  contact_person_email: string;
  address_line_1: string;
  address_line_2: string;
  town: string;
  county: string;
  postcode: string;
  notes: string;
};

export function CustomerContactEditor({ customer, compact = false }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<CustomerForm>(() => toForm(customer));
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [isPending, startTransition] = useTransition();

  function updateField(field: keyof CustomerForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    setError(null);

    const response = await fetch(`/api/customers/${customer.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });

    const result = (await response.json().catch(() => null)) as { ok?: boolean; message?: string; error?: string } | null;
    setSaving(false);

    if (!response.ok || !result?.ok) {
      setError(result?.error || "Could not update customer.");
      return;
    }

    setMessage(result.message || "Customer updated.");
    setEditing(false);
    startTransition(() => router.refresh());
  }

  function cancel() {
    setForm(toForm(customer));
    setEditing(false);
    setError(null);
    setMessage(null);
  }

  if (!editing) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-semibold text-white">{customer.business_name || customer.full_name}</p>
            {customer.business_name ? <p className="mt-1 text-sm text-[var(--muted)]">{customer.full_name}</p> : null}
          </div>
          <button className="button-secondary !px-3 !py-2 text-sm" onClick={() => setEditing(true)} type="button">
            Edit customer
          </button>
        </div>
        <div className="space-y-3 text-sm">
          <ContactLine href={customer.phone ? `tel:${customer.phone}` : undefined} label="Phone" value={customer.phone} />
          <ContactLine href={customer.email ? `mailto:${customer.email}` : undefined} label="Email" value={customer.email} />
          {customer.contact_person_name || customer.contact_person_phone || customer.contact_person_email ? (
            <ContactLine
              label="Contact"
              value={[customer.contact_person_name, customer.contact_person_phone, customer.contact_person_email].filter(Boolean).join(" | ")}
            />
          ) : null}
          <ContactLine label="Address" value={[customer.address_line_1, customer.address_line_2, customer.town, customer.county, customer.postcode].filter(Boolean).join(", ")} />
          {customer.notes ? <ContactLine label="Notes" value={customer.notes} /> : null}
        </div>
        {message ? <p className="text-sm text-[#7ce3a6]">{message}</p> : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className={`grid gap-3 ${compact ? "" : "md:grid-cols-2"}`}>
        <Field label="Customer name" value={form.full_name} onChange={(value) => updateField("full_name", value)} autoComplete="name" />
        <Field label="Business name" value={form.business_name} onChange={(value) => updateField("business_name", value)} autoComplete="organization" />
        <Field label="Phone" value={form.phone} onChange={(value) => updateField("phone", value)} autoComplete="tel" inputMode="tel" type="tel" />
        <Field label="Email" value={form.email} onChange={(value) => updateField("email", value)} autoComplete="email" inputMode="email" type="email" />
        <Field label="Contact person" value={form.contact_person_name} onChange={(value) => updateField("contact_person_name", value)} autoComplete="name" />
        <Field label="Contact phone" value={form.contact_person_phone} onChange={(value) => updateField("contact_person_phone", value)} autoComplete="tel" inputMode="tel" type="tel" />
        <Field label="Contact email" value={form.contact_person_email} onChange={(value) => updateField("contact_person_email", value)} autoComplete="email" inputMode="email" type="email" />
        <Field label="Postcode" value={form.postcode} onChange={(value) => updateField("postcode", value)} autoComplete="postal-code" />
        <Field label="Address line 1" value={form.address_line_1} onChange={(value) => updateField("address_line_1", value)} autoComplete="address-line1" />
        <Field label="Address line 2" value={form.address_line_2} onChange={(value) => updateField("address_line_2", value)} autoComplete="address-line2" />
        <Field label="Town" value={form.town} onChange={(value) => updateField("town", value)} autoComplete="address-level2" />
        <Field label="County" value={form.county} onChange={(value) => updateField("county", value)} autoComplete="address-level1" />
      </div>
      <label className="block">
        <span className="label">Notes</span>
        <textarea className="field mt-2 min-h-24" onChange={(event) => updateField("notes", event.target.value)} value={form.notes} />
      </label>
      {error ? <p className="text-sm text-[#ff9a91]">{error}</p> : null}
      {message ? <p className="text-sm text-[#7ce3a6]">{message}</p> : null}
      <div className="flex flex-wrap justify-end gap-3">
        <button className="button-ghost" disabled={saving || isPending} onClick={cancel} type="button">
          Cancel
        </button>
        <button className="button-primary" disabled={saving || isPending} onClick={save} type="button">
          {saving || isPending ? "Saving..." : "Save customer"}
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  autoComplete,
  inputMode,
  type = "text"
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  inputMode?: "email" | "tel";
  type?: string;
}) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <input
        autoComplete={autoComplete}
        className="field mt-2"
        inputMode={inputMode}
        onChange={(event) => onChange(event.target.value)}
        type={type}
        value={value}
      />
    </label>
  );
}

function ContactLine({ label, value, href }: { label: string; value?: string | null; href?: string }) {
  return (
    <p className="flex gap-2">
      <span className="min-w-20 text-[var(--muted)]">{label}:</span>
      {href && value ? (
        <a className="text-[var(--gold-l)] underline-offset-4 hover:underline" href={href}>
          {value}
        </a>
      ) : (
        <span className="text-[var(--text)]">{value || "Not saved"}</span>
      )}
    </p>
  );
}

function toForm(customer: Customer): CustomerForm {
  return {
    full_name: customer.full_name ?? "",
    business_name: customer.business_name ?? "",
    contact_person_name: customer.contact_person_name ?? "",
    phone: customer.phone ?? "",
    email: customer.email ?? "",
    contact_person_phone: customer.contact_person_phone ?? "",
    contact_person_email: customer.contact_person_email ?? "",
    address_line_1: customer.address_line_1 ?? "",
    address_line_2: customer.address_line_2 ?? "",
    town: customer.town ?? "",
    county: customer.county ?? "",
    postcode: customer.postcode ?? "",
    notes: customer.notes ?? ""
  };
}
