"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardHeader, CardTitle, CardKicker, CardBody, CardFooter, Input, Select, Textarea } from "@/components/ui/primitives";
import { lookupPostcode as lookupPostcodeApi } from "@/lib/postcode";
import type { Customer } from "@/lib/types";

const leadSources = ["Referral", "Phone Call", "Website", "Google", "Facebook", "Checkatrade", "Returning Customer", "Other"];
const jobTypes = ["Repair", "Replacement", "New Build", "Emergency", "Survey Only", "Report Only"];
const roofTypes = ["Pitched Tile", "Pitched Slate", "Flat EPDM", "Flat GRP", "Flat Felt", "Flat Lead", "Mixed", "Chimney", "Guttering", "Other"];
const urgencies = ["Low", "Medium", "High", "Emergency"];

type FormState = {
  customer_id: string;
  customer_type: "person" | "business";
  full_name: string;
  business_name: string;
  phone: string;
  email: string;
  contact_person_name: string;
  contact_person_phone: string;
  contact_person_email: string;
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
  customer_type: "person",
  full_name: "",
  business_name: "",
  phone: "",
  email: "",
  contact_person_name: "",
  contact_person_phone: "",
  contact_person_email: "",
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
  const [loading, setLoading] = useState(false);
  const [duplicateCustomer, setDuplicateCustomer] = useState<Customer | null>(null);
  const [duplicateOverride, setDuplicateOverride] = useState(false);
  const [isPending, startTransition] = useTransition();

  const matches = useMemo(() => {
    const query = customerSearch.trim().toLowerCase();
    if (!query) return customers.slice(0, 5);
    return customers
      .filter((customer) =>
        [
          customer.full_name,
          customer.business_name,
          customer.contact_person_name,
          customer.phone,
          customer.email,
          customer.postcode
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(query)
      )
      .slice(0, 8);
  }, [customerSearch, customers]);

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    if (key === "phone" || key === "contact_person_phone" || key === "customer_type") {
      setDuplicateCustomer(null);
      setDuplicateOverride(false);
    }
  }

  function selectCustomer(customer: Customer) {
    setForm((current) => customerToForm(customer, current));
    setCustomerSearch(customer.business_name || customer.full_name);
    setDuplicateCustomer(null);
    setDuplicateOverride(false);
  }

  function autoTitle() {
    updateField("job_title", `${form.roof_type} ${form.job_type}`);
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
      county: result.county || current.county,
      property_address: current.property_address || [result.town, current.postcode.trim().toUpperCase()].filter(Boolean).join(", ")
    }));
    setPostcodeStatus("Postcode found. Town and county filled.");
  }

  function findDuplicateCustomer() {
    if (form.customer_id || duplicateOverride) return null;

    if (form.customer_type === "business") {
      const businessName = form.business_name.trim().toLowerCase();
      const phone = form.phone.trim();
      const contactName = form.contact_person_name.trim().toLowerCase();
      if (!businessName && !phone && !contactName) return null;

      return (
        customers.find((customer) => {
          if (customer.customer_type !== "business") return false;
          const sameBusinessName = (customer.business_name ?? "").trim().toLowerCase() === businessName;
          const samePhone = (customer.phone ?? "").trim() === phone;
          const sameContactName = (customer.contact_person_name ?? "").trim().toLowerCase() === contactName;
          return sameBusinessName || samePhone || sameContactName;
        }) ?? null
      );
    }

    const phone = form.phone.trim();
    if (!phone) return null;
    return customers.find((customer) => customer.customer_type !== "business" && customer.phone?.trim() === phone) ?? null;
  }

  async function handleNext() {
    setLoading(true);
    setError(null);

    try {
      if (step === 1) {
        const duplicate = findDuplicateCustomer();
        if (duplicate && duplicateCustomer?.id !== duplicate.id) {
          setDuplicateCustomer(duplicate);
          return;
        }
        setStep(2);
        return;
      }

      if (step === 2) {
        if (form.postcode) {
          await lookupPostcode();
        }
        setStep(3);
        return;
      }

      if (step === 3) {
        setStep(4);
        return;
      }

      await handleSubmit();
    } catch (err) {
      console.error("Wizard error:", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function canContinue() {
    if (step === 1) {
      return form.customer_type === "business"
        ? Boolean(form.business_name && form.phone && form.contact_person_name)
        : Boolean(form.full_name && form.phone);
    }
    if (step === 2) return Boolean(form.property_address && form.job_type && form.roof_type);
    if (step === 3) return Boolean(form.job_title && form.urgency && form.source);
    return true;
  }

  async function handleSubmit() {
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: {
            customer_id: form.customer_id,
            customer_type: form.customer_type,
            full_name: form.full_name.trim() || "Unknown",
            business_name: form.business_name.trim(),
            phone: form.phone,
            email: form.email,
            contact_person_name: form.contact_person_name,
            contact_person_phone: form.contact_person_phone,
            contact_person_email: form.contact_person_email,
            property_address: form.property_address,
            postcode: form.postcode.trim().toUpperCase(),
            town: form.town,
            county: form.county,
            source: form.source
          },
          job: {
            job_title: form.job_title || `${form.roof_type} ${form.job_type}`,
            job_type: form.job_type,
            roof_type: form.roof_type,
            urgency: form.urgency || "Medium",
            internal_notes: form.internal_notes
          }
        })
      });

      const result = (await response.json().catch(() => null)) as
        | { ok?: boolean; error?: string | { fieldErrors?: Record<string, string[]> }; job_id?: string; job?: { job_ref?: string }; duplicate_customer_reused?: boolean }
        | null;

      if (!response.ok || !result?.ok || !result.job_id) {
        setError(typeof result?.error === "string" ? result.error : "Unable to save the job. Check the required details and try again.");
        return;
      }

      setSuccess(`${result.job?.job_ref ?? "Job"} created. Opening job file.`);
      startTransition(() => {
        router.push(`/jobs/${result.job_id}`);
        router.refresh();
      });
    } catch (err) {
      console.error("Wizard submit error:", err);
      setError("Something went wrong while creating the job. Please try again.");
    }
  }

  return (
    <Card variant="default" className="overflow-hidden">
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardKicker>New Job Wizard</CardKicker>
            <CardTitle className="mt-2">Step {step} of 4</CardTitle>
          </div>
          <div className="hidden gap-2 md:flex">
            {[1, 2, 3, 4].map((item) => (
              <span className={`h-2 w-12 rounded-full ${item <= step ? "bg-[var(--gold)]" : "bg-white/10"}`} key={item} />
            ))}
          </div>
        </div>
      </CardHeader>

      <CardBody className="md:p-8">
        {step === 1 ? (
          <section className="grid gap-5">
            <StepHeader title="Customer" text="Search first. If they already exist, use the existing record and avoid duplicates." />
            <Input
              label="Search customers"
              placeholder="by name, business, phone, email or postcode"
              onChange={(e) => setCustomerSearch(e.target.value)}
              value={customerSearch}
            />
            {matches.length ? (
              <div className="grid gap-2">
                {matches.map((customer) => (
                  <Button
                    key={customer.id}
                    onClick={() => selectCustomer(customer)}
                    variant={form.customer_id === customer.id ? "primary" : "secondary"}
                    className="justify-start text-left"
                  >
                    <div className="w-full">
                      <p className="font-semibold">{customer.business_name || customer.full_name}</p>
                      <p className="mt-1 text-sm opacity-75">
                        {[customer.contact_person_name, customer.phone, customer.email, customer.postcode].filter(Boolean).join(" | ")}
                      </p>
                    </div>
                  </Button>
                ))}
              </div>
            ) : null}
            {duplicateCustomer ? (
              <Card variant="outlined" className="border-[color:var(--warning-border)] bg-[color:var(--warning-bg)]">
                <CardBody>
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-[color:var(--warning-text)]">Possible duplicate customer</p>
                  <p className="mt-2 text-sm text-[var(--text-second)]">
                    {(duplicateCustomer.business_name || duplicateCustomer.full_name)} already looks like an existing record. Use it to keep job history tidy.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button variant="secondary" size="sm" onClick={() => selectCustomer(duplicateCustomer)}>
                      Use Existing Customer
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setDuplicateOverride(true);
                        setDuplicateCustomer(null);
                      }}
                    >
                      Continue Anyway
                    </Button>
                  </div>
                </CardBody>
              </Card>
            ) : null}
            <div className="grid gap-4 md:grid-cols-2">
              <Select
                label="Customer Type"
                value={form.customer_type}
                onChange={(event) => updateField("customer_type", event.target.value as FormState["customer_type"])}
              >
                <option value="person">Person</option>
                <option value="business">Business</option>
              </Select>
              <div />
              {form.customer_type === "business" ? (
                <>
                  <Input label="Business Name" value={form.business_name} onChange={(e) => updateField("business_name", e.target.value)} autoComplete="organization" />
                  <Input label="Business Phone" value={form.phone} onChange={(e) => updateField("phone", e.target.value)} autoComplete="tel" inputMode="tel" type="tel" />
                  <Input label="Business Email" value={form.email} onChange={(e) => updateField("email", e.target.value)} autoComplete="email" type="email" />
                  <Input label="Contact Person" value={form.contact_person_name} onChange={(e) => updateField("contact_person_name", e.target.value)} autoComplete="name" />
                  <Input label="Contact Phone" value={form.contact_person_phone} onChange={(e) => updateField("contact_person_phone", e.target.value)} autoComplete="tel" inputMode="tel" type="tel" />
                  <Input label="Contact Email" value={form.contact_person_email} onChange={(e) => updateField("contact_person_email", e.target.value)} autoComplete="email" type="email" />
                </>
              ) : (
                <>
                  <Input label="Full Name" value={form.full_name} onChange={(e) => updateField("full_name", e.target.value)} autoComplete="name" />
                  <Input label="Phone" value={form.phone} onChange={(e) => updateField("phone", e.target.value)} autoComplete="tel" inputMode="tel" type="tel" />
                  <Input label="Email" value={form.email} onChange={(e) => updateField("email", e.target.value)} autoComplete="email" type="email" />
                  <div />
                </>
              )}
              <Select
                label="Source"
                value={form.source}
                onChange={(event) => updateField("source", event.target.value)}
              >
                {leadSources.map((source) => (
                  <option key={source} value={source}>
                    {source}
                  </option>
                ))}
              </Select>
            </div>
          </section>
        ) : null}

        {step === 2 ? (
          <section className="grid gap-5">
            <StepHeader title="Property" text="Capture the site address and what kind of roof/job this is." />
            <div className="grid gap-4 md:grid-cols-2">
              <Input
                label="Property Address"
                value={form.property_address}
                onChange={(e) => updateField("property_address", e.target.value)}
                autoComplete="street-address"
                className="md:col-span-2"
              />
              <div>
                <Input
                  label="Postcode"
                  value={form.postcode}
                  onChange={(e) => updateField("postcode", e.target.value)}
                  onBlur={lookupPostcode}
                  autoComplete="postal-code"
                />
                {postcodeStatus ? <p className="mt-2 text-xs text-[var(--muted)]">{postcodeStatus}</p> : null}
              </div>
              <Input label="Town" value={form.town} onChange={(e) => updateField("town", e.target.value)} />
              <Input label="County" value={form.county} onChange={(e) => updateField("county", e.target.value)} />
              <Select
                label="Job Type"
                value={form.job_type}
                onChange={(event) => updateField("job_type", event.target.value)}
              >
                {jobTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </Select>
              <Select
                label="Roof Type"
                value={form.roof_type}
                onChange={(event) => updateField("roof_type", event.target.value)}
              >
                {roofTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </Select>
            </div>
          </section>
        ) : null}

        {step === 3 ? (
          <section className="grid gap-5">
            <StepHeader title="Details" text="Set the job title, urgency and any notes the office or surveyor needs." />
            <div className="grid gap-4">
              <div>
                <Input label="Job Title" value={form.job_title} onChange={(e) => updateField("job_title", e.target.value)} />
                <Button variant="ghost" size="sm" onClick={autoTitle} className="mt-2 text-sm">
                  Auto-generate from roof and job type
                </Button>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-[var(--dim)]">Urgency</p>
                <div className="mt-2 grid gap-2 md:grid-cols-4">
                  {urgencies.map((urgency) => (
                    <Button
                      key={urgency}
                      onClick={() => updateField("urgency", urgency)}
                      variant={form.urgency === urgency ? "primary" : "secondary"}
                    >
                      {urgency}
                    </Button>
                  ))}
                </div>
              </div>
              <Textarea
                label="Internal Notes"
                value={form.internal_notes}
                onChange={(event) => updateField("internal_notes", event.target.value)}
                rows={7}
                placeholder="Notes for the team"
              />
            </div>
          </section>
        ) : null}

        {step === 4 ? (
          <section className="grid gap-5">
            <StepHeader title="Confirm" text="Check the details, then create the job file and permanent job number." />
            <div className="grid gap-3 rounded-2xl border border-[var(--border)] bg-black/20 p-5 text-sm">
              <Summary
                label="Customer"
                value={
                  form.customer_type === "business"
                    ? `${form.business_name} | ${form.contact_person_name || "No contact"} | ${form.phone}`
                    : `${form.full_name} | ${form.phone}`
                }
              />
              <Summary label="Property" value={`${form.property_address} ${form.postcode}`.trim()} />
              <Summary label="Job" value={`${form.job_title} | ${form.roof_type} | ${form.job_type}`} />
              <Summary label="Urgency / Source" value={`${form.urgency} | ${form.source}`} />
              {form.internal_notes ? <Summary label="Notes" value={form.internal_notes} /> : null}
            </div>
          </section>
        ) : null}
      </CardBody>

      <CardFooter className="sticky bottom-0 flex flex-col gap-3 bg-[var(--card)]/95 backdrop-blur md:flex-row md:items-center md:justify-between">
        <div className="text-sm">
          {error ? <p className="text-[color:var(--emergency-text)]">{error}</p> : null}
          {success ? <p className="text-[color:var(--success-text)]">{success}</p> : null}
          {!error && !success ? <p className="text-[var(--muted)]">Minimum tap targets, simple steps, no CRM faff.</p> : null}
        </div>
        <div className="flex gap-3">
          {step > 1 ? (
            <Button variant="ghost" size="md" disabled={loading || isPending} onClick={() => setStep((current) => current - 1)}>
              Back
            </Button>
          ) : null}
          {step < 4 ? (
            <Button variant="primary" size="md" disabled={!canContinue() || loading || isPending} onClick={handleNext}>
              {loading ? "Processing..." : "Continue"}
            </Button>
          ) : (
            <Button variant="primary" size="md" disabled={isPending || loading} onClick={handleNext}>
              {isPending || loading ? "Processing..." : "Create Job"}
            </Button>
          )}
        </div>
      </CardFooter>
    </Card>
  );
}

function customerToForm(customer: Customer, current: FormState): FormState {
  return {
    ...current,
    customer_id: customer.id,
    customer_type: customer.customer_type === "business" ? "business" : "person",
    full_name: customer.customer_type === "business" ? customer.contact_person_name ?? "" : customer.full_name,
    business_name: customer.business_name ?? "",
    phone: customer.phone ?? "",
    email: customer.email ?? "",
    contact_person_name: customer.contact_person_name ?? "",
    contact_person_phone: customer.contact_person_phone ?? "",
    contact_person_email: customer.contact_person_email ?? "",
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


function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 border-b border-[var(--border)] pb-3 last:border-b-0 last:pb-0 md:flex-row md:justify-between">
      <span className="text-[var(--muted)]">{label}</span>
      <span className="font-semibold text-white md:text-right">{value}</span>
    </div>
  );
}
