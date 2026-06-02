import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { requireAdminApi } from "@/lib/auth";
import { createCustomerSchema } from "@/lib/validators";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { canPersistToSupabase, ensureBusinessRecord } from "@/lib/workflows";

const BUSINESS_ID = process.env.NEXT_PUBLIC_BUSINESS_ID || "6f9a6dca-a747-4a20-ab87-111808577cc7";

function splitPersonName(fullName: string) {
  const trimmed = fullName.trim();
  if (!trimmed) return { firstName: null, lastName: null };
  const parts = trimmed.split(/\s+/);
  return {
    firstName: parts[0] ?? null,
    lastName: parts.length > 1 ? parts.slice(1).join(" ") : null
  };
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = createCustomerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });
  }

  if (!canPersistToSupabase()) {
    return NextResponse.json({
      ok: true,
      message: "Customer payload accepted.",
      customer_id: `cust-${randomUUID()}`,
      received: parsed.data
    });
  }

  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const supabase = createSupabaseAdminClient();
  const business = await ensureBusinessRecord();
  const businessId = process.env.NEXT_PUBLIC_BUSINESS_ID || BUSINESS_ID || business.id;

  const input = parsed.data;
  const isBusinessCustomer = input.customer_type === "business";
  const fullName = input.full_name.trim();
  const displayName = isBusinessCustomer ? input.business_name.trim() : fullName || "Unknown";
  const { firstName, lastName } = splitPersonName(fullName);

  const { data: customer, error } = await supabase
    .from("customers")
    .insert({
      business_id: businessId,
      customer_type: input.customer_type,
      first_name: isBusinessCustomer ? null : firstName,
      last_name: isBusinessCustomer ? null : lastName,
      full_name: displayName,
      business_name: isBusinessCustomer ? input.business_name.trim() : null,
      phone: input.phone || null,
      email: input.email || null,
      contact_person_name: isBusinessCustomer ? input.contact_person_name || null : null,
      contact_person_phone: isBusinessCustomer ? input.contact_person_phone || null : null,
      contact_person_email: isBusinessCustomer ? input.contact_person_email || null : null,
      address_line_1: input.address_line_1 || null,
      town: input.town || null,
      county: input.county || null,
      postcode: input.postcode?.toUpperCase() || null,
      notes: input.notes || null
    })
    .select("*")
    .single();

  if (error || !customer) {
    return NextResponse.json({ ok: false, error: error?.message ?? "Failed to create customer." }, { status: 500 });
  }

  revalidatePath("/customers");

  return NextResponse.json({ ok: true, customer_id: customer.id, customer });
}
