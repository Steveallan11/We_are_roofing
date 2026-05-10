"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function AddLeadPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true); setError(null);
    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_name: fd.get("customer_name"),
          customer_phone: fd.get("customer_phone"),
          customer_email: fd.get("customer_email"),
          property_address: fd.get("property_address"),
          postcode: fd.get("postcode"),
          job_title: fd.get("job_title"),
          job_type: fd.get("job_type"),
          roof_type: fd.get("roof_type"),
          source: fd.get("source"),
          survey_date: fd.get("survey_date"),
          survey_time: fd.get("survey_time"),
          notes: fd.get("notes"),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create lead");
      router.push(`/jobs/${data.job.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSaving(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-condensed text-3xl text-white">Add New Lead</h1>
          <p className="text-sm text-[var(--muted)] mt-1">Customer details, property info, and survey booking</p>
        </div>
        <Link className="button-ghost text-sm" href="/dashboard">Back</Link>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        {/* Customer */}
        <div className="card p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--gold)] mb-4">Customer Details</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="label" htmlFor="customer_name">Full Name *</label><input className="field" name="customer_name" id="customer_name" placeholder="John Smith" required /></div>
            <div><label className="label" htmlFor="customer_phone">Phone</label><input className="field" name="customer_phone" id="customer_phone" placeholder="07700 900000" type="tel" /></div>
            <div><label className="label" htmlFor="customer_email">Email</label><input className="field" name="customer_email" id="customer_email" placeholder="john@email.com" type="email" /></div>
            <div>
              <label className="label" htmlFor="source">Lead Source</label>
              <select className="field" name="source" id="source" defaultValue="Phone Call">
                <option>Phone Call</option><option>Referral</option><option>Website</option><option>Google</option><option>Facebook</option><option>Checkatrade</option><option>Other</option>
              </select>
            </div>
          </div>
        </div>

        {/* Property + Job */}
        <div className="card p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--gold)] mb-4">Job Details</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2"><label className="label" htmlFor="property_address">Property Address *</label><input className="field" name="property_address" id="property_address" placeholder="123 High Street, Yateley" required /></div>
            <div><label className="label" htmlFor="postcode">Postcode</label><input className="field" name="postcode" id="postcode" placeholder="GU46 6NJ" /></div>
            <div><label className="label" htmlFor="job_title">Job Title *</label><input className="field" name="job_title" id="job_title" placeholder="Flat roof replacement to rear extension" required /></div>
            <div>
              <label className="label" htmlFor="job_type">Job Type</label>
              <select className="field" name="job_type" id="job_type" defaultValue="Replacement">
                <option>Replacement</option><option>Repair</option><option>Inspection</option><option>Report Only</option><option>Emergency</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="roof_type">Roof Type</label>
              <select className="field" name="roof_type" id="roof_type" defaultValue="Flat">
                <option>Flat</option><option>Pitched</option><option>Tile</option><option>Slate</option><option>Fascia</option><option>Chimney</option><option>Mixed</option><option>Other</option>
              </select>
            </div>
          </div>
        </div>

        {/* Survey Booking */}
        <div className="card p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--gold)] mb-4">Book Survey (Optional)</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="label" htmlFor="survey_date">Survey Date</label><input className="field" name="survey_date" id="survey_date" type="date" /></div>
            <div><label className="label" htmlFor="survey_time">Survey Time</label><input className="field" name="survey_time" id="survey_time" type="time" /></div>
          </div>
        </div>

        {/* Notes */}
        <div className="card p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--gold)] mb-4">Notes</p>
          <textarea className="field min-h-24" name="notes" placeholder="Any initial notes about the job..." />
        </div>

        {/* Submit */}
        <div className="flex items-center gap-3">
          <button className="button-primary" type="submit" disabled={saving}>{saving ? "Saving..." : "Create Lead & Job"}</button>
          {error && <p className="text-sm text-[#ff9a91]">{error}</p>}
        </div>
      </form>
    </div>
  );
}
