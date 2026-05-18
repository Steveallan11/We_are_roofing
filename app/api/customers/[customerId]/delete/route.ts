import { NextResponse } from "next/server";
import { deleteCustomerWithJobs } from "@/lib/customers/deleteCustomer";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { canPersistToSupabase } from "@/lib/workflows";

type Props = {
  params: Promise<{ customerId: string }>;
};

export async function POST(request: Request, { params }: Props) {
  const { customerId } = await params;
  const body = (await request.json().catch(() => ({}))) as { confirmation?: string };

  if (!body.confirmation) {
    return NextResponse.json({ ok: false, error: "confirmation is required." }, { status: 400 });
  }

  if (!canPersistToSupabase()) {
    return NextResponse.json({ ok: true, message: "Customer deleted in preview mode." });
  }

  const result = await deleteCustomerWithJobs(createSupabaseAdminClient(), customerId, body.confirmation);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true, message: result.message });
}
