import { deleteJobWithCleanup } from "@/lib/jobs/deleteJob";
import type { createSupabaseAdminClient } from "@/lib/supabase/admin";

type SupabaseAdmin = ReturnType<typeof createSupabaseAdminClient>;

type DeleteCustomerResult =
  | {
      ok: true;
      message: string;
    }
  | {
      ok: false;
      status: number;
      error: string;
    };

export async function deleteCustomerWithJobs(supabase: SupabaseAdmin, customerId: string, confirmation: string): Promise<DeleteCustomerResult> {
  const { data: customer, error: customerError } = await supabase
    .from("customers")
    .select("id, full_name")
    .eq("id", customerId)
    .single();

  if (customerError || !customer) {
    return { ok: false, status: 404, error: customerError?.message ?? "Customer not found." };
  }

  const expected = String(customer.full_name || "DELETE").trim();
  if (confirmation.trim() !== expected && confirmation.trim().toUpperCase() !== "DELETE") {
    return { ok: false, status: 400, error: `Type ${expected} to confirm deletion.` };
  }

  const { data: jobs, error: jobsError } = await supabase
    .from("jobs")
    .select("id")
    .eq("customer_id", customerId);

  if (jobsError) {
    return { ok: false, status: 500, error: jobsError.message };
  }

  for (const job of jobs ?? []) {
    const result = await deleteJobWithCleanup(supabase, job.id, "DELETE");
    if (!result.ok) {
      return { ok: false, status: result.status, error: `Could not delete linked job: ${result.error}` };
    }
  }

  const { error } = await supabase.from("customers").delete().eq("id", customerId);
  if (error) {
    return { ok: false, status: 500, error: error.message };
  }

  return {
    ok: true,
    message: `${customer.full_name} and ${(jobs ?? []).length} linked job${(jobs ?? []).length === 1 ? "" : "s"} deleted.`
  };
}
