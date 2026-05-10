import Link from "next/link";
import { getDashboardStats, getJobs } from "@/lib/data";
import { StatusPill } from "@/components/ui/status-pill";
import { currency, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [stats, jobs] = await Promise.all([getDashboardStats(), getJobs()]);
  const recent = jobs.slice(0, 6);

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-condensed text-3xl text-white">Dashboard</h1>
          <p className="text-sm text-[var(--muted)] mt-1">We Are Roofing UK Ltd — Business Overview</p>
        </div>
        <div className="flex gap-2">
          <Link className="button-primary text-sm" href="/leads/new">+ Add Lead</Link>
          <Link className="button-secondary text-sm" href="/pipeline">Pipeline</Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: "Total Jobs", value: stats.totalJobs, color: "text-white" },
          { label: "Ready For Quote", value: stats.readyForQuote, color: "text-[var(--gold-l)]" },
          { label: "Ready To Send", value: stats.readyToSend, color: "text-[var(--gold-l)]" },
          { label: "Quotes Sent", value: stats.quoteSent, color: "text-[#7ce3a6]" },
          { label: "Materials Needed", value: stats.materialsNeeded, color: "text-[#a78bfa]" },
        ].map(s => (
          <div key={s.label} className="card p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--gold)]">{s.label}</p>
            <p className={`font-condensed text-4xl mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Quick Workflow + Recent Jobs */}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-3">
          <h2 className="font-condensed text-xl text-white">Recent Jobs</h2>
          {recent.length === 0 ? (
            <div className="card p-6 text-center">
              <p className="text-[var(--muted)]">No jobs yet.</p>
              <Link className="button-primary mt-4 inline-block text-sm" href="/leads/new">Add Your First Lead</Link>
            </div>
          ) : (
            <div className="space-y-2">
              {recent.map(job => (
                <Link key={job.id} href={`/jobs/${job.id}`} className="card p-4 block hover:-translate-y-0.5 transition">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--gold)]">{job.roof_type ?? "Roofing"}</span>
                      </div>
                      <h3 className="font-condensed text-lg text-white mt-0.5 truncate">{job.job_title}</h3>
                      <p className="text-xs text-[var(--muted)] truncate">{job.property_address}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-[var(--dim)]">
                        <span>{(job as any).customer?.full_name ?? "No customer"}</span>
                        {job.estimated_value && <span className="text-[var(--gold-l)]">{currency(job.estimated_value)}</span>}
                        <span>{formatDate(job.updated_at ?? job.created_at ?? null)}</span>
                      </div>
                    </div>
                    <StatusPill status={job.status} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="card p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--gold)]">Workflow</p>
            <ol className="mt-3 space-y-2.5 text-sm text-[var(--text)]">
              <li className="flex gap-2"><span className="text-[var(--gold)]">1.</span> Add lead & property details</li>
              <li className="flex gap-2"><span className="text-[var(--gold)]">2.</span> Survey on site with photos</li>
              <li className="flex gap-2"><span className="text-[var(--gold)]">3.</span> AI generates quote & report</li>
              <li className="flex gap-2"><span className="text-[var(--gold)]">4.</span> Review, approve, send</li>
              <li className="flex gap-2"><span className="text-[var(--gold)]">5.</span> Track materials & booking</li>
            </ol>
          </div>
          <div className="card p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--gold)]">Pipeline Value</p>
            <p className="font-condensed text-3xl text-[var(--gold-l)] mt-2">
              {currency(jobs.reduce((sum, j) => sum + (j.estimated_value ?? 0), 0))}
            </p>
            <p className="text-xs text-[var(--dim)] mt-1">Across {jobs.length} jobs</p>
          </div>
        </div>
      </div>
    </div>
  );
}
