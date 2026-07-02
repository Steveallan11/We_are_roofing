import { requireAdminApi } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getBusiness } from "@/lib/data";
import type { Business } from "@/lib/types";

const ALLOWED_FIELDS: Array<keyof Business> = [
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
  "bank_account_name",
  "guarantee_text",
  "default_exclusions",
  "default_terms"
];

export async function PATCH(request: Request) {
  try {
    const auth = await requireAdminApi();
    if (!auth.ok) return auth.response;

    const business = await getBusiness();
    const body = (await request.json()) as Partial<Business>;
    const updates = Object.fromEntries(
      ALLOWED_FIELDS.filter((field) => field in body).map((field) => {
        const value = body[field];
        return [field, value === "" ? null : value];
      })
    );

    if (Object.keys(updates).length === 0) {
      return Response.json({ ok: false, error: "No valid settings fields supplied." }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("businesses")
      .update(updates)
      .eq("id", business.id)
      .select("*")
      .single();

    if (error) {
      console.error("Error updating business settings:", error);
      return Response.json({ ok: false, error: error.message }, { status: 400 });
    }

    return Response.json({ ok: true, message: "Settings updated", business: data });
  } catch (err) {
    console.error("Business settings API error:", err);
    return Response.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
