"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

const leadSources = ["Referral", "Phone Call", "Website", "Google", "Facebook", "Checkatrade", "Other"];
const jobTypes = ["Replacement", "Repair", "Inspection", "Report Only"];
const roofTypes = ["Flat", "Pitched", "Tile", "Slate", "Fascia", "Chimney", "Mixed", "Other"];
const urgencies = ["Low", "Medium", "High", "Emergency"];

type FormState = {
  full_name: string;
  phone: string;
  email: string;
  source: string;
  property_address: string;
  postcode: string;
  job_title: string;
  job_type: string;
  roof_type: string;
  urgency: string;
  internal_notes: string;
};

const initialState: FormState = {
  full_name: "",
  phone: "",
  email: "",
  source: "Referral",
  property_address: "",
  postcode: "",
  job_title: "",
  job_type: "Replacement",
  roof_type: "Flat",
  urgency: "Medium",
  internal_notes: ""
};

export function NewJobForm() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(initialState);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const response = await fetch("/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customer: {
          full_name: form.full_name,
          phone: form.phone,
          email: form.email,
          property_address: form.property_address,
          postcode: form.postcode,
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
      | { ok?: boolean; error?: string | { fieldErrors?: Record<string, string[]> }; job_id?: string }
      | null;

    if (!response.ok || !result?.ok || !result.job_id) {
      setError("Unable to save the job. Please check the required details and try again.");
      return;
    }

    setSuccess("Job saved. Opening the survey.");
    startTransition(() => {
      router.push(`/jobs/${result.job_id}/survey`);
      router.refresh();
    });
  }

  return (
    <form className="card p-6 md:p-8" onSubmit={handleSubmit}>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="label" htmlFor="customer-name">
            Customer Name
          </label>
          <input className="field" id="customer-name" onChange={(event) => updateField("full_name", event.target.value)} placeholder="Full customer name" value={form.full_name} />
        </div>
        <div>
          <label className="label" htmlFor="customer-phone">
            Phone
          </label>
          <input className="field" id="customer-phone" onChange={(event) => updateField("phone", event.target.value)} placeholder="Customer phone number" value={form.phone} />
        </div>
        <div>
          <label className="label" htmlFor="customer-email">
            Email
          </label>
          <input className="field" id="customer-email" onChange={(event) => updateField("email", event.target.value)} placeholder="Customer email address" type="email" value={form.email} />
        </div>
        <div>
          <label className="label" htmlFor="lead-source">
            Lead Source
          </label>
          <select className="field" id="lead-source" onChange={(event) => updateField("source", event.target.value)} value={form.source}>
            {leadSources.map((source) => (
              <option key={source}>{source}</option>
            ))}
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="label" htmlFor="property-address">
            Property Address
          </label>
          <input
            className="field"
            id="property-address"
            onChange={(event) => updateField("property_address", event.target.value)}
            placeholder="Full property address"
            value={form.property_address}
          />
        </div>
        <div>
          <label className="label" htmlFor="job-title">
            Job Title
          </label>
          <input className="field" id="job-title" onChange={(event) => updateField("job_title", event.target.value)} placeholder="Rear extension flat roof replacement" value={form.job_title} />
        </div>
        <div>
          <label className="label" htmlFor="postcode">
            Postcode
          </label>
          <input className="field" id="postcode" onChange={(event) => updateField("postcode", event.target.value)} placeholder="GU46..." value={form.postcode} />
        </div>
        <div>
          <label className="label" htmlFor="job-type">
            Job Type
          </label>
          <select className="field" id="job-type" onChange={(event) => updateField("job_type", event.target.value)} value={form.job_type}>
            {jobTypes.map((jobType) => (
              <option key={jobType}>{jobType}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="roof-type">
            Roof Type
          </label>
          <select className="field" id="roof-type" onChange={(event) => updateField("roof_type", event.target.value)} value={form.roof_type}>
            {roofTypes.map((roofType) => (
              <option key={roofType}>{roofType}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="urgency">
            Urgency
          </label>
          <select className="field" id="urgency" onChange={(event) => updateField("urgency", event.target.value)} value={form.urgency}>
            {urgencies.map((urgency) => (
              <option key={urgency}>{urgency}</option>
            ))}
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="label" htmlFor="internal-notes">
            Internal Notes
          </label>
          <textarea
            className="field min-h-24"
            id="internal-notes"
            onChange={(event) => updateField("internal_notes", event.target.value)}
            placeholder="Anything the office or surveyor needs to know before the visit."
            value={form.internal_notes}
          />
        </div>
      </div>

      <div className="gold-divider my-6" />

      <button className="button-primary" disabled={isPending} type="submit">
        {isPending ? "Saving Job..." : "Save Job And Start Survey"}
      </button>
      {error ? <p className="mt-4 text-sm text-[#ff9a91]">{error}</p> : null}
      {success ? <p className="mt-4 text-sm text-[#7ce3a6]">{success}</p> : null}
    </form>
  );
}
