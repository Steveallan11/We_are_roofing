import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { canPersistToSupabase } from "@/lib/workflows";

type Props = {
  params: Promise<{ customerId: string }>;
};

export async function DELETE(_request: Request, { params }: Props) {
  const { customerId } = await params;
  if (!canPersistToSupabase()) return NextResponse.json({ ok: true });

  const supabase = createSupabaseAdminClient();
  const { data: linkedJobs, error: checkError } = await supabase
    .from("jobs")
    .select("id, job_ref, job_title, status")
    .eq("customer_id", customerId);

  if (checkError) return NextResponse.json({ ok: false, error: checkError.message }, { status: 500 });

  const activeJobs = (linkedJobs ?? []).filter((job) => !["Completed", "Lost", "Archived", "Not Proceeding"].includes(job.status));
  if (activeJobs.length > 0) {
    return NextResponse.json(
      {
        ok: false,
        error: "ACTIVE_JOBS",
        message: `This customer has ${activeJobs.length} active job${activeJobs.length === 1 ? "" : "s"}. Delete or archive those first.`,
        jobs: activeJobs.map((job) => ({ ref: job.job_ref, title: job.job_title, status: job.status }))
      },
      { status: 409 }
    );
  }

  if ((linkedJobs ?? []).length > 0) {
    await supabase.from("jobs").delete().eq("customer_id", customerId).in("status", ["Completed", "Lost", "Archived", "Not Proceeding"]);
  }

  const { error } = await supabase.from("customers").delete().eq("id", customerId);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
