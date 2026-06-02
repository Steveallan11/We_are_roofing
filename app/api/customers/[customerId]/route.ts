import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdminApi } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { canPersistToSupabase } from "@/lib/workflows";

type Props = {
  params: Promise<{ customerId: string }>;
};

const EDITABLE_FIELDS = [
  "full_name",
  "business_name",
  "contact_person_name",
  "phone",
  "email",
  "contact_person_phone",
  "contact_person_email",
  "address_line_1",
  "address_line_2",
  "town",
  "county",
  "postcode",
  "notes"
] as const;

export async function PATCH(request: Request, { params }: Props) {
  const { customerId } = await params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  const fullName = cleanString(body.full_name);
  if (!fullName) {
    return NextResponse.json({ ok: false, error: "Customer name is required." }, { status: 400 });
  }

  const email = cleanString(body.email);
  const contactEmail = cleanString(body.contact_person_email);
  if ((email && !isValidEmail(email)) || (contactEmail && !isValidEmail(contactEmail))) {
    return NextResponse.json({ ok: false, error: "Please enter a valid email address." }, { status: 400 });
  }

  if (!canPersistToSupabase()) {
    return NextResponse.json({ ok: true, message: "Customer updated in preview mode." });
  }

  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const updates = Object.fromEntries(
    EDITABLE_FIELDS.map((field) => [field, cleanString(body[field])])
  );

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("customers")
    .update(updates)
    .eq("id", customerId)
    .select("*")
    .single();

  if (error || !data) {
    return NextResponse.json({ ok: false, error: error?.message ?? "Unable to update customer." }, { status: 500 });
  }

  revalidatePath("/customers");
  revalidatePath(`/customers/${customerId}`);
  revalidatePath("/jobs");
  revalidatePath("/dashboard");

  return NextResponse.json({ ok: true, message: "Customer updated.", customer: data });
}

export async function DELETE(_request: Request, { params }: Props) {
  const { customerId } = await params;
  if (!canPersistToSupabase()) return NextResponse.json({ ok: true });

  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

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
  revalidatePath("/customers");
  revalidatePath(`/customers/${customerId}`);
  revalidatePath("/jobs");
  return NextResponse.json({ ok: true });
}

function cleanString(value: unknown) {
  const text = String(value ?? "").trim();
  return text || null;
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
