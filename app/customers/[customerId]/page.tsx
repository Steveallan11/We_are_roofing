import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { StatusPill } from "@/components/ui/status-pill";
import { currency, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ customerId: string }> };

export default async function CustomerDetailPage({ params }: Props) {
  const { customerId } = await params;
  const supabase = createSupabaseAdminClient();

  const { data: customer } = await supabase
    .from("customers")
    .select("*")
    .eq("id", customerId)
    .single();

  if (!customer) notFound();

  const { data: jobs } = await supabase
    .from("jobs")
    .select("*")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });

  const { data: quotes } = await supabase
    .from("quotes")
    .select("*, jobs:job_id(job_title)")
    .in("job_id", (jobs ?? []).map((j: any) => j.id));

  const totalValue = (jobs ?? []).reduce((sum: number, j: any) => sum + (j.estimated_value ?? 0), 0);
  const jobCount = (jobs ?? []).length;
  const quoteCount = (quotes ?? []).length;

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--gold)]">Customer</p>
          <h1 className="font-condensed text-3xl text-white mt-1">{customer.full_name}</h1>
        </div>
        <div className="flex gap-2">
          <Link className="button-primary text-sm" href="/leads/new">+ New Job</Link>
          <Link className="button-ghost text-sm" href="/customers">Back</Link>
        </div>
      </div>

      {/* Contact Details */}
      <div className="grid sm:grid-cols-3 gap-4">
        <div className="card p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--gold)]">Contact</p>
          <div className="mt-2 space-y-2 text-sm">
            {customer.phone && (
              <div className="flex items-center gap-2">
                <span className="text-[var(--dim)]">Phone</span>
                <a href={"tel:" + customer.phone} className="text-[var(--gold-l)] hover:underline">{customer.phone}</a>
              </div>
            )}
            {customer.email && (
              <div className="flex items-center gap-2">
                <span className="text-[var(--dim)]">Email</span>
                <a href={"mailto:" + customer.email} className="text-[var(--gold-l)] hover:underline">{customer.email}</a>
              </div>
            )}
          </div>
        </div>
        <div className="card p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--gold)]">Address</p>
          <div className="mt-2 text-sm text-[var(--text)]">
            {customer.address_line_1 && <p>{customer.address_line_1}</p>}
            {customer.address_line_2 && <p>{customer.address_line_2}</p>}
            {customer.city && <p>{customer.city}</p>}
            {customer.postcode && <p>{customer.postcode}</p>}
          </div>
        </div>
        <div className="card p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--gold)]">Summary</p>
          <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
            <div><p className="text-[var(--dim)]">Jobs</p><p className="text-2xl font-condensed text-white">{jobCount}</p></div>
            <div><p className="text-[var(--dim)]">Quotes</p><p className="text-2xl font-condensed text-white">{quoteCount}</p></div>
            <div className="col-span-2"><p className="text-[var(--dim)]">Total Value</p><p className="text-2xl font-condensed text-[var(--gold-l)]">{currency(totalValue)}</p></div>
          </div>
        </div>
      </div>

      {/* Jobs List */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--gold)]">Jobs ({jobCount})</p>
        </div>
        {(jobs ?? []).length === 0 ? (
          <p className="text-sm text-[var(--dim)]">No jobs yet for this customer.</p>
        ) : (
          <div className="space-y-2">
            {(jobs ?? []).map((job: any) => (
              <Link
                key={job.id}
                href={`/jobs/${job.id}` as Route}
                className="block rounded-xl border border-[var(--border)] p-3 hover:-translate-y-0.5 transition hover:border-[var(--border2)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--gold)]">{job.roof_type ?? "Roofing"}</span>
                      <span className="text-[9px] text-[var(--dim)]">{job.job_type}</span>
                    </div>
                    <h3 className="font-condensed text-lg text-white mt-0.5">{job.job_title}</h3>
                    <p className="text-xs text-[var(--muted)] truncate">{job.property_address}</p>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-[var(--dim)]">
                      {job.estimated_value && <span className="text-[var(--gold-l)]">{currency(job.estimated_value)}</span>}
                      {job.source && <span>via {job.source}</span>}
                      <span>{formatDate(job.created_at)}</span>
                    </div>
                  </div>
                  <StatusPill status={job.status} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Quotes List */}
      {(quotes ?? []).length > 0 && (
        <div className="card p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--gold)] mb-3">Quotes ({quoteCount})</p>
          <div className="space-y-2">
            {(quotes ?? []).map((q: any) => (
              <div key={q.id} className="rounded-xl border border-[var(--border)] p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-white">{q.quote_ref}</p>
                  <p className="text-xs text-[var(--muted)]">{(q.jobs as any)?.job_title ?? "—"}</p>
                  <p className="text-xs text-[var(--dim)]">{formatDate(q.created_at)}</p>
                </div>
                <div className="text-right">
                  <p className="font-condensed text-xl text-[var(--gold-l)]">{currency(q.total ?? 0)}</p>
                  <StatusPill status={q.status} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Meta */}
      <div className="text-xs text-[var(--dim)]">
        Customer since {formatDate(customer.created_at)}
      </div>
    </div>
  );
}
