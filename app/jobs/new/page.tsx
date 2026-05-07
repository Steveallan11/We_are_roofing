import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";

export default function NewJobPage() {
  return (
    <AppShell
      title="Add New Job"
      subtitle="This is the first step in the field workflow. We capture the lead, property, and survey type up front so the next screen can stay focused and simple."
      actions={<Link className="button-ghost" href="/dashboard">Back to Dashboard</Link>}
    >
      <div className="mx-auto max-w-4xl">
        <form className="card p-6 md:p-8">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label" htmlFor="customer-name">
                Customer Name
              </label>
              <input className="field" id="customer-name" placeholder="Full customer name" />
            </div>
            <div>
              <label className="label" htmlFor="customer-phone">
                Phone
              </label>
              <input className="field" id="customer-phone" placeholder="Customer phone number" />
            </div>
            <div>
              <label className="label" htmlFor="customer-email">
                Email
              </label>
              <input className="field" id="customer-email" placeholder="Customer email address" />
            </div>
            <div>
              <label className="label" htmlFor="lead-source">
                Lead Source
              </label>
              <select className="field" defaultValue="Referral" id="lead-source">
                <option>Referral</option>
                <option>Phone Call</option>
                <option>Website</option>
                <option>Google</option>
                <option>Facebook</option>
                <option>Checkatrade</option>
                <option>Other</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="label" htmlFor="property-address">
                Property Address
              </label>
              <input className="field" id="property-address" placeholder="Full property address" />
            </div>
            <div>
              <label className="label" htmlFor="job-title">
                Job Title
              </label>
              <input className="field" id="job-title" placeholder="Rear extension flat roof replacement" />
            </div>
            <div>
              <label className="label" htmlFor="postcode">
                Postcode
              </label>
              <input className="field" id="postcode" placeholder="GU46..." />
            </div>
            <div>
              <label className="label" htmlFor="job-type">
                Job Type
              </label>
              <select className="field" defaultValue="Replacement" id="job-type">
                <option>Replacement</option>
                <option>Repair</option>
                <option>Inspection</option>
                <option>Report Only</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="roof-type">
                Roof Type
              </label>
              <select className="field" defaultValue="Flat" id="roof-type">
                <option>Flat</option>
                <option>Pitched</option>
                <option>Tile</option>
                <option>Slate</option>
                <option>Fascia</option>
                <option>Chimney</option>
                <option>Mixed</option>
                <option>Other</option>
              </select>
            </div>
          </div>

          <div className="gold-divider my-6" />

          <div className="flex flex-wrap gap-3">
            <Link className="button-primary" href="/jobs/job-1">
              Save Draft Job
            </Link>
            <span className="button-secondary">`POST /api/jobs` wiring next</span>
          </div>
        </form>
      </div>
    </AppShell>
  );
}

