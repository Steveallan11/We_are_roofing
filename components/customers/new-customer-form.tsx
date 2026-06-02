"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { lookupPostcode as lookupPostcodeApi } from "@/lib/postcode";

type FormState = {
  customer_type: "person" | "business";
  full_name: string;
  business_name: string;
  phone: string;
  email: string;
  contact_person_name: string;
  contact_person_phone: string;
  contact_person_email: string;
  address_line_1: string;
  postcode: string;
  town: string;
  county: string;
  notes: string;
};

const initialState: FormState = {
  customer_type: "person",
  full_name: "",
  business_name: "",
  phone: "",
  email: "",
  contact_person_name: "",
  contact_person_phone: "",
  contact_person_email: "",
  address_line_1: "",
  postcode: "",
  town: "",
  county: "",
  notes: ""
};

export function NewCustomerForm() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(initialState);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [postcodeStatus, setPostcodeStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [isPending, startTransition] = useTransition();

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function lookupPostcode() {
    const postcode = form.postcode.trim();
    if (!postcode) return;
    setPostcodeStatus("Looking up postcode...");
    const result = await lookupPostcodeApi(postcode);
    if (!result) {
      setPostcodeStatus("Postcode not found. Enter address manually.");
      return;
    }
    setForm((current) => ({
      ...current,
      postcode: current.postcode.trim().toUpperCase(),
      town: result.town || current.town,
      county: result.county || current.county
    }));
    setPostcodeStatus("Postcode found. Town and county filled.");
  }

  function canSubmit() {
    if (!form.phone.trim()) return false;
    if (form.customer_type === "business") {
      return Boolean(form.business_name.trim() && form.contact_person_name.trim());
    }
    return Boolean(form.full_name.trim());
  }

  async function handleSubmit() {
    setError(null);
    setSuccess(null);
    setSaving(true);

    try {
      const response = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });

      const result = (await response.json().catch(() => null)) as
        | { ok?: boolean; error?: string | { fieldErrors?: Record<string, string[]> }; customer_id?: string }
        | null;

      if (!response.ok || !result?.ok || !result.customer_id) {
        setError(typeof result?.error === "string" ? result.error : "Unable to save customer. Check the required fields and try again.");
        return;
      }

      setSuccess("Customer saved. Opening customer record.");
      startTransition(() => {
        router.push(`/customers/${result.customer_id}`);
        router.refresh();
      });
    } catch (err) {
      console.error("Customer save error:", err);
      setError("Something went wrong while saving. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const isBusiness = form.customer_type === "business";

  return (
    <div className="card overflow-hidden">
      <div className="border-b border-[var(--border)] p-5">
        <p className="section-kicker text-[0.65rem] uppercase">New Customer</p>
        <h2 className="mt-2 font-condensed text-3xl text-white">Save the contact details</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">Phone is required. Everything else is optional — fill what you have.</p>
      </div>

      <div className="grid gap-5 p-5 md:p-8">
        <div>
          <p className="label">Customer Type</p>
          <div className="flex rounded-2xl border border-[var(--border)] bg-black/20 p-1">
            <button
              className={form.customer_type === "person" ? "flex-1 rounded-xl bg-[var(--gold)] px-4 py-2 text-sm font-bold text-black" : "flex-1 rounded-xl px-4 py-2 text-sm font-semibold text-[var(--muted)]"}
              onClick={() => updateField("customer_type", "person")}
              type="button"
            >
              Person
            </button>
            <button
              className={form.customer_type === "business" ? "flex-1 rounded-xl bg-[var(--gold)] px-4 py-2 text-sm font-bold text-black" : "flex-1 rounded-xl px-4 py-2 text-sm font-semibold text-[var(--muted)]"}
              onClick={() => updateField("customer_type", "business")}
              type="button"
            >
              Business
            </button>
          </div>
        </div>

        {isBusiness ? (
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Business Name *" value={form.business_name} onChange={(value) => updateField("business_name", value)} autoComplete="organization" />
            <Field label="Business Phone *" value={form.phone} onChange={(value) => updateField("phone", value)} autoComplete="tel" inputMode="tel" type="tel" />
            <Field label="Business Email" value={form.email} onChange={(value) => updateField("email", value)} autoComplete="email" type="email" />
            <Field label="Contact Person *" value={form.contact_person_name} onChange={(value) => updateField("contact_person_name", value)} autoComplete="name" />
            <Field label="Contact Phone" value={form.contact_person_phone} onChange={(value) => updateField("contact_person_phone", value)} autoComplete="tel" inputMode="tel" type="tel" />
            <Field label="Contact Email" value={form.contact_person_email} onChange={(value) => updateField("contact_person_email", value)} autoComplete="email" type="email" />
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Full Name *" value={form.full_name} onChange={(value) => updateField("full_name", value)} autoComplete="name" />
            <Field label="Phone *" value={form.phone} onChange={(value) => updateField("phone", value)} autoComplete="tel" inputMode="tel" type="tel" />
            <Field label="Email" value={form.email} onChange={(value) => updateField("email", value)} autoComplete="email" type="email" />
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Field label="Address" value={form.address_line_1} onChange={(value) => updateField("address_line_1", value)} autoComplete="street-address" />
          </div>
          <div>
            <Field label="Postcode" value={form.postcode} onChange={(value) => updateField("postcode", value)} onBlur={lookupPostcode} autoComplete="postal-code" />
            {postcodeStatus ? <p className="mt-2 text-xs text-[var(--muted)]">{postcodeStatus}</p> : null}
          </div>
          <Field label="Town" value={form.town} onChange={(value) => updateField("town", value)} />
          <Field label="County" value={form.county} onChange={(value) => updateField("county", value)} />
        </div>

        <div>
          <label className="label" htmlFor="customer-notes">Notes</label>
          <textarea className="field min-h-24" id="customer-notes" onChange={(event) => updateField("notes", event.target.value)} value={form.notes} />
        </div>
      </div>

      <div className="sticky bottom-0 flex flex-col gap-3 border-t border-[var(--border)] bg-[var(--card)]/95 p-5 backdrop-blur md:flex-row md:items-center md:justify-between">
        <div className="text-sm">
          {error ? <p className="text-[#ff9a91]">{error}</p> : null}
          {success ? <p className="text-[#7ce3a6]">{success}</p> : null}
          {!error && !success ? <p className="text-[var(--muted)]">Phone is the only required field. Fill what you know.</p> : null}
        </div>
        <button className="button-primary min-h-11" disabled={!canSubmit() || saving || isPending} onClick={handleSubmit} type="button">
          {saving || isPending ? "Saving..." : "Save Customer"}
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  inputMode,
  autoComplete,
  onBlur
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  autoComplete?: string;
  onBlur?: () => void;
}) {
  const id = label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      <input autoComplete={autoComplete} className="field min-h-11" id={id} inputMode={inputMode} onBlur={onBlur} onChange={(event) => onChange(event.target.value)} type={type} value={value} />
    </div>
  );
}
