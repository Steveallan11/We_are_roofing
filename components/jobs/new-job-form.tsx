"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Customer } from "@/lib/types";

const leadSources = ["Referral", "Phone Call", "Website", "Google", "Facebook", "Checkatrade", "Returning Customer", "Other"];
const jobTypes = ["Repair", "Replacement", "New Build", "Emergency", "Survey Only", "Report Only"];
const roofTypes = ["Pitched Tile", "Pitched Slate", "Flat EPDM", "Flat GRP", "Flat Felt", "Flat Lead", "Mixed", "Chimney", "Guttering", "Other"];
const urgencies = ["Low", "Medium", "High", "Emergency"];

type FormState = {
  customer_id: string;
  full_name: string;
  phone: string;
  email: string;
  source: string;
  property_address: string;
  postcode: string;
  town: string;
  county: string;
  job_title: string;
  job_type: string;
  roof_type: string;
  urgency: string;
  internal_notes: string;
  estimated_value: string;
};

const initialState: FormState = {
  customer_id: "",
  full_name: "",
  phone: "",
  email: "",
  source: "Phone Call",
  property_address: "",
  postcode: "",
  town: "",
  county: "",
  job_title: "",
  job_type: "Repair",
  roof_type: "Pitched Tile",
  urgency: "Medium",
  internal_notes: "",
  estimated_value: ""
};

type Props = {
  customers: Customer[];
  prefillCustomerId?: string;
};

export function NewJobForm({ customers, prefillCustomerId }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(() => {
    const selected = customers.find((customer) => customer.id === prefillCustomerId);
    return selected ? customerToForm(selected, initialState) : initialState;
  });
  const [customerSearch, setCustomerSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [postcodeStatus, setPostcodeStatus] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const matches = useMemo(() => {
    const query = customerSearch.trim().toLowerCase();
    if (!query) return customers.slice(0, 5);
    return customers
      .filter((customer) => [customer.full_name, customer.phone, customer.email, customer.postcode].filter(Boolean).join(" ").toLowerCase().includes(query))
      .slice(0, 8);
  }, [customerSearch, customers]);

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function selectCustomer(customer: Customer) {
    setForm((current) => customerToForm(customer, current));
    setCustomerSearch(customer.full_name);
  }

  function autoTitle() {
    updateField("job_title", `${form.roof_type} ${form.job_type}`);
  }

  async function lookupPostcode() {
    const postcode = form.postcode.trim();
    if (!postcode) return;
    setPostcodeStatus("Looking up postcode...");
    try {
      const response = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(postcode)}`);
      const result = (await response.json()) as {
        result?: {
          postcode?: string;
          admin_district?: string;
          admin_county?: string | null;
          region?: string | null;
        };
      };

      if (!response.ok || !result.result) {
        setPostcodeStatus("Postcode not found. Enter address manually.");
        return;
      }

      setForm((current) => ({
        ...current,
        postcode: result.result?.postcode ?? current.postcode,
        town: result.result?.admin_district ?? current.town,
        county: result.result?.admin_county || result.result?.region || current.county,
        property_address: current.property_address || [result.result?.admin_district, result.result?.postcode].filter(Boolean).join(", ")
      }));
      setPostcodeStatus("Postcode found. Town and county filled.");
    } catch {
      setPostcodeStatus("Postcode lookup unavailable. Enter address manually.");
    }
  }

  function canContinue() {
    if (step === 1) return Boolean(form.full_name && form.phone);
    if (step === 2) return Boolean(form.property_address && form.job_type && form.roof_type);
    if (step === 3) return Boolean(form.job_title && form.urgency && form.source);
    return true;
  }

  async function handleSubmit() {
    setError(null);
    setSuccess(null);

    const response = await fetch("/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customer: {
          customer_id: form.customer_id,
          full_name: form.full_name,
          phone: form.phone,
          email: form.email,
          property_address: form.property_address,
          postcode: form.postcode,
          town: form.town,
          county: form.county,
          source: form.source
        },
        job: {
          job_title: form.job_title,
          job_type: form.job_type,
          roof_type: form.roof_type,
          urgency: form.urgency,
          internal_notes: form.internal_notes
        }
      })
    });

    const result = (await response.json().catch(() => null)) as
      | { ok?: boolean; error?: string | { fieldErrors?: Record<string, string[]> }; job_id?: string; job?: { job_ref?: string }; duplicate_customer_reused?: boolean }
      | null;

    if (!response.ok || !result?.ok || !result.job_id) {
      setError("Unable to save the job. Check the required details and try again.");
      return;
    }

    setSuccess(`${result.job?.job_ref ?? "Job"} created. Opening job file.`);
    startTransition(() => {
      router.push(`/jobs/${result.job_id}`);
      router.refresh();
    });
  }

  return (
    <div className="card overflow-hidden">
      <div className="border-b border-[var(--border)] p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="section-kicker text-[0.65rem] uppercase">New Job Wizard</p>
            <h2 className="mt-2 font-condensed text-3xl text-white">Step {step} of 4</h2>
          </div>
          <div className="hidden gap-2 md:flex">
            {[1, 2, 3, 4].map((item) => (
              <span className={`h-2 w-12 rounded-full ${item <= step ? "bg-[var(--gold)]" : "bg-white/10"}`} key={item} />
            ))}
          </div>
        </div>
      </div>

      <div className="p-5 md:p-8">
        {step === 1 ? (
          <section className="grid gap-5">
            <StepHeader title="Customer" text="Search first. If they already exist, use the existing record and avoid duplicates." />
            <input className="field" onChange={(event) => setCustomerSearch(event.target.value)} placeholder="Search existing customers by name, phone, email or postcode" value={customerSearch} />
            {matches.length ? (
              <div className="grid gap-2">
                {matches.map((customer) => (
                  <button
                    className={`rounded-2xl border p-3 text-left transition hover:border-[var(--gold)] ${form.customer_id === customer.id ? "border-[var(--gold)] bg-[var(--gold)]/10" : "border-[var(--border)] bg-black/20"}`}
                    key={customer.id}
                    onClick={() => selectCustomer(customer)}
                    type="button"
                  >
                    <p className="font-semibold text-white">{customer.full_name}</p>
                    <p className="mt-1 text-sm text-[var(--muted)]">{[customer.phone, customer.email, customer.postcode].filter(Boolean).join(" | ")}</p>
                  </button>
                ))}
              </div>
            ) : null}
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Full Name" value={form.full_name} onChange={(value) => updateField("full_name", value)} autoComplete="name" />
              <Field label="Phone" value={form.phone} onChange={(value) => updateField("phone", value)} autoComplete="tel" inputMode="tel" type="tel" />
              <Field label="Email" value={form.email} onChange={(value) => updateField("email", value)} autoComplete="email" type="email" />
              <SelectField label="Source" value={form.source} options={leadSources} onChange={(value) => updateField("source", value)} />
            </div>
          </section>
        ) : null}

        {step === 2 ? (
          <section className="grid gap-5">
            <StepHeader title="Property" text="Capture the site address and what kind of roof/job this is." />
            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <Field label="Property Address" value={form.property_address} onChange={(value) => updateField("property_address", value)} autoComplete="street-address" />
              </div>
              <div>
                <Field label="Postcode" value={form.postcode} onChange={(value) => updateField("postcode", value)} onBlur={lookupPostcode} autoComplete="postal-code" />
                {postcodeStatus ? <p className="mt-2 text-xs text-[var(--muted)]">{postcodeStatus}</p> : null}
              </div>
              <Field label="Town" value={form.town} onChange={(value) => updateField("town", value)} />
              <Field label="County" value={form.county} onChange={(value) => updateField("county", value)} />
              <SelectField label="Job Type" value={form.job_type} options={jobTypes} onChange={(value) => updateField("job_type", value)} />
              <SelectField label="Roof Type" value={form.roof_type} options={roofTypes} onChange={(value) => updateField("roof_type", value)} />
            </div>
          </section>
        ) : null}

        {step === 3 ? (
          <section className="grid gap-5">
            <StepHeader title="Details" text="Set the job title, urgency and any notes the office or surveyor needs." />
            <div className="grid gap-4">
              <div>
                <Field label="Job Title" value={form.job_title} onChange={(value) => updateField("job_title", value)} />
                <button className="mt-2 text-sm text-[var(--gold-l)] underline-offset-4 hover:underline" onClick={autoTitle} type="button">
                  Auto-generate from roof and job type
                </button>
              </div>
              <div>
                <p className="label">Urgency</p>
                <div className="grid gap-2 md:grid-cols-4">
                  {urgencies.map((urgency) => (
                    <button className={`min-h-12 rounded-2xl border px-4 py-3 text-sm font-semibold ${form.urgency === urgency ? "border-[var(--gold)] bg-[var(--gold)] text-black" : "border-[var(--border)] bg-black/20 text-[var(--text)]"}`} key={urgency} onClick={() => updateField("urgency", urgency)} type="button">
                      {urgency}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="label" htmlFor="internal-notes">Internal Notes</label>
                <textarea className="field min-h-28" id="internal-notes" onChange={(event) => updateField("internal_notes", event.target.value)} value={form.internal_notes} />
              </div>
            </div>
          </section>
        ) : null}

        {step === 4 ? (
          <section className="grid gap-5">
            <StepHeader title="Confirm" text="Check the details, then create the job file and permanent job number." />
            <div className="grid gap-3 rounded-2xl border border-[var(--border)] bg-black/20 p-5 text-sm">
              <Summary label="Customer" value={`${form.full_name} | ${form.phone}`} />
              <Summary label="Property" value={`${form.property_address} ${form.postcode}`.trim()} />
              <Summary label="Job" value={`${form.job_title} | ${form.roof_type} | ${form.job_type}`} />
              <Summary label="Urgency / Source" value={`${form.urgency} | ${form.source}`} />
              {form.internal_notes ? <Summary label="Notes" value={form.internal_notes} /> : null}
            </div>
          </section>
        ) : null}
      </div>

      <div className="sticky bottom-0 flex flex-col gap-3 border-t border-[var(--border)] bg-[var(--card)]/95 p-5 backdrop-blur md:flex-row md:items-center md:justify-between">
        <div className="text-sm">
          {error ? <p className="text-[#ff9a91]">{error}</p> : null}
          {success ? <p className="text-[#7ce3a6]">{success}</p> : null}
          {!error && !success ? <p className="text-[var(--muted)]">Minimum tap targets, simple steps, no CRM faff.</p> : null}
        </div>
        <div className="flex gap-3">
          {step > 1 ? (
            <button className="button-ghost min-h-11" onClick={() => setStep((current) => current - 1)} type="button">
              Back
            </button>
          ) : null}
          {step < 4 ? (
            <button className="button-primary min-h-11" disabled={!canContinue()} onClick={() => setStep((current) => current + 1)} type="button">
              Next
            </button>
          ) : (
            <button className="button-primary min-h-11" disabled={isPending} onClick={handleSubmit} type="button">
              {isPending ? "Creating..." : "Create Job"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function customerToForm(customer: Customer, current: FormState): FormState {
  return {
    ...current,
    customer_id: customer.id,
    full_name: customer.full_name,
    phone: customer.phone ?? "",
    email: customer.email ?? "",
    property_address: customer.address_line_1 ?? current.property_address,
    postcode: customer.postcode ?? current.postcode,
    town: customer.town ?? current.town,
    county: customer.county ?? current.county
  };
}

function StepHeader({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <h3 className="font-condensed text-3xl text-white">{title}</h3>
      <p className="mt-2 text-sm text-[var(--muted)]">{text}</p>
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

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  const id = label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      <select className="field min-h-11" id={id} onChange={(event) => onChange(event.target.value)} value={value}>
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 border-b border-[var(--border)] pb-3 last:border-b-0 last:pb-0 md:flex-row md:justify-between">
      <span className="text-[var(--muted)]">{label}</span>
      <span className="font-semibold text-white md:text-right">{value}</span>
    </div>
  );
}
