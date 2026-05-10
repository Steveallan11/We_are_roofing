import Link from "next/link";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const supabase = createSupabaseAdminClient();
  const { data: customers } = await supabase
    .from("customers")
    .select("*, jobs:jobs(id, status, estimated_value)")
    .order("created_at", { ascending: false });

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-condensed text-3xl text-white">Customers</h1>
          <p className="text-sm text-[var(--muted)] mt-1">{(customers ?? []).length} customers</p>
        </div>
        <Link className="button-primary text-sm" href="/leads/new">+ Add Lead</Link>
      </div>
      {(customers ?? []).length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-[var(--muted)]">No customers yet. Add your first lead to get started.</p>
          <Link className="button-primary mt-4 inline-block text-sm" href="/leads/new">Add Lead</Link>
        </div>
      ) : (
        <div className="space-y-2">
          {(customers ?? []).map((c: any) => {
            const jobCount = (c.jobs ?? []).length;
            const totalValue = (c.jobs ?? []).reduce((s: number, j: any) => s + (j.estimated_value ?? 0), 0);
            return (
              <Link key={c.id} href={"/customers/" + c.id} className="card p-4 block hover:-translate-y-0.5 transition">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-condensed text-lg text-white">{c.full_name}</h3>
                    <div className="flex flex-wrap gap-3 mt-1 text-xs text-[var(--muted)]">
                      {c.phone && <span>{c.phone}</span>}
                      {c.email && <span>{c.email}</span>}
                      {c.postcode && <span>{c.postcode}</span>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-white">{jobCount} job{jobCount !== 1 ? "s" : ""}</p>
                    {totalValue > 0 && <p className="text-xs text-[var(--gold-l)]">£{totalValue.toLocaleString()}</p>}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
