import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Business } from "@/lib/types";
import { canPersistToSupabase } from "@/lib/workflows";

const editableFields = [
  "business_name",
  "trading_address",
  "phone",
  "email",
  "website",
  "logo_url",
  "vat_registered",
  "vat_rate",
  "company_number",
  "payment_terms",
  "quote_valid_days",
  "weather_location",
  "bank_name",
  "bank_sort_code",
  "bank_account",
  "bank_account_name"
] as const satisfies Array<keyof Business>;

type EditableField = (typeof editableFields)[number];

export async function PATCH(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Partial<Business>;
  const payload = editableFields.reduce<Partial<Record<EditableField, Business[EditableField]>>>((next, field) => {
    if (field in body) {
      next[field] = body[field] as Business[EditableField];
    }
    return next;
  }, {});

  if (Object.keys(payload).length === 0) {
    return NextResponse.json({ ok: false, error: "No editable business settings were provided." }, { status: 400 });
  }

  if (typeof payload.vat_rate === "string") {
    payload.vat_rate = Number(payload.vat_rate) as Business["vat_rate"];
  }
  if (typeof payload.quote_valid_days === "string") {
    payload.quote_valid_days = Number(payload.quote_valid_days) as Business["quote_valid_days"];
  }

  if (!canPersistToSupabase()) {
    return NextResponse.json({ ok: true, message: "Business settings preview saved.", business: { ...body, ...payload } });
  }

  const supabase = createSupabaseAdminClient();
  const { data: existing, error: findError } = await supabase.from("businesses").select("id").limit(1).single();
  if (findError || !existing) {
    return NextResponse.json({ ok: false, error: findError?.message ?? "Business record not found." }, { status: 404 });
  }

  const { data, error } = await supabase.from("businesses").update(payload).eq("id", existing.id).select("*").single();
  if (error || !data) {
    return NextResponse.json({ ok: false, error: error?.message ?? "Unable to save business settings." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, message: "Business settings saved.", business: data });
}
